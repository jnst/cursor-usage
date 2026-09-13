import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";

import { startServer } from "../src/server/index.ts";

const csv = `Date,User,Model,Cost,Kind,Total Tokens,Cloud Agent ID,Automation ID
2026-08-14T08:00:00Z,first@company.invalid,auto,5,On-Demand,1000,bc-private-agent,private-automation
2026-08-14T09:00:00Z,second@company.invalid,auto,8,On-Demand,2000,bc-private-agent,private-automation
2026-08-14T10:00:00Z,N/A,auto,Free,On-Demand,,,
`;
const output = await mkdtemp(join(tmpdir(), "cursor-usage-import-"));
const server = await startServer({ port: 0 });
const browser = await chromium.launch(
  process.env.CHROME_PATH
    ? { headless: true, executablePath: process.env.CHROME_PATH }
    : { headless: true, channel: process.env.PLAYWRIGHT_CHROME_CHANNEL ?? "chrome" },
);
const errors: string[] = [];
const downloads: string[] = [];

async function choose(page: Page, label: string, keyboard = false, content = csv) {
  const button = page.getByRole("button", { name: label, exact: true });
  const chooser = page.waitForEvent("filechooser");
  if (keyboard) {
    await button.focus();
    await page.keyboard.press("Enter");
  } else {
    await button.click();
  }
  await (
    await chooser
  ).setFiles({ name: "usage.csv", mimeType: "text/csv", buffer: Buffer.from(content) });
}

async function drop(page: Page, label: string) {
  const data = await page.evaluateHandle((text) => {
    const data = new DataTransfer();
    data.items.add(new File([text], "usage.csv", { type: "text/csv" }));
    return data;
  }, csv);
  const button = page.getByRole("button", { name: label, exact: true });
  await button.dispatchEvent("dragover", { dataTransfer: data });
  await button.dispatchEvent("drop", { dataTransfer: data });
  await data.dispose();
}

try {
  for (const locale of ["ja-JP", "en-US"]) {
    const ja = locale === "ja-JP";
    const original = ja ? "CSVをここにドラッグ＆ドロップ" : "Drop a CSV here";
    const dummy = ja ? "ダミーCSVとして読み込む" : "Load as dummy CSV";
    const badge = ja ? "ダミーデータ" : "Dummy data";
    const reload = ja ? "別のCSVを読み込む" : "Load another CSV";
    const context = await browser.newContext({ locale, viewport: { width: 1400, height: 1000 } });
    await context.addInitScript(() => {
      Math.random = () => 0;
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("download", (download) => downloads.push(download.suggestedFilename()));
    await page.goto(server.url);
    await page.getByRole("heading", { name: original, exact: true }).waitFor();
    const originalBounds = await page
      .getByRole("button", { name: original, exact: true })
      .boundingBox();
    const dummyBounds = await page.getByRole("button", { name: dummy, exact: true }).boundingBox();
    assert(originalBounds && dummyBounds);
    assert(Math.abs(originalBounds.width / dummyBounds.width - 3) < 0.1);
    assert.equal(originalBounds.y, dummyBounds.y);
    await page.screenshot({ path: join(output, `import-${locale}.png`), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    const mobile = await page.getByRole("button", { name: dummy, exact: true }).boundingBox();
    assert(mobile && mobile.x >= 0 && mobile.x + mobile.width <= 375);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: join(output, `import-mobile-${locale}.png`), fullPage: true });
    await page.setViewportSize({ width: 1400, height: 1000 });

    // Original import preserves original values and does not display a dummy badge.
    await choose(page, original);
    await page.locator(".grid").first().waitFor();
    assert.equal(await page.locator(".cards .value").first().innerText(), "$13.00");
    assert((await page.locator("body").innerText()).includes("first@company.invalid"));
    assert.equal(await page.getByText(badge, { exact: true }).count(), 0);
    await page.getByRole("button", { name: reload, exact: true }).click();

    // Dummy import works via the keyboard, transforms before rendering, and performs no I/O.
    await page.evaluate(() => {
      location.hash = "user=first%40company.invalid";
    });
    const importRequests: string[] = [];
    page.on("request", (request) => importRequests.push(request.url()));
    await choose(page, dummy, true);
    await page.getByText(badge, { exact: true }).waitFor();
    assert.equal(await page.locator(".cards .value").first().innerText(), "$11.70");
    const body = await page.locator("body").innerText();
    assert(body.includes("sato@example.jp"));
    assert(body.includes("suzuki@example.jp"));
    assert(!body.includes("company.invalid"));
    assert(!body.includes("private-agent"));
    assert(!body.includes("private-automation"));
    assert(!page.url().includes("company.invalid"));
    assert(/bc-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/.test(body));
    assert.deepEqual(importRequests, []);
    await page.screenshot({ path: join(output, `dummy-overview-${locale}.png`), fullPage: true });
    await page.getByRole("button", { name: reload, exact: true }).click();
    assert.equal(await page.getByText(badge, { exact: true }).count(), 0);

    // Both drop targets use the same mode as their file picker.
    await drop(page, dummy);
    await page.getByText(badge, { exact: true }).waitFor();
    assert.equal(await page.locator(".cards .value").first().innerText(), "$11.70");
    await page.getByRole("button", { name: reload, exact: true }).click();
    await drop(page, original);
    await page.locator(".grid").first().waitFor();
    assert.equal(await page.locator(".cards .value").first().innerText(), "$13.00");
    assert.equal(await page.getByText(badge, { exact: true }).count(), 0);
    await page.getByRole("button", { name: reload, exact: true }).click();

    // Failed conversion never falls back to displaying original data and can be retried.
    await choose(page, dummy, false, "User,Cost\nprivate-secret,1");
    const errorText = ja
      ? "CSVをダミーデータに変換できませんでした。"
      : "Could not convert the CSV to dummy data.";
    await page.getByRole("alert").getByText(errorText, { exact: true }).waitFor();
    assert(!(await page.locator("body").innerText()).includes("private-secret"));
    await choose(page, dummy);
    await page.getByText(badge, { exact: true }).waitFor();
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(downloads, []);
  console.log(`Dashboard CSV import checks passed. Screenshots: ${output}`);
} finally {
  await browser.close();
  server.server.close();
}
