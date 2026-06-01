// Debug script: test what Garmin's SSO returns for these credentials
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
    .filter(([k]) => k)
);

const EMAIL = env.GARMIN_EMAIL;
const PASS = env.GARMIN_PASSWORD;

console.log(`Testing login for: ${EMAIL}`);
console.log(`Password length: ${PASS?.length ?? 0} chars`);

// Step 1: get CSRF token from Garmin SSO
const step1Url = "https://sso.garmin.com/sso/signin?id=gauth-widget&embedWidget=true&gauthHost=https://sso.garmin.com&locale=en&service=https://connect.garmin.com/modern/";
const step1 = await fetch(step1Url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
const step1Html = await step1.text();

const csrfMatch = step1Html.match(/name="_csrf"\s+value="([^"]+)"/);
if (!csrfMatch) {
  console.log("❌ Could not find CSRF token in Garmin SSO page");
  console.log("Response status:", step1.status);
  const titleMatch = step1Html.match(/<title>([^<]+)<\/title>/);
  console.log("Page title:", titleMatch?.[1] ?? "unknown");
  process.exit(1);
}

const csrf = csrfMatch[1];
console.log("✅ Got CSRF token");

// Step 2: post credentials
const step2 = await fetch(step1Url, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": step1Url,
  },
  body: new URLSearchParams({
    username: EMAIL,
    password: PASS,
    embed: "true",
    _csrf: csrf,
  }),
  redirect: "manual",
});

const step2Html = await step2.text();
const titleMatch = step2Html.match(/<title>([^<]+)<\/title>/);
console.log("POST response status:", step2.status);
console.log("POST page title:", titleMatch?.[1] ?? "unknown");

if (step2Html.includes("ticket=")) {
  console.log("✅ Ticket found — credentials are correct!");
} else if (step2Html.includes("MFA") || step2Html.includes("mfa") || step2Html.includes("verification") || step2Html.includes("authenticator")) {
  console.log("🔐 MFA page detected — two-factor auth is enabled");
} else if (step2Html.includes("Invalid") || step2Html.includes("incorrect") || step2Html.includes("FAIL")) {
  console.log("❌ Invalid credentials");
} else {
  console.log("⚠️  Unknown response. First 500 chars:");
  console.log(step2Html.slice(0, 500));
}
