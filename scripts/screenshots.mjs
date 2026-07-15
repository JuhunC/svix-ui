// Capture screenshots of the running svix-ui for the "screenshots on new image"
// CI workflow. Drives a real browser (Playwright) against a running instance
// seeded with an application, event types, and an endpoint.
//
//   SVIX_UI_URL   base URL of the running svix-ui (default http://localhost:3000)
//   SVIX_UI_OPERATOR_USERNAME / _PASSWORD   operator login
//   APP_UID       uid of the seeded application (default "demo")
//   OUT_DIR       output directory (default "screenshots")
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = (process.env.SVIX_UI_URL || "http://localhost:3000").replace(/\/$/, "");
const USER = process.env.SVIX_UI_OPERATOR_USERNAME || "admin";
const PASS = process.env.SVIX_UI_OPERATOR_PASSWORD || "password123";
const APP_UID = process.env.APP_UID || "demo";
const OUT_DIR = process.env.OUT_DIR || "screenshots";

const shots = [];
let failures = 0;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  async function shot(name, url, waitText) {
    try {
      await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 30000 });
      if (waitText) {
        await page.getByText(waitText, { exact: false }).first().waitFor({ timeout: 10000 }).catch(() => {});
      }
      await page.waitForTimeout(600);
      const file = `${OUT_DIR}/${name}.png`;
      await page.screenshot({ path: file, fullPage: true });
      shots.push(file);
      console.log(`captured ${file}`);
    } catch (e) {
      failures++;
      console.error(`FAILED ${name} (${url}): ${e.message}`);
    }
  }

  // --- Login page, then authenticate --------------------------------------
  await shot("01-login", "/login", "Sign in");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[autocomplete="username"]', USER).catch(async () => {
    await page.locator("input").first().fill(USER);
  });
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL(/\/console/, { timeout: 15000 }).catch(() => {}),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  await page.waitForTimeout(800);

  // --- Console (operator) --------------------------------------------------
  await shot("02-console-overview", "/console", "Operator console");
  await shot("03-applications", "/console/applications", "Applications");
  await shot("04-application-detail", `/console/applications/${APP_UID}`, "Endpoints");
  await shot("05-event-types", "/console/event-types", "Event types");
  await shot("06-guide", "/console/guide", "Webhook reference");

  // First endpoint detail (id resolved from the BFF, using the session cookie).
  try {
    const res = await context.request.get(
      `${BASE}/api/admin/apps/${APP_UID}/endpoints?limit=1`,
    );
    const epId = (await res.json())?.data?.[0]?.id;
    if (epId) await shot("07-endpoint-detail", `/console/applications/${APP_UID}/endpoints/${epId}`, "Overview");
  } catch (e) {
    console.error(`endpoint detail lookup failed: ${e.message}`);
  }

  // --- Consumer portal (via an app-wide magic link) ------------------------
  try {
    const mint = await context.request.post(
      `${BASE}/api/admin/apps/${APP_UID}/portal-link`,
      { data: {} },
    );
    const body = await mint.json();
    const q = new URLSearchParams({
      token: String(body.token),
      app: String(body.app),
      exp: String(body.exp),
    });
    await page.goto(`${BASE}/portal/launch?${q.toString()}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await shot("08-portal-endpoints", "/portal/endpoints", "Endpoints");
    await shot("09-portal-catalog", "/portal/catalog", "Event catalog");
    await shot("10-portal-activity", "/portal/activity", "Activity");
    await shot("11-portal-guide", "/portal/guide", "Webhook reference");
  } catch (e) {
    console.error(`portal screenshots failed: ${e.message}`);
  }

  await browser.close();
  console.log(`\ncaptured ${shots.length} screenshots, ${failures} failures`);
  // Don't fail the job for a flaky single page as long as we got a useful set.
  if (shots.length < 5) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
