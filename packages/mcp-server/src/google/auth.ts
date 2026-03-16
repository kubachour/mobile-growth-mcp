// Interactive CLI auth flow for Google Ads OAuth
// Called from index.ts — checks argv, runs flow if matched, exits process.

import { createInterface } from "node:readline";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { exec } from "node:child_process";
import { readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GoogleAdsOAuthCodeResponse } from "./types.js";

const OAUTH_PORT = 8549;
const REDIRECT_URI = `http://localhost:${OAUTH_PORT}/callback`;
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/adwords";

const ENV_KEYS = [
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
] as const;

/**
 * Check argv for `auth google` subcommand.
 * If matched, runs the interactive flow and exits. Otherwise returns immediately.
 */
export async function maybeRunAuthCommand(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] !== "auth" || args[1] !== "google") return;

  await runGoogleAuthFlow();
  process.exit(0);
}

function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error(`  Could not open browser automatically.`);
      console.error(`  Open this URL manually:\n  ${url}`);
    }
  });
}

function getDotEnvPath(): string {
  return join(process.cwd(), ".env");
}

function readExistingEnv(): Record<string, string> {
  try {
    const content = readFileSync(getDotEnvPath(), "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return vars;
  } catch {
    return {};
  }
}

function saveToEnv(vars: Record<string, string>): void {
  const envPath = getDotEnvPath();
  const existing = readExistingEnv();
  const overwritten: string[] = [];

  // Check for existing keys
  for (const key of Object.keys(vars)) {
    if (existing[key]) {
      overwritten.push(key);
    }
  }

  if (overwritten.length > 0) {
    console.log(`\n  Overwriting existing keys: ${overwritten.join(", ")}`);
    // Read file, replace existing keys, append new ones
    let content: string;
    try {
      content = readFileSync(envPath, "utf-8");
    } catch {
      content = "";
    }

    const lines = content.split("\n");
    const updated = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key in vars) {
        lines[i] = `${key}=${vars[key]}`;
        updated.add(key);
      }
    }

    // Append keys that weren't found in existing file
    for (const [key, value] of Object.entries(vars)) {
      if (!updated.has(key)) {
        lines.push(`${key}=${value}`);
      }
    }

    writeFileSync(envPath, lines.join("\n"));
  } else {
    // Append all keys
    const block = Object.entries(vars)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    let prefix = "\n";
    try {
      const existing = readFileSync(envPath, "utf-8");
      if (existing.length > 0 && !existing.endsWith("\n")) {
        prefix = "\n\n";
      } else if (existing.endsWith("\n")) {
        prefix = "";
      }
    } catch {
      prefix = "";
    }

    appendFileSync(envPath, `${prefix}${block}\n`);
  }
}

async function waitForOAuthCallback(
  clientId: string,
  clientSecret: string
): Promise<{ refreshToken: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? "/", `http://localhost:${OAUTH_PORT}`);

        if (url.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h2>Authorization failed</h2><p>You can close this tab.</p></body></html>"
          );
          server.close();
          reject(new Error(`OAuth authorization denied: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h2>Missing authorization code</h2></body></html>"
          );
          return;
        }

        // Exchange code for tokens
        try {
          const tokenBody = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code",
          });

          const tokenRes = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenBody.toString(),
          });

          if (!tokenRes.ok) {
            const text = await tokenRes.text();
            throw new Error(`Token exchange failed (${tokenRes.status}): ${text}`);
          }

          const tokenData = (await tokenRes.json()) as GoogleAdsOAuthCodeResponse;

          if (!tokenData.refresh_token) {
            throw new Error(
              "No refresh token received. Make sure prompt=consent is set and try again."
            );
          }

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h2>Success!</h2><p>You can close this tab and return to the terminal.</p></body></html>"
          );

          server.close();
          resolve({ refreshToken: tokenData.refresh_token });
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h2>Token exchange failed</h2><p>Check the terminal for details.</p></body></html>"
          );
          server.close();
          reject(err);
        }
      }
    );

    server.listen(OAUTH_PORT, () => {
      // Server ready
    });

    server.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${OAUTH_PORT} is already in use. Close the process using it and try again.`
          )
        );
      } else {
        reject(err);
      }
    });
  });
}

async function runGoogleAuthFlow(): Promise<void> {
  console.log("\nGoogle Ads Setup");
  console.log("================\n");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // Step 1: Developer token
    console.log("Step 1: Developer token");
    console.log("  (Found in Google Ads → Tools → API Center)\n");

    const developerToken = await prompt(rl, "  Developer token: ");
    if (!developerToken) {
      console.error("\n  Developer token is required.");
      return;
    }

    const loginCustomerId = await prompt(
      rl,
      "  MCC account ID (optional, press Enter to skip): "
    );

    // Step 2: OAuth credentials
    console.log("\nStep 2: OAuth credentials");
    console.log(
      "  (Create in Google Cloud Console → APIs & Services → Credentials)\n"
    );
    console.log(`  Redirect URI to register: ${REDIRECT_URI}\n`);

    const clientId = await prompt(rl, "  Client ID: ");
    if (!clientId) {
      console.error("\n  Client ID is required.");
      return;
    }

    const clientSecret = await prompt(rl, "  Client secret: ");
    if (!clientSecret) {
      console.error("\n  Client secret is required.");
      return;
    }

    rl.close();

    // Step 3: Authorization
    console.log("\nStep 3: Authorization");

    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
    });

    const authUrl = `${AUTH_URL}?${authParams.toString()}`;

    console.log("  Opening browser...\n");
    openBrowser(authUrl);
    console.log(`  If the browser didn't open, visit:\n  ${authUrl}\n`);

    const { refreshToken } = await waitForOAuthCallback(clientId, clientSecret);

    // Save to .env
    const envVars: Record<string, string> = {
      GOOGLE_ADS_DEVELOPER_TOKEN: developerToken,
      GOOGLE_ADS_CLIENT_ID: clientId,
      GOOGLE_ADS_CLIENT_SECRET: clientSecret,
      GOOGLE_ADS_REFRESH_TOKEN: refreshToken,
    };

    if (loginCustomerId) {
      envVars.GOOGLE_ADS_LOGIN_CUSTOMER_ID = loginCustomerId;
    }

    saveToEnv(envVars);

    console.log(`\n✓ Saved to .env. Restart your MCP client to use Google Ads tools.`);
  } catch (err) {
    console.error(
      `\nError: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  } finally {
    rl.close();
  }
}
