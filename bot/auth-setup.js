/**
 * Briefr Bot — Google Auth Setup
 * --------------------------------
 * Opens a REAL Chrome browser (your system install, not Playwright's Chromium)
 * so Google won't block the sign-in. Once you're signed in, press ENTER to
 * save the session cookies to auth.json.
 *
 * Usage:
 *   node auth-setup.js
 *
 * Requires: Google Chrome installed on this machine.
 */

import { chromium } from "playwright";
import { createInterface } from "readline";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, "auth.json");
const BOT_ENV_FILE = path.join(__dirname, ".env");

function upsertEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.trimEnd()}\n${line}\n`;
}

function refreshDockerAuthData() {
  const encodedAuth = fs.readFileSync(AUTH_FILE).toString("base64");
  const existing = fs.existsSync(BOT_ENV_FILE)
    ? fs.readFileSync(BOT_ENV_FILE, "utf-8")
    : "";
  const updated = upsertEnvValue(existing, "BOT_GOOGLE_AUTH_DATA", encodedAuth);
  fs.writeFileSync(BOT_ENV_FILE, updated, "utf-8");
}

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Briefr Bot — Google Account Login");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
  console.log("Opening REAL Chrome (not headless) to avoid Google's");
  console.log("automation detection...\n");

  // Use 'chrome' channel = your installed Google Chrome, which Google trusts.
  // Falls back to 'chromium' if Chrome isn't installed.
  let browser;
  let channel = "chrome";

  try {
    browser = await chromium.launch({
      channel: "chrome",   // Use system Chrome — Google allows sign-in here
      headless: false,
    });
    console.log("✓ Launched Google Chrome\n");
  } catch {
    console.log("Google Chrome not found, falling back to Chromium...");
    console.log("NOTE: Google may block sign-in — use Chrome if possible.\n");
    browser = await chromium.launch({ headless: false });
    channel = "chromium";
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  // Go directly to Google account sign-in
  await page.goto("https://accounts.google.com/signin/v2/identifier", {
    waitUntil: "domcontentloaded",
  });

  console.log("──────────────────────────────────────────────────────");
  console.log("  ACTION REQUIRED in the Chrome window:");
  console.log("");
  console.log("  1. Sign into the Google account the bot will use");
  console.log("     (a dedicated bot account is recommended)");
  console.log("  2. Complete any 2FA if prompted");
  console.log("  3. Wait until you see your Google account page");
  console.log("  4. Come back HERE and press ENTER");
  console.log("──────────────────────────────────────────────────────\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    rl.question("Press ENTER after signing in successfully → ", () => {
      rl.close();
      resolve();
    });
  });

  // Check we actually got cookies
  const cookies = await context.cookies();
  const googleCookies = cookies.filter(
    (c) => c.domain.includes("google.com") || c.domain.includes("accounts.google")
  );

  if (googleCookies.length < 5) {
    console.log(`\n⚠️  Only ${googleCookies.length} Google cookies found.`);
    console.log("   This suggests you may not be fully signed in.");
    console.log("   Try again and make sure you see your Google account homepage.");
    await browser.close();
    process.exit(1);
  }

  // Save the full session state (cookies + localStorage)
  await context.storageState({ path: AUTH_FILE });
  refreshDockerAuthData();

  console.log(`\n✓ Session saved to: ${AUTH_FILE}`);
  console.log(`  Total cookies: ${cookies.length} (Google: ${googleCookies.length})`);
  console.log(`  Docker auth data refreshed in: ${BOT_ENV_FILE}`);
  console.log("\nThe bot will load this refreshed session after its container is recreated.");
  console.log("Run: docker compose up -d --build --force-recreate bot");
  console.log("Re-run this script if the bot gets blocked again (sessions expire).\n");

  await browser.close();
}

main().catch((err) => {
  console.error("\n✗ Auth setup failed:", err.message);
  console.error("\nMake sure Google Chrome is installed.");
  process.exit(1);
});
