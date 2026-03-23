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
  adGroup?: GoogleAdsAdGroup;
  asset?: GoogleAdsAsset;
  adGroupAdAssetView?: GoogleAdsAdGroupAdAssetView;
  segments?: GoogleAdsSegments;
  campaignBudget?: GoogleAdsCampaignBudget;
  metrics?: GoogleAdsMetrics;
  customer?: { id: string; descriptiveName: string };
}

export interface GoogleAdsCampaign {
  resourceName: string;
  id: string;
  name: string;
  status: "ENABLED" | "PAUSED" | "REMOVED" | "UNKNOWN" | "UNSPECIFIED";
  advertisingChannelType?: string;
  advertisingChannelSubType?: string;
  biddingStrategyType?: string;
  targetCpa?: { targetCpaMicros?: string };
  targetRoas?: { targetRoas?: number };
  campaignBudget?: string;
  appCampaignSetting?: {
    appId?: string;
    appStore?: string;
    biddingStrategyGoalType?: string;
  };
  startDate?: string;
  endDate?: string;
}

export interface GoogleAdsAdGroup {
  resourceName?: string;
  id: string;
  name: string;
  status?: string;
  type?: string;
}

export interface GoogleAdsAsset {
  resourceName?: string;
  id: string;
  name: string;
  type?: string;
  textAsset?: { text?: string };
  imageAsset?: {
    fullSize?: {
      url?: string;
      widthPixels?: number;
      heightPixels?: number;
    };
  };
  youtubeVideoAsset?: {
    youtubeVideoId?: string;
    youtubeVideoTitle?: string;
  };
}

export interface GoogleAdsAdGroupAdAssetView {
  resourceName?: string;
  fieldType?: string;
  performanceLabel?: string;
}

export interface GoogleAdsSegments {
  date?: string;
  adNetworkType?: string;
  device?: string;
}

export interface GoogleAdsCampaignBudget {
  resourceName?: string;
  amountMicros?: string;
  type?: string;
}

export interface GoogleAdsMetrics {
  impressions?: string;
  clicks?: string;
  costMicros?: string;
  conversions?: number;
  conversionsValue?: number;
  allConversions?: number;
  ctr?: number;
  averageCpc?: string;
  averageCpm?: string;
  videoViews?: string;
  interactions?: string;
  biddableAppInstallConversions?: number;
  biddableAppPostInstallConversions?: number;
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
