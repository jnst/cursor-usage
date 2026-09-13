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

async function waitForDummy(page: Page) {
  await page.waitForFunction(() => {
    const toggle = document.querySelector(".dummy-data-toggle");
    return (
      toggle?.getAttribute("aria-pressed") === "true" &&
      toggle.getAttribute("aria-disabled") === "false"
    );
  });
  await page.locator(".dummy-data-loading").waitFor({ state: "detached" });
}

function installCounters() {
  Math.random = () => 0;
  Reflect.set(window, "uuidCalls", 0);
  Reflect.set(window, "dateFormats", 0);
  const formatToParts = Intl.DateTimeFormat.prototype.formatToParts;
  Intl.DateTimeFormat.prototype.formatToParts = function (...args) {
    Reflect.set(window, "dateFormats", Reflect.get(window, "dateFormats") + 1);
    return formatToParts.apply(this, args);
  };
  Reflect.set(window, "loadingFrames", 0);
  Reflect.set(window, "unpaintedConversions", 0);
  const frame = () => {
    if (document.querySelector(".dummy-data-loading[open]")) {
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

async function checkHeaderTooltips(page: Page, labels: string[]) {
  for (const label of labels) {
    const button = page.getByRole("button", { name: label, exact: true });
    const tooltip = page.getByRole("tooltip");
    await button.hover();
    await tooltip.waitFor();
    assert.equal(await tooltip.innerText(), label);
    const anchor = await button.boundingBox();
    const popup = await tooltip.boundingBox();
    assert(anchor && popup);
    assert(Math.abs(anchor.x + anchor.width / 2 - popup.x - popup.width / 2) < 1);
    assert.equal(await button.getAttribute("title"), null, "avoid duplicate native tooltips");
    assert.equal(await button.getAttribute("aria-describedby"), await tooltip.getAttribute("id"));
    await tooltip.hover();
    await page.waitForTimeout(180);
    assert(await tooltip.isVisible(), "help remains readable while the pointer is over it");
    await page.keyboard.press("Escape");
    await tooltip.waitFor({ state: "hidden" });

    await page.mouse.move(0, 0);
    await button.focus();
    await tooltip.waitFor();
    assert.equal(await tooltip.innerText(), label);
    await page.keyboard.press("Escape");
    await tooltip.waitFor({ state: "hidden" });
    assert(await button.evaluate((element) => document.activeElement === element));
  }
  await page.locator("h1").click();
}

try {
  for (const locale of ["ja-JP", "en-US"]) {
    const ja = locale === "ja-JP";
    const original = ja ? "CSVをここにドラッグ＆ドロップ" : "Drop a CSV here";
    const toggleName = ja ? "ダミーデータを表示" : "Show dummy data";
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
    assert.equal(
      await page.locator('.dataset-view[data-active="true"] .cards .value').first().innerText(),
      "$13.00",
    );
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

    await checkHeaderTooltips(page, ["言語 / Language", hide, toggleName]);
    await page.setViewportSize({ width: 375, height: 812 });
    await toggle.hover();
    const tooltip = page.getByRole("tooltip");
    await tooltip.waitFor();
    const tooltipBounds = await tooltip.boundingBox();
    assert(tooltipBounds && tooltipBounds.x >= 8 && tooltipBounds.x + tooltipBounds.width <= 367);
    await page.screenshot({ path: join(output, `tooltip-mobile-${locale}.png`) });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.mouse.move(0, 0);

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
    const loading = page.getByRole("dialog", { name: preparing, exact: true });
    await loading.waitFor();
    assert.equal(await page.getByRole("tooltip").count(), 0);
    assert(await loading.evaluate((dialog) => dialog.contains(document.activeElement)));
    const loadingBounds = await loading.boundingBox();
    assert(loadingBounds);
    assert(Math.abs(loadingBounds.x + loadingBounds.width / 2 - 700) < 2);
    assert(Math.abs(loadingBounds.y + loadingBounds.height / 2 - 500) < 2);
    await page.keyboard.press("Tab");
    assert(
      await loading.evaluate(
        (dialog) =>
          dialog.contains(document.activeElement) || document.activeElement === document.body,
      ),
      "Tab may reach browser chrome, but must not focus the background page",
    );
    await page.keyboard.press("Escape");
    assert(await loading.isVisible(), "Escape must not unblock an unfinished conversion");
    const beforeBlockedClick = page.url();
    await page.mouse.click(
      costBounds.x + costBounds.width / 2,
      costBounds.y + costBounds.height / 2,
    );
    assert.equal(page.url(), beforeBlockedClick);
    assert.equal(await page.getByRole("button", { name: show, exact: true }).count(), 0);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.documentElement).overflow),
      "hidden",
    );
    await page.screenshot({ path: join(output, `loading-${locale}.png`) });
    await page.setViewportSize({ width: 375, height: 812 });
    const mobileLoading = await loading.boundingBox();
    assert(mobileLoading && mobileLoading.x >= 0 && mobileLoading.x + mobileLoading.width <= 375);
    assert(Math.abs(mobileLoading.y + mobileLoading.height / 2 - 406) < 2);
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".loading-spinner")
        .evaluate((spinner) => getComputedStyle(spinner).animationDuration),
      "6s",
    );
    await page.screenshot({ path: join(output, `loading-mobile-${locale}.png`) });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1400, height: 1000 });
    assert.equal(await calls(page), 0);
    await page.evaluate(() => {
      location.hash =
        "daily-window=2026-08-14&user=first%40company.invalid&timezone=UTC&start-hour=5";
    });
    await page.locator(".daily-window-title h2").waitFor();
    release();
    await waitForDummy(page);
    assert.equal(await toggle.getAttribute("aria-pressed"), "true");
    assert.equal(await toggle.getAttribute("aria-disabled"), "false");
    assert(await toggle.evaluate((button) => button === document.activeElement));
    assert.equal(await page.locator(".dummy-data-label").count(), 0);
    assert.equal(
      await page
        .locator(".header")
        .getByText(ja ? "ダミーデータ" : "Dummy data", { exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.locator('.dataset-view[data-active="true"] .cards .value').first().innerText(),
      "$11.70",
    );
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

    // Restore exact originals without replacing the prepared chart DOM.
    const chartNodes = await page
      .locator(".dataset-view .recharts-bar-rectangle path")
      .elementHandles();
    assert(chartNodes.length > 0);
    await page.evaluate(() => Reflect.set(window, "dateFormats", 0));
    // Subsequent activations reuse the same values and IDs.
    await toggle.click();
    assert.equal(
      await page.locator('.dataset-view[data-active="true"] .cards .value').first().innerText(),
      "$13.00",
    );
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    assert((await page.locator("body").innerText()).includes("first@company.invalid"));
    await page.evaluate(() => {
      Math.random = () => 0.99;
    });
    await toggle.click();
    assert.equal(
      await page.locator('.dataset-view[data-active="true"] .cards .value').first().innerText(),
      "$11.70",
    );
    assert((await page.locator("body").innerText()).includes(id));
    assert.equal(await calls(page), 2);
    assert.equal(requests.filter((url) => url.endsWith(lazyAsset)).length, 1);
    assert(
      (
        await Promise.all(chartNodes.map((node) => node.evaluate((element) => element.isConnected)))
      ).every(Boolean),
      "cached mode switches must retain chart DOM",
    );
    for (const node of chartNodes) await node.dispose();
    assert.equal(
      await page.evaluate(() => Reflect.get(window, "dateFormats")),
      0,
      "cached views must not render event timestamps again",
    );
    assert.equal(
      await page.getByRole("button", { name: "first@company.invalid", exact: true }).count(),
      0,
      "the inactive view must not expose original User controls",
    );
    await toggle.focus();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement?.closest("[inert]") !== null),
        false,
      );
    }
    await toggle.focus();

    // A tooltip must disappear with its dataset, even if the pointer stays put.
    await page
      .locator('.dataset-view[data-active="true"] .cloud-agent-chart .recharts-bar-rectangle')
      .first()
      .hover();
    await page.locator('.dataset-view[data-active="true"] .cloud-agent-tooltip').waitFor();
    await toggle.evaluate((button) => (button as HTMLButtonElement).click());
    assert(!(await page.locator("body").innerText()).includes("sato@example.jp"));
    await toggle.click();

    // Spend visibility and dummy display are independent.
    await page.getByRole("button", { name: hide, exact: true }).click();
    await page.mouse.move(0, 0);
    await page.getByRole("button", { name: show, exact: true }).hover();
    await page.getByRole("tooltip").waitFor();
    assert.equal(await page.getByRole("tooltip").innerText(), show);
    await page.keyboard.press("Escape");
    await toggle.click();
    assert.equal(
      await page.locator('.dataset-view[data-active="true"] .cards .value').first().innerText(),
      "***",
    );
    await toggle.click();
    assert.equal(
      await page.locator('.dataset-view[data-active="true"] .cards .value').first().innerText(),
      "***",
    );
    await page.getByRole("button", { name: show, exact: true }).click();
    assert.equal(
      await page.locator('.dataset-view[data-active="true"] .cards .value').first().innerText(),
      "$11.70",
    );
    await page.setViewportSize({ width: 375, height: 812 });
    const mobile = await toggle.boundingBox();
    assert(mobile && mobile.x >= 0 && mobile.x + mobile.width <= 375);
    await toggle.click();
    // ResizeObserver updates a retained chart after it becomes visible.
    await page.waitForFunction(() => {
      const chart = document.querySelector('.dataset-view[data-active="true"] .recharts-surface');
      const width = chart?.getBoundingClientRect().width ?? 0;
      return width > 0 && width <= window.innerWidth;
    });
    const resizedChart = await page
      .locator('.dataset-view[data-active="true"] .recharts-surface')
      .first()
      .boundingBox();
    assert(resizedChart && resizedChart.width > 0 && resizedChart.width <= 375);
    await toggle.click();
    await page.screenshot({ path: join(output, `dummy-mobile-${locale}.png`), fullPage: true });
    await page.setViewportSize({ width: 1400, height: 1000 });

    // Loading a CSV again resets the mode and invalidates the old cache.
    await page.getByRole("button", { name: reload, exact: true }).click();
    await drop(page, original);
    await page.locator(".grid").first().waitFor();
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    assert.equal(await calls(page), 2);
    assert.equal(
      await page.locator('.dataset-view[data-active="true"] .cards .value').first().innerText(),
      "$13.00",
    );
    await page.evaluate(() => Reflect.set(window, "loadingFrames", 0));
    await toggle.click();
    await waitForDummy(page);
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
    assert.equal(
      await page.locator('.dataset-view[data-active="true"] .cards .value').first().innerText(),
      "$7.00",
    );
    await page.getByRole("button", { name: reload, exact: true }).click();
    await choose(page, original);
    await toggle.click();
    await waitForDummy(page);
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
  // Programmatic replacement exercises stale-result protection; native user
  // interaction with this background control is blocked by the modal.
  await page
    .getByRole("button", { name: "Load another CSV", exact: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
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
  assert.equal(
    await page.locator('.dataset-view[data-active="true"] .cards .value').first().innerText(),
    "$28.00",
  );
  assert.equal(await calls(page), 0);
  await page.getByRole("button", { name: "Show dummy data", exact: true }).click();
  await waitForDummy(page);
  assert.equal(
    await page.locator('.dataset-view[data-active="true"] .cards .value').first().innerText(),
    "$25.20",
  );
  await context.close();

  assert.deepEqual(errors, []);
  assert.deepEqual(downloads, []);
  console.log(`Dashboard dummy toggle checks passed. Screenshots: ${output}`);
} finally {
  await browser.close();
  server.server.close();
}
