// Run once locally to authenticate with Garmin and save tokens to Supabase.
// Usage: node scripts/garmin-auth.mjs
//
// Uses the package's internal axios instance throughout so cookies/state are shared.

import { GarminConnect } from "@flow-js/garmin-connect";
import { createClient } from "@supabase/supabase-js";
import OAuth from "oauth-1.0a";
import crypto from "crypto";
import qs from "qs";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
    .filter(([k]) => k)
);

const EMAIL = env.GARMIN_EMAIL;
const PASS = env.GARMIN_PASSWORD;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;

if (!EMAIL || !PASS) {
  console.error("Missing GARMIN_EMAIL or GARMIN_PASSWORD in .env.local");
  process.exit(1);
}

const UA_BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const UA_MOBILE = "com.garmin.android.apps.connectmobile";
const OAUTH_CONSUMER_URL = "https://thegarth.s3.amazonaws.com/oauth_consumer.json";

console.log(`Authenticating as ${EMAIL}...`);

// Create GarminConnect instance to get the url helpers and internal axios client
const gc = new GarminConnect({ username: EMAIL, password: PASS });
const httpClient = gc.client;
const axiosClient = httpClient.client; // raw axios instance (preserves cookies)
const url = httpClient.url;

// Step 1: Fetch garth OAuth consumer credentials
const consumerResp = await axiosClient.get(OAUTH_CONSUMER_URL);
const consumer = { key: consumerResp.data.consumer_key, secret: consumerResp.data.consumer_secret };
httpClient.OAUTH_CONSUMER = consumer;
console.log("✅ OAuth consumer fetched:", consumer.key.slice(0, 8) + "...");

// Step 2: SSO login → get ticket (using working service URL, via shared axios)
const signinParams = new URLSearchParams({
  id: "gauth-widget",
  embedWidget: "true",
  gauthHost: "https://sso.garmin.com",
  locale: "en",
  service: url.GC_MODERN,
  source: url.GC_MODERN,
  redirectAfterAccountLoginUrl: url.GC_MODERN,
  redirectAfterAccountCreationUrl: url.GC_MODERN,
});
const signinUrl = `${url.SIGNIN_URL}?${signinParams}`;

// GET to SSO embed first (sets session cookies, same as package does)
await axiosClient.get(`${url.GARMIN_SSO_EMBED}?clientId=GarminConnect&locale=en&service=${url.GC_MODERN}`, {
  headers: { "User-Agent": UA_BROWSER },
});

// GET signin page to get CSRF
const r1 = await axiosClient.get(signinUrl, { headers: { "User-Agent": UA_BROWSER } });
const html1 = r1.data;
const csrfMatch = html1.match(/name="_csrf"\s+value="([^"]+)"/);
if (!csrfMatch) throw new Error("CSRF not found in Garmin login page");
const csrf = csrfMatch[1];

// POST credentials
const formBody = new URLSearchParams({ username: EMAIL, password: PASS, embed: "true", _csrf: csrf });
const r2 = await axiosClient.post(signinUrl, formBody.toString(), {
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": UA_BROWSER,
    Referer: signinUrl,
  },
  maxRedirects: 5,
  validateStatus: (s) => s < 400,
});

const html2 = typeof r2.data === "string" ? r2.data : JSON.stringify(r2.data);
const ticketMatch = html2.match(/ticket=([^"&\s<]+)/);
if (!ticketMatch) {
  // Check redirect location
  const location = r2.headers?.location ?? "";
  const locTicket = location.match(/ticket=([^&\s]+)/)?.[1];
  if (!locTicket) {
    if (html2.includes("MFA") || html2.includes("two-factor")) {
      throw new Error("MFA is required — disable at connect.garmin.com → Profile → Security");
    }
    const title = html2.match(/<title>([^<]+)/)?.[1] ?? "unknown";
    throw new Error(`No ticket (page: "${title}")`);
  }
  var ticket = locTicket;
} else {
  var ticket = ticketMatch[1];
}
console.log("✅ SSO ticket:", ticket.slice(0, 20) + "...");

// Step 3: ticket → OAuth1 token (via shared axios)
const oauthClient = new OAuth({
  consumer,
  signature_method: "HMAC-SHA1",
  hash_function: (base, key) => crypto.createHmac("sha1", key).update(base).digest("base64"),
});

// login-url must match the 'service' URL used during SSO login
const preAuthUrl = `${url.OAUTH_URL}/preauthorized?${qs.stringify({
  ticket,
  "login-url": url.GC_MODERN,
  "accepts-mfa-tokens": true,
})}`;

const preAuthReqData = { url: preAuthUrl, method: "GET" };
const preAuthHeader = oauthClient.toHeader(oauthClient.authorize(preAuthReqData));

// Use a fresh axios instance to avoid the package's 401-interceptor interfering
const { default: axios } = await import("axios");
let r3;
try {
  r3 = await axios.get(preAuthUrl, {
    headers: { ...preAuthHeader, "User-Agent": UA_MOBILE },
    responseType: "text",
  });
} catch (e) {
  const status = e.response?.status;
  const body = String(e.response?.data ?? "").slice(0, 300);
  throw new Error(`preauthorized request failed (${status}): ${body}`);
}

const oauth1Token = qs.parse(typeof r3.data === "string" ? r3.data : "");
console.log("✅ OAuth1 token:", oauth1Token?.oauth_token?.slice(0, 20) ?? "MISSING");

if (!oauth1Token.oauth_token || !oauth1Token.oauth_token_secret) {
  console.error("  Raw preAuth response:", String(r3.data).slice(0, 200));
  throw new Error("OAuth1 token missing oauth_token or oauth_token_secret");
}

// Step 4: OAuth1 → OAuth2 (via shared axios, Authorization header not query params)
const tokenCreds = { key: oauth1Token.oauth_token, secret: oauth1Token.oauth_token_secret };
const exchangeUrl = `${url.OAUTH_URL}/exchange/user/2.0`;
const exchangeReqData = { url: exchangeUrl, method: "POST" };
const exchangeAuthData = oauthClient.authorize(exchangeReqData, tokenCreds);
const exchangeHeader = oauthClient.toHeader(exchangeAuthData);

const r4 = await axiosClient.post(exchangeUrl, null, {
  headers: {
    ...exchangeHeader,
    "User-Agent": UA_MOBILE,
    "Content-Type": "application/x-www-form-urlencoded",
  },
});

const oauth2Token = r4.data;
console.log("✅ OAuth2 token, expires_in:", oauth2Token?.expires_in ?? "MISSING");

if (!oauth2Token?.access_token) {
  throw new Error(`OAuth2 exchange returned no access_token: ${JSON.stringify(oauth2Token).slice(0, 200)}`);
}

// Build the token structure that GarminConnect.loadToken() expects
const tokenData = {
  oauth1: oauth1Token,
  oauth2: {
    ...oauth2Token,
    expires_at: Math.floor(Date.now() / 1000) + (oauth2Token.expires_in ?? 3600),
  },
};

// Save to Supabase (strip /rest/v1/ suffix if present — client adds it internally)
const supabaseBaseUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "");
const db = createClient(supabaseBaseUrl, SUPABASE_KEY);
const { data: existing } = await db.from("garmin_auth").select("id").single();

const { error } = await db.from("garmin_auth").upsert({
  id: existing?.id ?? undefined,
  session_data: tokenData,
  last_auth_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

if (error) {
  console.error("❌ Supabase save failed:", error.message);
  process.exit(1);
}

console.log("✅ Tokens saved to Supabase garmin_auth table");
console.log("   Cron jobs will now use these tokens. Run again if they expire (~1 year).");
