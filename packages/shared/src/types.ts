export interface Insight {
  id: string;
  title: string;
  insight: string;
  raw_excerpt?: string;
  source_type: string;
  source_author?: string;
  source_title?: string;
  source_date?: string;
  growth_gems_edition?: number | string | null;
  platform?: string | null;
  topics: string[];
  applies_to: string[];
  confidence: number;
  actionable_steps?: string[];
}

export interface InsightRow extends Insight {
  db_id: number;
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface InsightSummary {
  db_id: number;
  slug: string;
  title: string;
  source_type: string;
  source_author: string | null;
  platform: string | null;
  topics: string[];
  applies_to: string[];
  confidence: number;
  created_at: string;
}

export interface SearchResult extends InsightRow {
  score: number;
}

export interface SemanticResult extends InsightRow {
  similarity: number;
}

export const VALID_SOURCE_TYPES = [
  "podcast_transcript",
  "podcast",
  "linkedin_post",
  "linkedin_carousel",
  "community_discussion",
  "conference_talk",
  "webinar",
  "presentation",
  "youtube_video",
  "data_visualization",
  "screenshot",
  "pdf_guide",
  "notes",
  "other",
] as const;

export const VALID_PLATFORMS = [
  "meta",
  "google",
  "tiktok",
  "cross_platform",
] as const;

// Reference vocabularies — used for warnings, not hard enforcement
export const TOPICS = [
  "scaling",
  "creative_strategy",
  "creative_testing",
  "creative_iteration",
  "creative_fatigue",
  "campaign_architecture",
  "campaign_structure",
  "funnel_strategy",
  "funnel_optimization",
  "audience_targeting",
  "bid_strategy",
  "bidding",
  "budgeting",
  "value_rules",
  "cpi_optimization",
  "campaign_optimization",
  "aso",
  "measurement",
  "attribution",
  "signal_engineering",
  "conversion_events",
  "pricing",
  "subscription",
  "monetization",
  "paywall_optimization",
  "ltv_modeling",
  "onboarding",
  "advantage_plus",
  "eac",
  "web_to_app",
  "ad_ranking",
  "meta_ads",
  "google_ads",
  "retention",
  "first_party_data",
  "surveys",
  "ai_tools",
  "automation",
  "testing_framework",
  "competitive_analysis",
  "ad_copy",
  "conversion_rate",
  "strategy",
] as const;

export const APPLIES_TO = [
  "subscription_apps",
  "mobile_gaming",
  "ios",
  "android",
  "mobile",
  "web2app",
  "web_funnels",
  "ecommerce",
  "all",
] as const;
