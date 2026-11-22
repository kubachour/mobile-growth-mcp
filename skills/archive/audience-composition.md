# Skill: Audience Composition Report

Reveal who is actually converting and at what cost, by age and gender. Identifies mismatches between spend allocation and conversion efficiency.

---

## When to Use This

- User asks "who is converting?" or "what demographic is best for us?"
- CPA varies wildly and the cause isn't obvious at the campaign level
- User is deciding between App Promotion and Web Sales campaign types
- User wants to set up Value Rules based on age/gender
- User says "audience breakdown" or "demographic analysis"

## What It Needs

**Option A — Meta Ads MCP connected** (recommended): Use Meta's official Meta Ads AI connector. Provide `ad_account_id` and ask the connector for the data described in Option B.

**Option B — CSV export** (no API needed):
- Go to **Meta Ads Manager** → **Campaigns** or **Ads** tab
- Date range: **Last 7 days**
- Click **Breakdown** → **By Delivery** → **Age** and then **Gender** (run two separate breakdowns, or use "Age and Gender" if available)
- Columns: `Age` / `Gender`, `Spend`, `Impressions`, `Reach`, `CPM`, `CTR`, `Result`, `Cost per result`
- Export both breakdowns as CSV and paste below.

## What It Produces

- Age × gender conversion efficiency heatmap
- Spend vs conversion share mismatch analysis
- Specific Value Rule recommendations (which demographic segments to bid up/down)
- Campaign type recommendation based on target demographic

---

## Knowledge Base Grounding

- **mb-li-010** (Marcus Burke): "Different creatives attract wildly different age demographics. Trial CVR by age: 18-24=18%, 25-34=26%, 35-44=32%, 45-54=44%, 55-64=48%, 65+=42%. Ads that attract older users are more valuable."
- **mb-li-006** (Marcus Burke): "App Promotion campaigns skew young (Reels-heavy). Web Sales campaigns skew older (Feed). Choose campaign type based on the demographic you want to reach."
- **mb-li-005** (Marcus Burke): "One price = one audience. Without offers for price-sensitive users, you'll never efficiently scale on Reels for younger demos."
- **mb-li-008** (Marcus Burke): "Value Rules let you set custom bid modifiers for age, gender, placement within the same broad-targeting ad set."
- **oh-li-003** (Olly Hudson): "Persona-based ads unlock new audiences 89% of the time."

---

## Procedure

### Step 1: Pull Age × Gender Breakdown

Via Meta's MCP or CSV: account-level data for the last 7 days with breakdowns `age` and `gender`, fields `spend`, `impressions`, `clicks`, `ctr`, conversions, and cost per conversion.

### Step 2: Build Heatmap

Create an age × gender matrix showing:
- Spend per cell
- CPA per cell
- Conversions per cell
- % of total spend per cell

### Step 3: Analyze

1. **Which age groups get the most spend?**
2. **Which age groups have the best CPA?**
3. **Are high-value segments (35+) being reached?** [mb-li-010: they convert 2-3x better for subscription apps]
4. **Is budget concentrated on young demographics due to app campaign skew?** [mb-li-006]
5. **Spend vs efficiency mismatch**: flag if an age group gets >30% of spend but has CPA >1.5x average

### Step 4: Recommend

- If 35+ has better CPA but <20% of spend: "Consider adding Web Sales campaigns to reach older demographics on Feed [mb-li-006]. App Promotion campaigns are Reels-heavy and naturally skew young."
- If age CPA varies >2x: "Set up Value Rules with age-based bid modifiers to reflect actual conversion value [mb-li-008, mb-li-010]."
- If all spend goes to one age group: "Build persona-based creatives targeting different motivators to unlock new audiences [oh-li-003]."
- If younger demos have bad CPA: "Consider pricing variance — offer discounts for price-sensitive younger audiences [mb-li-005]."

---

## Output Template

```markdown
## Audience Composition Report: [Account Name]

### Age × Gender Heatmap
| Age | Male Spend (CPA) | Female Spend (CPA) | Total Spend | Total CPA | % of Spend |
|-----|-------------------|---------------------|-------------|-----------|------------|
| 18-24 | $X ($Y) | $X ($Y) | $X | $Y | Z% |
| 25-34 | ... | ... | ... | ... | ... |
| 35-44 | ... | ... | ... | ... | ... |
| 45-54 | ... | ... | ... | ... | ... |
| 55-64 | ... | ... | ... | ... | ... |
| 65+   | ... | ... | ... | ... | ... |

### Key Findings
1. [Best performing segment]
2. [Worst performing segment]
3. [Biggest mismatch between spend and efficiency]

### Recommendations
1. [...]
2. [...]

### Knowledge Base References
- mb-li-010, mb-li-006, mb-li-005, mb-li-008, oh-li-003
```
