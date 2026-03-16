// Runtime token refresh for Google Ads API
// Caches access token in memory, auto-refreshes before expiry.

import type { GoogleAdsConfig, GoogleAdsTokenResponse } from "./types.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EXPIRY_SAFETY_MARGIN_MS = 60_000; // refresh 60s before actual expiry

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Date.now() timestamp
}

export interface GoogleAdsAuth {
  getAccessToken(): Promise<string>;
  getHeaders(customerId?: string): Promise<Record<string, string>>;
}

export function createGoogleAdsAuth(config: GoogleAdsConfig): GoogleAdsAuth {
  let cached: CachedToken | undefined;

  async function refreshAccessToken(): Promise<CachedToken> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    });

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Google OAuth token refresh failed (${response.status}): ${text}. ` +
          "Your refresh token may be expired — run `npx mobile-growth-mcp auth google` to re-authorize."
      );
    }

    const data = (await response.json()) as GoogleAdsTokenResponse;
    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000 - EXPIRY_SAFETY_MARGIN_MS,
    };
  }

  async function getAccessToken(): Promise<string> {
    if (!cached || Date.now() >= cached.expiresAt) {
      cached = await refreshAccessToken();
    }
    return cached.accessToken;
  }

  async function getHeaders(
    customerId?: string
  ): Promise<Record<string, string>> {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "developer-token": config.developerToken,
    };
    if (config.loginCustomerId) {
      headers["login-customer-id"] = config.loginCustomerId.replace(/-/g, "");
    }
    return headers;
  }

  return { getAccessToken, getHeaders };
}
