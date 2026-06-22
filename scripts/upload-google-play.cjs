#!/usr/bin/env node
/**
 * Upload an Android App Bundle to Google Play Console.
 *
 * Usage:
 *   node scripts/upload-google-play.js \
 *     --aab android/app/build/outputs/bundle/release/app-release.aab \
 *     --track production \
 *     --changelog android/metadata/android/en-US/changelogs/260306.txt \
 *     --json-key /path/to/service-account.json
 */

const fs = require("fs");
const crypto = require("crypto");
const https = require("https");
const path = require("path");

const PACKAGE_NAME = "cash.selene.app";
const SCOPES = "https://www.googleapis.com/auth/androidpublisher";

// --------------------------------
// Args

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, "")] = argv[i + 1];
  }
  if (!args.aab || !args["json-key"]) {
    console.error(
      "Usage: node upload-google-play.js --aab <path> --track <track> --changelog <path> --json-key <path>"
    );
    process.exit(1);
  }
  return {
    aab: args.aab,
    track: args.track || "production",
    changelog: args.changelog,
    jsonKey: args["json-key"],
  };
}

// --------------------------------
// JWT / OAuth2

function createJwt(serviceAccount) {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: SCOPES,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(serviceAccount.private_key, "base64url");

  return `${header}.${payload}.${signature}`;
}

function getAccessToken(serviceAccount) {
  const jwt = createJwt(serviceAccount);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  }).toString();

  return request("POST", "oauth2.googleapis.com", "/token", body, {
    "Content-Type": "application/x-www-form-urlencoded",
  }).then((res) => res.access_token);
}

// --------------------------------
// HTTP helpers

function request(method, host, path, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: host, path, headers: headers || {} };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        if (res.statusCode >= 300) {
          reject(new Error(`${res.statusCode} ${method} ${path}: ${text}`));
        } else {
          resolve(text ? JSON.parse(text) : {});
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function uploadFile(filePath, url, token) {
  return new Promise((resolve, reject) => {
    const fileData = fs.readFileSync(filePath);
    const parsed = new URL(url);
    const opts = {
      method: "POST",
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": fileData.length,
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        if (res.statusCode >= 300) {
          reject(new Error(`${res.statusCode} upload: ${text}`));
        } else {
          resolve(JSON.parse(text));
        }
      });
    });
    req.on("error", reject);
    req.write(fileData);
    req.end();
  });
}

function api(method, apiPath, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers["Content-Type"] = "application/json";
  return request(
    method,
    "androidpublisher.googleapis.com",
    `/androidpublisher/v3/applications/${PACKAGE_NAME}${apiPath}`,
    body ? JSON.stringify(body) : null,
    headers
  );
}

// --------------------------------
// Main

async function main() {
  const args = parseArgs();
  const serviceAccount = JSON.parse(fs.readFileSync(args.jsonKey, "utf8"));

  console.log("Authenticating...");
  const token = await getAccessToken(serviceAccount);

  console.log("Creating edit...");
  const edit = await api("POST", "/edits", token, {});
  const editId = edit.id;
  console.log(`  edit: ${editId}`);

  console.log("Uploading AAB...");
  const uploadUrl = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE_NAME}/edits/${editId}/bundles?uploadType=media`;
  const bundle = await uploadFile(args.aab, uploadUrl, token);
  const versionCode = bundle.versionCode;
  console.log(`  versionCode: ${versionCode}`);

  console.log(`Assigning to ${args.track} track...`);
  const releaseNotes = args.changelog
    ? [{ language: "en-US", text: fs.readFileSync(args.changelog, "utf8").trim() }]
    : [];

  await api("PUT", `/edits/${editId}/tracks/${args.track}`, token, {
    track: args.track,
    releases: [
      {
        versionCodes: [String(versionCode)],
        releaseNotes,
        status: "completed",
      },
    ],
  });

  console.log("Committing edit...");
  await api("POST", `/edits/${editId}:commit`, token);
  console.log("Done. Release is live.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
