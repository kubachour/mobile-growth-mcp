// Google Ads REST client — GAQL queries via searchStream endpoint

import type {
  GoogleAdsConfig,
  GoogleAdsError,
  GoogleAdsSearchStreamResponse,
} from "./types.js";
import { createGoogleAdsAuth, type GoogleAdsAuth } from "./oauth.js";

const API_VERSION = "v19";
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;

let authSingleton: GoogleAdsAuth | undefined;

function getGoogleAdsAuth(): GoogleAdsAuth {
  if (authSingleton) return authSingleton;

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  if (!developerToken || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Ads is not configured. To fix:\n" +
        "  1. Run `npx mobile-growth-mcp auth google` to set up credentials (saves to .env)\n" +
        '  2. Or add GOOGLE_ADS_* vars to the "env" block in your MCP config (.mcp.json or claude_desktop_config.json)\n' +
        "Then restart your MCP client."
    );
  }

  const config: GoogleAdsConfig = {
    developerToken,
    clientId,
    clientSecret,
    refreshToken,
    loginCustomerId,
  };

  authSingleton = createGoogleAdsAuth(config);
  return authSingleton;
}

/** Strip dashes from customer ID (Google Ads API requires plain digits) */
export function normalizeCustomerId(customerId: string): string {
  return customerId.replace(/-/g, "");
}

function isGoogleAdsError(body: unknown): body is GoogleAdsError {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as GoogleAdsError).error?.message === "string"
  );
}

function formatGoogleAdsError(err: GoogleAdsError["error"]): string {
  const code = err.code;

  if (code === 401) {
    return (
      "Authentication error: Your Google Ads credentials are invalid or expired. " +
      "Run `npx mobile-growth-mcp auth google` to re-authorize."
    );
  }
  if (code === 403) {
    return `Permission denied: ${err.message}. Check that your developer token is approved and the account ID is correct.`;
  }
  if (code === 429) {
    return `Rate limit hit: ${err.message}. Wait a few minutes before retrying.`;
  }

  // For 400 errors, include GAQL details if available
  if (code === 400 && err.details?.length) {
    const gaqlErrors = err.details
      .flatMap((d) => d.errors ?? [])
      .map((e) => e.message)
      .join("; ");
    if (gaqlErrors) {
      return `Invalid query: ${gaqlErrors}`;
    }
  }

  return `Google Ads API error (${code}): ${err.message}`;
}

export async function googleAdsQuery(
  customerId: string,
  query: string
): Promise<GoogleAdsSearchStreamResponse[]> {
  const auth = getGoogleAdsAuth();
  const normalizedId = normalizeCustomerId(customerId);
  const headers = await auth.getHeaders(normalizedId);

  const url = `${BASE_URL}/customers/${normalizedId}/googleAds:searchStream`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const body = await response.json();

  if (!response.ok) {
    if (isGoogleAdsError(body)) {
      throw new Error(formatGoogleAdsError(body.error));
    }
    throw new Error(
      `Google Ads API returned ${response.status}: ${JSON.stringify(body)}`
    );
  }

  // searchStream returns an array of response chunks
  if (Array.isArray(body)) {
    return body as GoogleAdsSearchStreamResponse[];
  }
  return [body as GoogleAdsSearchStreamResponse];
}
