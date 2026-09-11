import assert from "node:assert/strict";
import { mkdtemp, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";

import { parseUsageCsv } from "../src/core/parse.ts";
import { startServer } from "../src/server/index.ts";

const csv = `Date,User,Model,Cost,Kind,Total Tokens,Cloud Agent ID
2026-08-14T08:00:00Z,alice,claude-opus-4-6,3,Included,1000000,agent-a
2026-08-14T09:00:00Z,bob,auto,2,Included,500000,agent-b
2026-08-16T10:00:00Z,alice,claude-opus-4-6-fast,4,Included,800000,agent-a
2026-08-17T10:00:00Z,bob,auto,0,"Errored, No Charge",0,
`;
const output = await mkdtemp(join(tmpdir(), "cursor-usage-language-"));
const csvPath = join(output, "usage.csv");
await writeFile(csvPath, csv);
const server = await startServer({ port: 0 });
const browser = await chromium.launch(
  process.env.CHROME_PATH
    ? { headless: true, executablePath: process.env.CHROME_PATH }
    : { headless: true, channel: process.env.PLAYWRIGHT_CHROME_CHANNEL ?? "chrome" },
);
const errors: string[] = [];

async function openPage(preferences: string[], saved?: string, blocked = false) {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    locale: "en-US",
  });
  await context.addInitScript(
    ({ preferences, saved, blocked }) => {
      Object.defineProperty(navigator, "languages", { get: () => preferences });
      if (saved) localStorage.setItem("cursor-usage.language", saved);
      if (blocked)
        Object.defineProperty(window, "localStorage", {
          get: () => {
            throw new Error("Storage blocked");
          },
        });
    },
    { preferences, saved, blocked },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.url);
  await page.locator(".dropzone").waitFor();
  return page;
}
async function switchTo(page: Page, language: "日本語" | "English") {
  await page.getByRole("button", { name: "言語 / Language", exact: true }).click();
  await page.getByRole("button", { name: language, exact: true }).click();
  assert.equal(
    await page.locator("html").getAttribute("lang"),
    language === "English" ? "en" : "ja",
  );
}
async function upload(page: Page) {
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  await page.locator(".grid").first().waitFor();
}
try {
  for (const [preferences, saved, expected] of [
    [["ja-JP", "en-US"], undefined, "ja"],
    [["en-US", "ja-JP"], undefined, "en"],
    [["fr-FR", "ja-JP"], undefined, "ja"],
    [["fr-FR"], undefined, "en"],
    [["ja-JP"], "en", "en"],
    [["ja-JP"], "invalid", "ja"],
  ] as const) {
    const page = await openPage([...preferences], saved);
    assert.equal(await page.locator("html").getAttribute("lang"), expected);
    await page.context().close();
  }
  const page = await openPage(["ja-JP", "en-US"]);
  const toggle = page.getByRole("button", { name: "言語 / Language", exact: true });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "日本語✓");
  await page.keyboard.press("Escape");
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert(await toggle.evaluate((element) => element === document.activeElement));
  await toggle.click();
  await page.locator("h1").click();
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");

  await page.locator('input[type="file"]').setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("User,Model,Cost\nalice,auto,1"),
  });
  await page.getByText("CSVに必須列「Date」がありません。", { exact: false }).waitFor();
  await switchTo(page, "English");
  await page.getByText('Invalid CSV: missing column "Date".', { exact: false }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Drop a CSV here" }).waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  await upload(page);
  await page.getByText("Total Spend", { exact: true }).waitFor();
  assert.equal(await page.locator(".cards .value").first().innerText(), "$9.00");
  assert((await page.locator("body").innerText()).includes("No Charge Events excluded: 1"));
  assert((await page.locator("body").innerText()).includes("Fri"));
  assert(!/[ぁ-んァ-ヶ一-龠]/.test(await page.locator("body").innerText()));
  await page
    .locator(".cloud-agent-chart .recharts-rectangle:not(.recharts-tooltip-cursor)")
    .first()
    .hover();
  await page.locator(".cloud-agent-tooltip:visible").getByText("User", { exact: true }).waitFor();
  assert((await page.locator(".cloud-agent-tooltip:visible").innerText()).includes("agent-a"));
  await page.mouse.move(0, 0);
  await page.screenshot({ path: join(output, "overview-en.png"), fullPage: true });
  await switchTo(page, "日本語");
  assert.equal(await page.locator(".cards .value").first().innerText(), "$9.00");
  assert((await page.locator("body").innerText()).includes("金"));
  assert(
    !/\b(Spend|Tokens|Daily Window|Effective Rate)\b/.test(await page.locator("body").innerText()),
  );
  await page
    .locator(".cloud-agent-chart .recharts-rectangle:not(.recharts-tooltip-cursor)")
    .first()
    .hover();
  await page
    .locator(".cloud-agent-tooltip:visible")
    .getByText("ユーザー", { exact: true })
    .waitFor();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: join(output, "overview-ja.png"), fullPage: true });
  await toggle.click();
  await page.screenshot({
    path: join(output, "language-menu.png"),
    clip: { x: 930, y: 0, width: 470, height: 180 },
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 375, height: 812 });
  await toggle.click();
  const bounds = await page.locator(".language-options").boundingBox();
  assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 375);
  await page.screenshot({ path: join(output, "mobile-ja.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1400, height: 1000 });

  await page.getByRole("button", { name: "金額を隠す", exact: true }).click();
  await page.getByRole("button", { name: "alice", exact: true }).first().click();
  const sector = page.locator(".recharts-pie-sector").first();
  const sectorBounds = await sector.boundingBox();
  assert(sectorBounds);
  await sector.click({ position: { x: sectorBounds.width * 0.85, y: sectorBounds.height * 0.5 } });
  await page.getByRole("button", { name: "モデルファミリーへ戻る", exact: true }).waitFor();
  const url = page.url();
  await switchTo(page, "English");
  assert.equal(page.url(), url);
  await page.getByText("Selected User: alice", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Back to Model Families", exact: true }).waitFor();
  assert.equal(await page.locator(".cards .value").first().innerText(), "***");
  await page.getByRole("button", { name: "Show Spend", exact: true }).waitFor();

  await page.evaluate(() => {
    location.hash = "daily-window=2026-08-14&user=alice&timezone=UTC&start-hour=5";
  });
  await page.getByRole("heading", { name: "2026-08-14", exact: true }).waitFor();
  await page.getByText("Spend by Hour (UTC)", { exact: true }).waitFor();
  const dailyUrl = page.url();
  await switchTo(page, "日本語");
  assert.equal(page.url(), dailyUrl);
  await page.getByText("時間帯別支出 (UTC)", { exact: true }).waitFor();
  assert.equal(await page.locator(".cards .value").first().innerText(), "***");
  await page.screenshot({ path: join(output, "daily-ja.png"), fullPage: true });
  await page.getByRole("button", { name: "別のCSVを読み込む", exact: true }).click();
  await page.getByRole("heading", { name: "CSVをここにドラッグ＆ドロップ" }).waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "ja");
  await page.context().close();

  const blocked = await openPage(["ja-JP"], undefined, true);
  await switchTo(blocked, "English");
  await upload(blocked);
  await blocked.getByText("Total Spend", { exact: true }).waitFor();
  await blocked.context().close();

  // Screenshot injection overrides browser and saved preferences, and hides controls.
  const shotContext = await browser.newContext({ locale: "ja-JP" });
  await shotContext.addInitScript(
    (events) => {
      localStorage.setItem("cursor-usage.language", "ja");
      Object.assign(window, {
        __CURSOR_USAGE_EVENTS__: events,
        __CURSOR_USAGE_LANGUAGE__: "en",
        __CURSOR_USAGE_SCREENSHOT__: true,
      });
    },
    parseUsageCsv(csv).map((event) => ({ ...event, date: event.date.toISOString() })),
  );
  const shot = await shotContext.newPage();
  await shot.goto(server.url);
  await shot.getByText("Total Spend", { exact: true }).waitFor();
  assert.equal(await shot.locator("html").getAttribute("lang"), "en");
  assert.equal(await shot.getByRole("button", { name: "言語 / Language", exact: true }).count(), 0);
  await shotContext.close();

  for (const command of ["screenshot", "daily-report"]) {
    const invalid = Bun.spawn(["bun", "src/cli/index.ts", command, csvPath, "--lang", "fr"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    assert.equal(await invalid.exited, 1);
    assert((await new Response(invalid.stderr).text()).includes("invalid --lang value: fr"));
  }
  for (const language of ["ja", "en"]) {
    const path = join(output, `export-${language}.png`);
    const command = Bun.spawn(
      ["bun", "src/cli/index.ts", "screenshot", csvPath, "--lang", language, "--out", path],
      { stdout: "pipe", stderr: "pipe" },
    );
    assert.equal(await command.exited, 0, await new Response(command.stderr).text());
    assert((await stat(path)).size > 0);
  }
  const dailyReport = Bun.spawn(
    ["bun", join(process.cwd(), "dist/cli.js"), "daily-report", csvPath, "--lang", "ja"],
    { cwd: output, stdout: "pipe", stderr: "pipe" },
  );
  assert.equal(await dailyReport.exited, 0, await new Response(dailyReport.stderr).text());
  assert((await stat(join(output, "daily-report.png"))).size > 0);
  assert.deepEqual(errors, []);
  console.log(`Dashboard language browser checks passed. Screenshots: ${output}`);
} finally {
  await browser.close();
  server.server.close();
}
