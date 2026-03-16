// Google Ads API response types

export interface GoogleAdsError {
  error: {
    code: number;
    message: string;
    status: string;
    details?: Array<{
      "@type": string;
      errors?: Array<{
        errorCode: Record<string, string>;
        message: string;
        trigger?: { stringValue?: string };
        location?: { fieldPathElements?: Array<{ fieldName: string }> };
      }>;
    }>;
  };
}

export interface GoogleAdsSearchStreamResponse {
  results: GoogleAdsRow[];
  fieldMask: string;
  requestId: string;
}

export interface GoogleAdsRow {
  campaign?: GoogleAdsCampaign;
  metrics?: GoogleAdsMetrics;
  customer?: { id: string; descriptiveName: string };
}

export interface GoogleAdsCampaign {
  resourceName: string;
  id: string;
  name: string;
  status: "ENABLED" | "PAUSED" | "REMOVED" | "UNKNOWN" | "UNSPECIFIED";
  advertisingChannelType?: string;
  biddingStrategyType?: string;
  campaignBudget?: string;
  startDate?: string;
  endDate?: string;
}

export interface GoogleAdsMetrics {
  impressions?: string;
  clicks?: string;
  costMicros?: string;
  conversions?: number;
  conversionsValue?: number;
  ctr?: number;
  averageCpc?: string;
  averageCpm?: string;
}

export interface GoogleAdsConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  loginCustomerId?: string;
}

export interface GoogleAdsTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  refresh_token?: string;
}

export interface GoogleAdsOAuthCodeResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
}
