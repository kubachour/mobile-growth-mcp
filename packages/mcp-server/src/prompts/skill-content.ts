// Skill text content as const strings for MCP prompts.
// Each prompt reads the corresponding skill file content and provides it to the LLM
// along with the ad_account_id argument so the LLM can execute the report.

export const AD_FATIGUE_PROMPT = `You are running an Ad Fatigue Report for the user's Meta ad account.

## Instructions

Use the \`get_meta_ad_fatigue\` tool to run the analysis. If the user wants more control, follow the manual steps below.

### Quick Method
Call \`get_meta_ad_fatigue\` with the provided ad_account_id. This runs a single API call and returns a full fatigue analysis.

### Manual Method
1. Call \`get_meta_insights\` with level="ad", time_increment="1", date_preset="last_7d", fields="ad_id,ad_name,spend,impressions,clicks,ctr,cpm,frequency,actions,cost_per_action_type"
2. For each ad, check:
   - Frequency: >3 warning, >5 critical [ds-pt-003]
   - CTR decline: peak vs last 3 days, flag if >30% [wk-tw-001 #4]
   - CPA trend: rising while frequency rises? [wk-tw-001 #1]
   - Spend concentration: >50% on fatigued ads?
3. Diagnose per Kast framework [wk-tw-001]
4. Recommend: genuinely new creatives (25% different [lp-pt-001]), new hooks [oh-li-005], don't re-test degraded [vs-nt-002]

### Key Knowledge Base References
- wk-tw-001: Diagnostic patterns (frequency+CPA, CTR+CPA)
- ds-pt-003: Frequency >5 = saturation
- vs-nt-001: Meta auto-shifts spend from degrading creatives
- vs-nt-002: Don't re-test degraded creatives for 3-6 months
- oh-li-001, lp-pt-001: 25% visual difference required`;

export const WEEKLY_PERFORMANCE_PROMPT = `You are running a Weekly Performance Snapshot for the user's Meta ad account.

## Instructions

1. Pull this week's data: \`get_meta_insights\` with level="campaign", date_preset="this_week_mon_today", fields="campaign_id,campaign_name,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions,cost_per_action_type"
2. Pull last week's data: same call with date_preset="last_week_mon_sun"
3. Compute week-over-week deltas per campaign: spend Δ%, CPA Δ%, CPM Δ%, CTR Δ%, frequency Δ%, conversions Δ%
4. Apply Kast's diagnostic framework [wk-tw-001] to campaigns with CPA increases:
   - Frequency↑ + CPA↑ → creative fatigue
   - CPM↑ + CPA↑ → audience saturation
   - CPA↑ + CVR↓ → ad-to-LP mismatch
   - CTR↓ + CPA↑ → creative fatigue
5. Generate account summary, per-campaign health table with diagnosis, and top 3 action items
6. End with: "Analyze first, optimize second" [ds-pt-008]

### Key Knowledge Base References
- wk-tw-001: 4 diagnostic metric patterns
- wk-tw-002: ROAS troubleshooting decision tree
- ds-pt-001: Primary vs secondary metrics
- ds-pt-008: Analyze first, optimize second`;

export const CREATIVE_PERFORMANCE_PROMPT = `You are running a Creative Performance Report for the user's Meta ad account.

## Instructions

1. Pull ad-level insights: \`get_meta_insights\` with level="ad", fields="ad_id,ad_name,adset_id,adset_name,spend,impressions,clicks,ctr,cpm,frequency,actions,cost_per_action_type", sort="spend_descending", limit=50
2. Determine target CPA (ask user or use account average)
3. Categorize each ad:
   - **Scaling**: High spend (>10% total), CPA ≤ target → let it run, extract learnings [mb-li-001]
   - **Promising**: Low spend, CPA ≤ target → don't force spend [ds-pt-004]
   - **Contributing**: Impressions but low conversions, ad set healthy → halo role [jl-pt-004, lp-pt-003]
   - **Fatiguing**: Frequency >3, CTR declining or CPA rising → prepare replacement [oh-li-001, lp-pt-001, vs-nt-001]
   - **Dead weight**: High spend (>5%), CPA >2x target → pause only if ad set also bad [jl-pt-004]
4. Assess creative diversity: unique concepts, format mix, minimum 6 per offering [lp-pt-002]

### Key Knowledge Base References
- ds-pt-001: Optimize on primary metrics only
- ds-pt-004: Don't force spend to low-spend winners
- jl-pt-004: Don't kill ads if aggregate is good
- lp-pt-003: Contribution vs attribution
- mb-li-001: Creative unlocks scale
- oh-li-001: First 3 seconds matter for Andromeda
- lp-pt-001: 25% visual difference required
- lp-pt-002: Minimum 6 creatives per offering`;

export const PLACEMENT_EFFICIENCY_PROMPT = `You are running a Placement Efficiency Report for the user's Meta ad account.

## Instructions

1. Pull placement breakdown: \`get_meta_insights\` with level="campaign", breakdowns="publisher_platform,platform_position", fields="spend,impressions,cpm,ctr,actions,cost_per_action_type"
2. Calculate CPI per placement, flag any with CPI >3x campaign average
3. Check known waste placements: facebook/instream_video, facebook/facebook_reels_overlay, threads/threads_feed, audience_network/classic
4. Quantify: total waste spend, what-if CPI without waste
5. Compare placement mix (% video-first vs feed vs junk)
6. Recommend:
   - Waste >10% + >30 days data → restrict placements
   - Campaign <14 days → "Not enough data, Advantage+ is learning"
   - Consider Placement Value Rules instead of restricting [mb-li-009]
   - Campaign type context: App Promotion = Reels-heavy [mb-li-006]

### Key Knowledge Base References
- mb-li-006: App campaigns are Reels-heavy, Web campaigns scale on Feed
- mb-li-009: Placement-level Value Rules as alternative to restriction`;

export const AUDIENCE_COMPOSITION_PROMPT = `You are running an Audience Composition Report for the user's Meta ad account.

## Instructions

1. Pull age × gender breakdown: \`get_meta_insights\` with level="account", breakdowns="age,gender", fields="spend,impressions,clicks,ctr,actions,cost_per_action_type"
2. Build age × gender heatmap of spend and CPA
3. Analyze:
   - Which age groups get most spend?
   - Which have best CPA?
   - Are 35+ segments being reached? [mb-li-010: they convert 2-3x better]
   - Budget concentrated on young demos due to app campaign skew? [mb-li-006]
4. Flag mismatches between spend allocation and conversion efficiency
5. Recommend:
   - 35+ has better CPA but <20% spend → add Web Sales campaigns [mb-li-006]
   - Age CPA varies >2x → set up Value Rules with age-based bid modifiers [mb-li-008, mb-li-010]
   - All spend to one age group → persona-based creatives [oh-li-003]
   - Younger demos bad CPA → pricing variance for price-sensitive users [mb-li-005]

### Key Knowledge Base References
- mb-li-010: Age-based CVR data (older = higher CVR)
- mb-li-006: App Promotion skews young, Web Sales skews older
- mb-li-005: One price = one audience
- mb-li-008: Value Rules for age/gender bid modifiers
- oh-li-003: Persona-based ads unlock 89% new audiences`;

export const ARCHITECTURE_REVIEW_PROMPT = `You are running a Campaign Architecture Review for the user's Meta ad account.

## Instructions

1. Pull structure (3 calls, no insights needed):
   - \`get_meta_campaigns\`
   - \`get_meta_adsets\`
   - \`get_meta_ads\`
2. Run these checks:
   - Over-consolidation: all ads in 1-2 campaigns → self-cannibalization [mb-li-002]
   - Creative type mixing: video+static+carousel in same ad set [mb-li-002]
   - Creative count: <6 per ad set [lp-pt-002], <20 in ASC [ds-pt-005]
   - Campaign type diversity: app-only, no web campaigns [mb-li-006, mb-li-011]
   - Optimization event: upper-funnel when deeper events exist [mb-li-003]
   - Bid strategy: no cost caps on scaling campaigns [br-li-001]
   - EAC: no web2app for subscription app [mb-cd-001]
   - Zombie campaign: no low-cap recovery campaign [br-li-002]
3. Score each: ✅ Good, ⚠ Issue, 💡 Opportunity
4. Provide recommendations citing specific insights

### Key Knowledge Base References
- mb-li-002: Deconsolidation
- mb-li-003: Signal quality > volume
- mb-li-006: App + Web campaign diversity
- mb-li-011: Breakthrough requires creative diversity + architecture
- mb-cd-001: EAC for subscription apps
- ds-pt-005: ASC needs 20+ creatives
- br-li-001: CBO scaling with winner rotation
- br-li-002: Zombie campaign
- lp-pt-001: 25% creative difference
- lp-pt-002: Minimum 6 creatives per offering`;

export const AUDIT_META_ACCOUNT_PROMPT = `You are running a comprehensive Meta Ad Account Audit.

## Instructions

Follow these steps to audit the account:

### Step 1: Gather Structure
- \`get_meta_campaigns\` — campaigns with objectives, bid strategies, budgets
- \`get_meta_adsets\` — ad sets with targeting, optimization goals
- \`get_meta_ads\` — ads with creative info

### Step 2: Gather Performance (last 7 days)
- \`get_meta_insights\` at campaign level
- \`get_meta_insights\` with breakdowns="age,gender" at account level
- \`get_meta_insights\` with breakdowns="publisher_platform,platform_position" at campaign level

### Step 3: Analyze (use search_insights and get_insight for KB references)
- Campaign Architecture: consolidation [mb-li-002], creative mixing, ASC creative count [ds-pt-005], campaign type diversity [mb-li-006]
- Creative Strategy: concept count [lp-pt-002], visual difference [lp-pt-001], hooks [oh-li-001], personas [oh-li-003]
- Audience: age composition [mb-li-010], 35+ reach, targeting breadth
- Bid Strategy: Value Rules [mb-li-008, mb-li-009], cost caps [br-li-001]
- Signal Quality: optimization events [mb-li-003], CAPI
- Funnel: web funnels, EAC [mb-cd-001]

### Step 4: Score each category (Green/Yellow/Red) and generate prioritized recommendations with insight IDs.

### Key Knowledge Base References
- mb-li-002, mb-li-003, mb-li-006, mb-li-008, mb-li-009, mb-cd-001
- ds-pt-005, lp-pt-001, lp-pt-002, oh-li-001, oh-li-003, br-li-001
- wk-tw-001, mb-li-010`;

export const CAMPAIGN_COMPARISON_PROMPT = `You are running a Campaign Comparison analysis.

## Instructions

1. Pull campaigns: \`get_meta_campaigns\` and identify the two campaigns to compare
2. Pull ad sets for each: \`get_meta_adsets\` with campaign_id filter
3. Pull insights for both: \`get_meta_insights\` at campaign level
4. Compare settings, targeting, placements, performance metrics
5. Apply Kast's diagnostic framework [wk-tw-001] to interpret metric differences
6. Check for creative similarity across campaigns [oh-li-001]
7. Check attribution contribution [lp-pt-003, jl-pt-004] before recommending ad pauses
8. Identify root causes using the decision tree

### Key Knowledge Base References
- wk-tw-001: 4 diagnostic metric patterns
- lp-pt-003: Contribution vs attribution
- jl-pt-004: Don't kill ads if aggregate is good
- oh-li-001: Andromeda creative similarity`;

export const PLACEMENT_AUDIT_PROMPT = `You are running a Placement Efficiency Audit.

## Instructions

1. Pull placement breakdown: \`get_meta_insights\` with breakdowns="publisher_platform,platform_position"
2. Calculate CPI per placement, flag waste (>3x average)
3. Check known waste placements for app installs
4. Quantify waste spend and what-if CPI
5. Recommend: restrict, keep broad, or use Placement Value Rules [mb-li-009]
6. Context: App Promotion = Reels-heavy [mb-li-006]

### Key Knowledge Base References
- mb-li-006: Campaign type affects placement distribution
- mb-li-009: Placement Value Rules as alternative to restriction`;

export const ATTRIBUTION_ANALYSIS_PROMPT = `You are running an Attribution & Conversion Validation analysis.

## Instructions

1. Pull insights with standard fields
2. For multi-window analysis, check 1d vs 7d click uplift and view-through ratio
3. Use daily time-series (time_increment="1") to check consistency
4. Cross-reference with creative-level performance
5. Consider contribution vs attribution [lp-pt-003] — ads may feed conversions without getting credit

### Key Knowledge Base References
- lp-pt-003: Contribution vs attribution — killing low-converting ads can collapse the funnel`;
