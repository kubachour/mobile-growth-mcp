import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Minimal .env parser — reads KEY=VALUE lines, strips quotes and whitespace.
 */
function parseEnvFile(path: string): Record<string, string> {
  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch {
    return {};
  }
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

/** Parse --key=value from process.argv */
function getCliArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length).trim();
    }
  }
  return undefined;
}

let dotEnvCache: Record<string, string> | undefined;

function getDotEnv(): Record<string, string> {
  if (!dotEnvCache) {
    dotEnvCache = parseEnvFile(join(process.cwd(), ".env"));
  }
  return dotEnvCache;
}

/**
 * Resolve a config value from (in priority order):
 * 1. CLI argument (--cli-name=value)
 * 2. Environment variable
 * 3. .env file in cwd
 */
function resolve(
  envName: string,
  cliName: string
): { value: string | undefined; source: string } {
  const cli = getCliArg(cliName);
  if (cli) return { value: cli, source: `--${cliName} argument` };

  const env = process.env[envName]?.trim();
  if (env) return { value: env, source: `${envName} env var` };

  const dotenv = getDotEnv()[envName];
  if (dotenv) return { value: dotenv, source: ".env file" };

  return { value: undefined, source: "not configured" };
}

export function resolveApiKey(): { value: string | undefined; source: string } {
  return resolve("API_KEY", "api-key");
}

export function resolveMetaToken(): {
  value: string | undefined;
  source: string;
} {
  return resolve("META_ACCESS_TOKEN", "meta-token");
}

export interface GoogleAdsConfigResult {
  configured: boolean;
  missing: string[];
  sources: Record<string, string>;
  developerToken?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  loginCustomerId?: string;
}

export function resolveGoogleAdsConfig(): GoogleAdsConfigResult {
  const devToken = resolve("GOOGLE_ADS_DEVELOPER_TOKEN", "google-dev-token");
  const clientId = resolve("GOOGLE_ADS_CLIENT_ID", "google-client-id");
  const clientSecret = resolve("GOOGLE_ADS_CLIENT_SECRET", "google-client-secret");
  const refreshToken = resolve("GOOGLE_ADS_REFRESH_TOKEN", "google-refresh-token");
  const loginCustomerId = resolve("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "google-login-customer-id");

  const required = [
    { name: "GOOGLE_ADS_DEVELOPER_TOKEN", result: devToken },
    { name: "GOOGLE_ADS_CLIENT_ID", result: clientId },
    { name: "GOOGLE_ADS_CLIENT_SECRET", result: clientSecret },
    { name: "GOOGLE_ADS_REFRESH_TOKEN", result: refreshToken },
  ];

  const missing = required
    .filter((r) => !r.result.value)
    .map((r) => r.name);

  const sources: Record<string, string> = {};
  for (const r of required) {
    sources[r.name] = r.result.source;
  }
  sources["GOOGLE_ADS_LOGIN_CUSTOMER_ID"] = loginCustomerId.source;

  return {
    configured: missing.length === 0,
    missing,
    sources,
    developerToken: devToken.value,
    clientId: clientId.value,
    clientSecret: clientSecret.value,
    refreshToken: refreshToken.value,
    loginCustomerId: loginCustomerId.value,
  };
}

export function getDotEnvPath(): string {
  return join(process.cwd(), ".env");
}
