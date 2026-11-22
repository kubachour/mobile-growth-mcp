# Skill: Ad Fatigue Report

Detect creatives that are wasting budget due to audience exhaustion or declining engagement. Uses daily granularity over 7 days to identify fatigue patterns.

---

## When to Use This

- Frequency is climbing and CPA is rising
- CTR has been declining over the past week
- User asks "are my ads getting tired?" or "should I refresh creatives?"
- Before a creative refresh sprint — to know which ads to replace first
- User mentions audience saturation or ad burnout

## What It Needs

**Option A — Meta Ads MCP connected** (recommended): Use Meta's official Meta Ads AI connector to pull the data described in Option B. Provide `ad_account_id` and ask the connector for ad-level daily insights over the last 14 days.

**Option B — CSV export** (no API needed):
- Go to **Meta Ads Manager** → **Ads** tab
- Date range: **Last 14 days**, broken down **by day** (use the "Breakdown" → "Time" → "Day" option before exporting)
- Columns: `Ad name`, `Ad set name`, `Date`, `Spend`, `Impressions`, `Reach`, `Frequency`, `CTR (link)`, `CPM`, `Result`, `Cost per result`
- Export as CSV and paste below.

## What It Produces

- Per-ad fatigue status: Healthy / Warning / Fatigued / Saturated
- Daily trend chart per flagged ad (frequency and CTR movement)
- Prioritized list of ads to rotate out, with timing recommendation

---

## Knowledge Base Grounding

- **wk-tw-001** (William Kast): "Frequency 2+ and CPA rising → creative fatigue, need fresh TOF creatives." Also: "CTR dropping and CPA rising → creative fatigue."
- **ds-pt-003** (Dara Saeed): "Frequency above 5 over 7 days signals audience saturation — creatives are hitting the same people."
- **lm-rc-003** (Lucas Moscon): Saturation curves — "beyond the inflection point, pushing more budget wastes money."
- **lm-rc-001** (Lucas Moscon): Cross-channel fatigue — TikTok CTR decline predicts Facebook decline 1-2 weeks later.
- **vs-nt-001** (Virendra Shekhawat): "Meta auto-shifts spend when creative degrades" — don't panic-pause, but do flag for rotation.
- **vs-nt-002** (Virendra Shekhawat): "Do not re-test degraded creatives. Exhaust all other angles first. Wait 3-6 months."

---

## Method: Step by Step

### Step 1: Pull Daily Ad-Level Data

Via Meta's MCP (Option A) or the CSV (Option B), gather ad-level performance for the last 7-14 days, broken down by day, with: `ad_id`, `ad_name`, `spend`, `impressions`, `clicks`, `ctr`, `cpm`, `frequency`, conversions, and cost per conversion.

### Step 2: Check Per Ad (daily granularity)

1. **Frequency** — flag if >3 (warning) or >5 (critical) over 7 days [ds-pt-003]
2. **CTR decline** — peak CTR vs last 3 days; flag if >30% decline [wk-tw-001 pattern #4]
3. **CPA trend** — is CPA rising while frequency rises? [wk-tw-001 pattern #1]
4. **Spend concentration** — is >50% of budget going to fatigued ads?

### Step 3: Diagnose

| Pattern | Diagnosis | Source |
|---------|-----------|--------|
| High frequency + rising CPA | Audience saturation | wk-tw-001 #1 |
| Declining CTR + rising CPA | Creative fatigue | wk-tw-001 #4 |
| High spend + high frequency + stable CPA | Approaching fatigue, monitor | ds-pt-003 |

### Step 4: Recommend

**FATIGUED ads:**
- Rotate with genuinely new creative concepts, not variations. Meta requires at least 25% visual difference for Andromeda to treat it as a new ad [lp-pt-001, oh-li-001].
- Change the hook (first 3 seconds) to access new audiences [oh-li-005].
- Do NOT re-test degraded creatives — wait 3-6 months [vs-nt-002].
- Meta will auto-shift spend away from degrading creatives [vs-nt-001].

**HEALTHY ads:**
- Let Meta manage allocation. Don't force spend to low-spend winners — Meta has determined scaling them would degrade performance [ds-pt-004].

---

## Output Template

```markdown
## Ad Fatigue Report: [Account/Campaign Name]

### Summary
- X ads analyzed | Y fatigued | Z warning | W healthy
- Total spend: $X | Fatigued ad spend: $Y (Z%)

### Per-Ad Results
| Status | Ad | Spend | Freq | CTR Trend | CPA Trend | Diagnosis |
|--------|-----|-------|------|-----------|-----------|-----------|

### Recommendations
1. [Highest priority action]
2. [...]

### Knowledge Base References
- wk-tw-001, ds-pt-003, vs-nt-001, vs-nt-002, oh-li-001, lp-pt-001
```
