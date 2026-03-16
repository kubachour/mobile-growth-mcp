// Meta Marketing API client with rate limit safety
// No SDK — uses global fetch. Defaults to last_7d, active-only, minimal fields.

import type {
  MetaApiError,
  MetaListResponse,
  ThrottleInfo,
  MetaDatePreset,
} from "./types.js";

const META_API_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
const THROTTLE_WARN_THRESHOLD = 75;

export function getMetaAccessToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "Missing META_ACCESS_TOKEN. To fix, add it to your MCP config:\n" +
        '  • Claude Code / Cursor: add "META_ACCESS_TOKEN": "..." to the "env" block in .mcp.json\n' +
        '  • Claude Desktop: add "META_ACCESS_TOKEN": "..." to the "env" block in claude_desktop_config.json\n' +
        "  • CLI: add META_ACCESS_TOKEN=... to a .env file in your working directory\n" +
        "Then restart your MCP client."
    );
  }
  return token;
}

interface MetaApiOptions {
  path: string;
  params?: Record<string, string>;
}

interface MetaApiResult<T> {
  data: T;
  throttle?: ThrottleInfo;
  warning?: string;
}

function isMetaApiError(body: unknown): body is MetaApiError {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as MetaApiError).error?.message === "string"
  );
}

function formatMetaError(err: MetaApiError["error"]): string {
  const code = err.code;
  const sub = err.error_subcode;

  if (code === 190) {
    return `Authentication error: Access token is invalid or expired. Generate a new token in Meta Business Suite. (code ${code})`;
  }
  if (code === 4 || code === 17 || (code >= 80000 && code <= 80099)) {
    return `Rate limit hit: ${err.message}. Wait a few minutes before retrying. (code ${code}${sub ? `/${sub}` : ""})`;
  }
  if (code === 100) {
    return `Invalid parameter: ${err.message} (code ${code}${sub ? `/${sub}` : ""})`;
  }
  return `Meta API error: ${err.message} (code ${code}${sub ? `/${sub}` : ""})`;
}

function parseThrottleHeader(
  headers: Headers
): { throttle?: ThrottleInfo; warning?: string } | undefined {
  const raw = headers.get("x-fb-ads-insights-throttle");
  if (!raw) return undefined;

  try {
    const info: ThrottleInfo = JSON.parse(raw);
    const maxUtil = Math.max(info.app_id_util_pct, info.acc_id_util_pct);
    const warning =
      maxUtil > THROTTLE_WARN_THRESHOLD
        ? `⚠ Meta API utilization at ${maxUtil}% — approaching rate limit. Slow down requests.`
        : undefined;
    return { throttle: info, warning };
  } catch {
    return undefined;
  }
}

export async function metaApiGet<T>(
  options: MetaApiOptions
): Promise<MetaApiResult<T>> {
  const token = getMetaAccessToken();

  const url = new URL(`${META_BASE_URL}${options.path}`);
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();

  if (!response.ok || isMetaApiError(body)) {
    if (isMetaApiError(body)) {
      throw new Error(formatMetaError(body.error));
    }
    throw new Error(`Meta API returned ${response.status}: ${JSON.stringify(body)}`);
  }

  const throttleInfo = parseThrottleHeader(response.headers);

  return {
    data: body as T,
    throttle: throttleInfo?.throttle,
    warning: throttleInfo?.warning,
  };
}

// Helper: build filtering param for active-only
export function activeFilter(): string {
  return JSON.stringify([
    {
      field: "effective_status",
      operator: "IN",
      value: ["ACTIVE"],
    },
  ]);
}

// Helper: extract a specific action value (e.g. mobile_app_install) from actions array
export function getActionValue(
  actions: { action_type: string; value: string }[] | undefined,
  actionType: string
): number {
  if (!actions) return 0;
  const action = actions.find((a) => a.action_type === actionType);
  return action ? parseFloat(action.value) : 0;
}

// Helper: extract cost per action
export function getCostPerAction(
  costPerAction: { action_type: string; value: string }[] | undefined,
  actionType: string
): number | null {
  if (!costPerAction) return null;
  const action = costPerAction.find((a) => a.action_type === actionType);
  return action ? parseFloat(action.value) : null;
}

// Default date preset
export const DEFAULT_DATE_PRESET: MetaDatePreset = "last_7d";

// Default fields for each level
export const CAMPAIGN_DEFAULT_FIELDS =
  "id,name,status,effective_status,objective,bid_strategy,daily_budget,lifetime_budget,buying_type,special_ad_categories";

export const ADSET_DEFAULT_FIELDS =
  "id,name,status,effective_status,campaign_id,optimization_goal,billing_event,bid_strategy,bid_amount,daily_budget,lifetime_budget,targeting,promoted_object";

export const AD_DEFAULT_FIELDS =
  "id,name,status,effective_status,adset_id,campaign_id,creative{id,title,body,image_url,video_id,call_to_action_type}";

export const INSIGHT_DEFAULT_FIELDS =
  "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpm,cpc,actions,cost_per_action_type";
