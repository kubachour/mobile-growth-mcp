# Skill: Creative Performance Report

Categorize every active ad by health status and provide specific next steps per category, grounded in knowledge base insights.

---

## When to Use This

- User asks "which ads are working?" or "what should I pause?"
- User wants to know which creatives to scale, keep, or replace
- Before planning a new creative batch
- CPA is rising and the cause might be at the ad level
- User says "creative audit" or "ad performance"

## What It Needs

**Option A — Meta Ads MCP connected** (recommended): Use Meta's official Meta Ads AI connector. Provide `ad_account_id` and ask the connector for the data described in Option B.

**Option B — CSV export** (no API needed):
- Go to **Meta Ads Manager** → **Ads** tab
- Date range: **Last 7 days**
- Columns: `Ad name`, `Ad set name`, `Campaign name`, `Delivery`, `Spend`, `Impressions`, `Frequency`, `CPM`, `CTR (link)`, `CPC`, `Result` (your conversion event), `Cost per result`
- Export as CSV and paste below.
- Also note your target CPA so ads can be benchmarked against it.

## What It Produces

- Ad-level health table with category: Scaling / Promising / Contributing / Fatiguing / Dead weight
- Specific recommended action per ad
- Creative diversity assessment (format coverage, minimum 6 concepts check)

---

## Knowledge Base Grounding

- **ds-pt-001** (Dara Saeed): "Only optimize based on primary metrics (CPA, ROAS). A low CTR or high CPM doesn't mean an ad is failing if the CPA is profitable."
- **ds-pt-004** (Dara Saeed): "Meta has determined that scaling 'more profitable' low-spend ads further would degrade performance. Don't try to force spend to them."
- **jl-pt-004** (Jon Loomer): "In BAU campaigns, don't turn off underperforming ads if aggregate performance is good. They may play a halo role."
- **lp-pt-003** (Lauren Petrullo): "Contribution vs attribution — ads feed conversions without getting last-click credit. Killing low-converting ads can collapse the funnel."
- **vs-nt-001** (Virendra Shekhawat): "Meta auto-shifts spend when creative degrades."
- **mb-li-001** (Marcus Burke): "Creative unlocks scale, iterations maintain it. Only genuinely new concepts unlock new audiences."
- **oh-li-001** (Olly Hudson): "Andromeda treats ads with similar first 3 seconds as identical."
- **lp-pt-001** (Lauren Petrullo): "Meta requires at least 25% creative difference."
- **lp-pt-002** (Lauren Petrullo): "Minimum 6 creatives per offering — 6 unique concepts or 2 concepts × 3 formats."

---

## Procedure

### Step 1: Pull Ad-Level Insights

Via Meta's MCP or CSV: top 50 ads by spend over the last 7 days with `ad_id`, `ad_name`, `adset_id`, `adset_name`, `spend`, `impressions`, `clicks`, `ctr`, `cpm`, `frequency`, conversions, and cost per conversion.

### Step 2: Determine Target CPA

Ask the user for their target CPA, or calculate account average CPA from the data.

### Step 3: Categorize Each Ad

| Category | Criteria | Action (grounded in KB) |
|----------|----------|------------------------|
| **Scaling** | High spend (>10% of total), CPA ≤ target | Let it run. Don't micro-optimize. Extract creative learnings for new concepts [mb-li-001]. |
| **Promising** | Low spend, CPA ≤ target | Don't force more spend — Meta has determined scaling would degrade it [ds-pt-004]. Analyze what makes it work and apply learnings to new ads. |
| **Contributing** | Getting impressions, low/no conversions, but aggregate ad set is healthy | Likely playing a halo role [jl-pt-004, lp-pt-003]. Do NOT pause. Meta shows it for a reason. |
| **Fatiguing** | Frequency >3, CTR declining or CPA rising | Prepare replacement with genuinely different visuals [oh-li-001, lp-pt-001]. Meta will auto-shift spend [vs-nt-001]. |
| **Dead weight** | High spend (>5% of total), CPA >2x target, for >7 days | Consider pausing only if aggregate ad set performance is also bad [jl-pt-004]. |

### Step 4: Creative Diversity Assessment

- How many genuinely different concepts are running? (not just variations)
- Are there format differences (video/static/carousel) or just copy changes? [lp-pt-001: need 25% visual difference]
- Minimum 6 creatives per offering [lp-pt-002]

---

## Output Template

```markdown
## Creative Performance Report: [Account Name]

### Summary
- X ads analyzed across Y ad sets
- Total spend: $X | Average CPA: $Y
- Z scaling | W promising | V contributing | U fatiguing | T dead weight

### Ad Categories
#### 🟢 Scaling (X ads, $Y spend)
| Ad | Spend | CPA | CTR | Notes |
|----|-------|-----|-----|-------|

#### 💡 Promising (X ads, $Y spend)
| Ad | Spend | CPA | CTR | Notes |
|----|-------|-----|-----|-------|

#### 🔵 Contributing (X ads, $Y spend)
| Ad | Spend | Impressions | Conversions | Ad Set Health |
|----|-------|-------------|-------------|---------------|

#### 🟡 Fatiguing (X ads, $Y spend)
| Ad | Spend | Freq | CTR Trend | CPA | Diagnosis |
|----|-------|------|-----------|-----|-----------|

#### 🔴 Dead Weight (X ads, $Y spend)
| Ad | Spend | CPA | vs Target | Ad Set CPA |
|----|-------|-----|-----------|------------|

### Creative Diversity
- Unique concepts: X
- Format mix: Y% video, Z% static, W% carousel
- [Assessment and gaps]

### Recommendations
1. [...]

### Knowledge Base References
- ds-pt-001, ds-pt-004, jl-pt-004, lp-pt-003, vs-nt-001, mb-li-001, oh-li-001, lp-pt-001, lp-pt-002
```
