# Skill: Weekly Performance Snapshot

The "Monday morning check" — week-over-week health comparison with automatic diagnosis using Kast's diagnostic framework.

---

## When to Use This

- User asks "how did we do this week?" or "how are campaigns performing?"
- Monday morning or start-of-week check-in
- Spend, CPA, or ROAS changed unexpectedly and needs diagnosis
- User wants a summary before an optimization session
- User says "quick check" or "weekly recap"

## What It Needs

**Option A — Meta Ads MCP connected** (recommended): Use Meta's official Meta Ads AI connector. Provide `ad_account_id` (e.g. `act_123456789`) and ask the connector for the data described in Option B.

**Option B — CSV export** (no API needed):
- Go to **Meta Ads Manager** → **Campaigns** tab
- Set date range to **This week (Mon–today)**, then export. Repeat for **Last week (Mon–Sun)**.
- Columns to include: `Campaign name`, `Delivery`, `Budget`, `Spend`, `Reach`, `Impressions`, `Frequency`, `CPM`, `CTR (link)`, `CPC`, `Result` (your conversion event), `Cost per result`
- Export each week as a separate CSV and paste both below, labeled by week.

## What It Produces

- Week-over-week delta table per campaign (spend Δ%, CPA Δ%, CPM Δ%, CTR Δ%, frequency Δ%)
- Kast diagnostic label per campaign (fatigue / saturation / LP mismatch / healthy)
- Prioritized action list

---

## Knowledge Base Grounding

- **wk-tw-001** (William Kast): The 4 core metric patterns that diagnose every Meta performance issue:
  1. Frequency↑ + CPA↑ → creative fatigue → need fresh TOF creatives
  2. CPM↑ + CPA↑ → audience saturation or poor engagement → new messaging, new audiences
  3. CPA↑ + CVR↓ → ad-to-landing-page mismatch → fix landing page alignment
  4. CTR↓ + CPA↑ → creative fatigue → need fresh TOF creatives
- **wk-tw-002** (William Kast): ROAS troubleshooting decision tree — CPM → CTR → AOV → CR, sequential isolation
- **ds-pt-001** (Dara Saeed): "Primary metrics (spend, CPA, ROAS) decide what works. Secondary metrics (frequency, CPM, CTR) explain why. Never make optimization decisions based on secondary metrics alone."
- **ds-pt-008** (Dara Saeed): "Analyze first, optimize second. Separate the two activities to avoid reactive decisions."

---

## Procedure

### Step 1: Pull This Week and Last Week Data

Via Meta's MCP or CSV, gather campaign-level data for two ranges — **this week (Mon–today)** and **last week (Mon–Sun)** — with: `campaign_id`, `campaign_name`, `spend`, `impressions`, `clicks`, `ctr`, `cpm`, `cpc`, `reach`, `frequency`, conversions, and cost per conversion.

### Step 2: Compute Deltas

For each campaign, calculate week-over-week changes:
- Spend Δ%
- CPA Δ%
- CPM Δ%
- CTR Δ%
- Frequency Δ%
- Conversions Δ%

### Step 3: Apply Kast Diagnostic Framework [wk-tw-001]

For each campaign with CPA increase, check which pattern matches:

| Pattern | Diagnosis | Action |
|---------|-----------|--------|
| Frequency↑ + CPA↑ | Creative fatigue | Fresh TOF creatives needed |
| CPM↑ + CPA↑ | Audience saturation / poor engagement | New messaging, broader targeting |
| CPA↑ + CVR↓ | Ad-to-LP mismatch | Fix landing page alignment |
| CTR↓ + CPA↑ | Creative fatigue | New hooks, new creative concepts |

Remember: "Primary metrics decide what works. Secondary metrics explain why" [ds-pt-001].

### Step 4: Generate Action Items

Prioritize the top 3 highest-impact actions across all campaigns.

---

## Output Template

```markdown
## Weekly Performance Snapshot — [Date Range]

### Account Summary
Total spend: $X (+Y% WoW) | Conversions: N (+Z% WoW) | Avg CPA: $X (+W% WoW)

### Campaign Health
| Campaign | Spend | CPA (Δ%) | CPM (Δ%) | CTR (Δ%) | Freq | Diagnosis |
|----------|-------|----------|----------|----------|------|-----------|
| Camp A   | $5K   | $12 (+8%)| $15 (+12%)| 1.2% (-5%)| 2.1 | ⚠ CPM+CPA↑: audience saturation [wk-tw-001 #2] |
| Camp B   | $3K   | $9 (-3%) | $11 (0%) | 1.8% (+2%)| 1.5 | ✅ Healthy |

### Diagnosis
[Per Kast framework, with insight IDs]

### Action Items
1. [Highest impact action]
2. [...]
3. [...]

> "Analyze first, optimize second" (ds-pt-008) — review this report fully before making changes.

### Knowledge Base References
- wk-tw-001, wk-tw-002, ds-pt-001, ds-pt-008
```
