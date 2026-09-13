import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";

import { startServer } from "../src/server/index.ts";

const csv = `Date,User,Model,Cost,Kind,Total Tokens,Cloud Agent ID,Automation ID
2026-08-14T08:00:00Z,first@company.invalid,auto,5,On-Demand,1000,bc-private-agent,private-automation
2026-08-14T09:00:00Z,second@company.invalid,auto,8,On-Demand,2000,bc-private-agent,private-automation
2026-08-14T10:00:00Z,N/A,auto,Free,On-Demand,,,
`;
const output = await mkdtemp(join(tmpdir(), "cursor-usage-dummy-"));
const jsFiles = (await readdir("dist/web")).filter((file) => file.endsWith(".js"));
const lazyAsset = (
  await Promise.all(
    jsFiles.map(async (file) => ({ file, text: await readFile(join("dist/web", file), "utf8") })),
  )
).find(({ text }) => text.includes("Invalid CSV: invalid User email at row"))?.file;
assert(lazyAsset, "sanitization must have a separate lazy bundle");
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

function installCounters() {
  Math.random = () => 0;
  Reflect.set(window, "uuidCalls", 0);
  Reflect.set(window, "loadingFrames", 0);
  Reflect.set(window, "unpaintedConversions", 0);
  const frame = () => {
    if (document.querySelector(".dummy-data-status")) {
      Reflect.set(window, "loadingFrames", Reflect.get(window, "loadingFrames") + 1);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const randomUUID = crypto.randomUUID.bind(crypto);
  crypto.randomUUID = () => {
    if (Reflect.get(window, "loadingFrames") === 0) {
      Reflect.set(window, "unpaintedConversions", Reflect.get(window, "unpaintedConversions") + 1);
    }
    Reflect.set(window, "uuidCalls", Reflect.get(window, "uuidCalls") + 1);
    return randomUUID();
  };
}
const calls = (page: Page) => page.evaluate(() => Reflect.get(window, "uuidCalls") as number);

try {
  for (const locale of ["ja-JP", "en-US"]) {
    const ja = locale === "ja-JP";
    const original = ja ? "CSVをここにドラッグ＆ドロップ" : "Drop a CSV here";
    const toggleName = ja ? "ダミーデータを表示" : "Show dummy data";
    const badge = ja ? "ダミーデータ" : "Dummy data";
    const preparing = ja ? "ダミーデータを準備中…" : "Preparing dummy data…";
    const reload = ja ? "別のCSVを読み込む" : "Load another CSV";
    const hide = ja ? "金額を隠す" : "Hide Spend";
    const show = ja ? "金額を表示" : "Show Spend";
    const context = await browser.newContext({ locale, viewport: { width: 1400, height: 1000 } });
    await context.addInitScript(installCounters);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("download", (download) => downloads.push(download.suggestedFilename()));
    const requests: string[] = [];
    page.on("request", (request) => {
      assert.equal(request.method(), "GET");
      assert.equal(request.postData(), null);
      requests.push(request.url());
    });
    await page.goto(server.url);
    await page.getByRole("heading", { name: original, exact: true }).waitFor();
    assert.equal(await page.locator(".dropzone").count(), 1);
    const toggle = page.getByRole("button", { name: toggleName, exact: true });
    assert.equal(await toggle.count(), 0);
    const bounds = await page.locator(".dropzone").boundingBox();
    assert(bounds && bounds.width > 1300);
    await page.screenshot({ path: join(output, `import-${locale}.png`), fullPage: true });

    await choose(page, original, true);
    await page.locator(".grid").first().waitFor();
    assert.equal(await page.locator(".cards .value").first().innerText(), "$13.00");
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    assert.equal(await calls(page), 0, "initial rendering must not generate dummy IDs");
    assert(
      !requests.some((url) => url.endsWith(lazyAsset)),
      "initial rendering must not load the transformation",
    );
    const costBounds = await page.getByRole("button", { name: hide, exact: true }).boundingBox();
    const dummyBounds = await toggle.boundingBox();
    assert(costBounds && dummyBounds);
    assert.equal(costBounds.y, dummyBounds.y);
    assert(dummyBounds.x > costBounds.x && dummyBounds.x - costBounds.x - costBounds.width < 16);

    // Hold the first module request to check progress, focus, and delayed work.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/${lazyAsset}`, async (route) => {
      await gate;
      await route.continue();
    });
    const requested = page.waitForRequest((request) => request.url().endsWith(lazyAsset));
    await toggle.focus();
    await page.keyboard.press("Enter");
    await requested;
    await page.getByRole("status").getByText(preparing, { exact: true }).waitFor();
    assert.equal(await toggle.getAttribute("aria-disabled"), "true");
    assert(await toggle.evaluate((button) => button === document.activeElement));
    assert.equal(await calls(page), 0);
    await page.evaluate(() => {
      location.hash =
        "daily-window=2026-08-14&user=first%40company.invalid&timezone=UTC&start-hour=5";
    });
    await page.getByRole("heading", { name: "2026-08-14", exact: true }).waitFor();
    release();
    await page.getByText(badge, { exact: true }).waitFor();
    assert.equal(await toggle.getAttribute("aria-pressed"), "true");
    assert.equal(await toggle.getAttribute("aria-disabled"), "false");
    assert.equal(await page.locator(".cards .value").first().innerText(), "$11.70");
    assert.equal(await calls(page), 2);
    const body = await page.locator("body").innerText();
    assert(body.includes("sato@example.jp"));
    assert(body.includes("suzuki@example.jp"));
    assert(!body.includes("company.invalid"));
    assert(!body.includes("private-agent"));
    const id = body.match(
      /bc-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/,
    )?.[0];
    assert(id);
    const params = new URLSearchParams(new URL(page.url()).hash.slice(1));
    assert.equal(params.get("daily-window"), "2026-08-14");
    assert.equal(params.get("timezone"), "UTC");
    assert.equal(params.get("start-hour"), "5");
    assert(!params.has("user"));
    await page.screenshot({ path: join(output, `dummy-${locale}.png`), fullPage: true });

    // Restore exact originals; subsequent activations reuse the same values and IDs.
    await toggle.click();
    assert.equal(await page.locator(".cards .value").first().innerText(), "$13.00");
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    assert((await page.locator("body").innerText()).includes("first@company.invalid"));
    await page.evaluate(() => {
      Math.random = () => 0.99;
    });
    await toggle.click();
    assert.equal(await page.locator(".cards .value").first().innerText(), "$11.70");
    assert((await page.locator("body").innerText()).includes(id));
    assert.equal(await calls(page), 2);
    assert.equal(requests.filter((url) => url.endsWith(lazyAsset)).length, 1);

    // Spend visibility and dummy display are independent.
    await page.getByRole("button", { name: hide, exact: true }).click();
    await toggle.click();
    assert.equal(await page.locator(".cards .value").first().innerText(), "***");
    await toggle.click();
    assert.equal(await page.locator(".cards .value").first().innerText(), "***");
    await page.getByRole("button", { name: show, exact: true }).click();
    assert.equal(await page.locator(".cards .value").first().innerText(), "$11.70");
    await page.setViewportSize({ width: 375, height: 812 });
    const mobile = await toggle.boundingBox();
    assert(mobile && mobile.x >= 0 && mobile.x + mobile.width <= 375);
    await page.screenshot({ path: join(output, `dummy-mobile-${locale}.png`), fullPage: true });
    await page.setViewportSize({ width: 1400, height: 1000 });

    // Loading a CSV again resets the mode and invalidates the old cache.
    await page.getByRole("button", { name: reload, exact: true }).click();
    await drop(page, original);
    await page.locator(".grid").first().waitFor();
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    assert.equal(await calls(page), 2);
    assert.equal(await page.locator(".cards .value").first().innerText(), "$13.00");
    await page.evaluate(() => Reflect.set(window, "loadingFrames", 0));
    await toggle.click();
    await page.getByText(badge, { exact: true }).waitFor();
    assert.equal(await calls(page), 4);
    assert.equal(
      await page.evaluate(() => Reflect.get(window, "unpaintedConversions")),
      0,
      "loading feedback must receive a frame before conversion, even with a cached module",
    );
    assert(!(await page.locator("body").innerText()).includes(id));

    // A failed conversion leaves original data intact and shows a localized error.
    await page.getByRole("button", { name: reload, exact: true }).click();
    await choose(
      page,
      original,
      false,
      "Date,User,Model,Cost\n2026-08-14T08:00:00Z,not-an-email,auto,7",
    );
    await toggle.click();
    const error = ja
      ? "CSVをダミーデータに変換できませんでした。"
      : "Could not convert the CSV to dummy data.";
    await page.getByRole("alert").getByText(error, { exact: true }).waitFor();
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    assert.equal(await toggle.getAttribute("aria-disabled"), "false");
    assert.equal(await page.locator(".cards .value").first().innerText(), "$7.00");
    await page.getByRole("button", { name: reload, exact: true }).click();
    await choose(page, original);
    await toggle.click();
    await page.getByText(badge, { exact: true }).waitFor();
    assert.equal(await page.getByRole("alert").count(), 0);
    assert(requests.every((url) => url.startsWith(server.url)));
    await context.close();
  }

  // Replacing the CSV while a lazy import is pending must not activate stale data.
  const context = await browser.newContext({ locale: "en-US" });
  await context.addInitScript(installCounters);
  const page = await context.newPage();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/${lazyAsset}`, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(server.url);
  await choose(page, "Drop a CSV here");
  const requested = page.waitForRequest((request) => request.url().endsWith(lazyAsset));
  await page.getByRole("button", { name: "Show dummy data", exact: true }).click();
  await requested;
  await page.getByRole("button", { name: "Load another CSV", exact: true }).click();
  await choose(page, "Drop a CSV here", false, csv.replace(",5,On-Demand", ",20,On-Demand"));
  const received = page.waitForResponse((response) => response.url().endsWith(lazyAsset));
  release();
  await (await received).finished();
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
  assert.equal(
    await page
      .getByRole("button", { name: "Show dummy data", exact: true })
      .getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(await page.locator(".cards .value").first().innerText(), "$28.00");
  assert.equal(await calls(page), 0);
  await page.getByRole("button", { name: "Show dummy data", exact: true }).click();
  await page.getByText("Dummy data", { exact: true }).waitFor();
  assert.equal(await page.locator(".cards .value").first().innerText(), "$25.20");
  await context.close();

  assert.deepEqual(errors, []);
  assert.deepEqual(downloads, []);
  console.log(`Dashboard dummy toggle checks passed. Screenshots: ${output}`);
} finally {
  await browser.close();
  server.server.close();
}
