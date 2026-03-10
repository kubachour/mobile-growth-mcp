# Skill: Creative Performance Report

Categorize every active ad by health status and provide specific next steps per category, grounded in knowledge base insights.

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

```
get_meta_insights(
  ad_account_id="act_123456789",
  level="ad",
  fields="ad_id,ad_name,adset_id,adset_name,spend,impressions,clicks,ctr,cpm,frequency,actions,cost_per_action_type",
  date_preset="last_7d",
  sort="spend_descending",
  limit=50
)
```

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
