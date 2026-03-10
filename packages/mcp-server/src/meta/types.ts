// Meta Marketing API response types

export interface MetaApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export interface MetaPaging {
  cursors?: {
    before?: string;
    after?: string;
  };
  next?: string;
}

export interface MetaListResponse<T> {
  data: T[];
  paging?: MetaPaging;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  bid_strategy?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  buying_type?: string;
  special_ad_categories?: string[];
  smart_promotion_type?: string;
  created_time?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  campaign_id: string;
  optimization_goal?: string;
  billing_event?: string;
  bid_strategy?: string;
  bid_amount?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: Record<string, unknown>;
  promoted_object?: Record<string, unknown>;
  start_time?: string;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  adset_id: string;
  campaign_id?: string;
  creative?: {
    id: string;
    title?: string;
    body?: string;
    image_url?: string;
    video_id?: string;
    call_to_action_type?: string;
    object_story_spec?: Record<string, unknown>;
  };
}

export interface MetaActionValue {
  action_type: string;
  value: string;
}

export interface MetaInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  cpc?: string;
  reach?: string;
  frequency?: string;
  actions?: MetaActionValue[];
  cost_per_action_type?: MetaActionValue[];
  conversions?: MetaActionValue[];
  conversion_values?: MetaActionValue[];
  // Breakdown fields
  age?: string;
  gender?: string;
  publisher_platform?: string;
  platform_position?: string;
  country?: string;
}

export interface ThrottleInfo {
  app_id_util_pct: number;
  acc_id_util_pct: number;
  ads_api_access_tier: string;
}

export type MetaDatePreset =
  | "today"
  | "yesterday"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "maximum"
  | "last_3d"
  | "last_7d"
  | "last_14d"
  | "last_28d"
  | "last_30d"
  | "last_90d"
  | "last_week_mon_sun"
  | "last_week_sun_sat"
  | "last_quarter"
  | "last_year"
  | "this_week_mon_today"
  | "this_week_sun_today"
  | "this_year";
