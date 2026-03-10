# Skill: Campaign Architecture Review

Evaluate whether the account structure supports or limits scale. Structure-only analysis — no insights API needed, just campaigns/adsets/ads.

---

## Knowledge Base Grounding

- **mb-li-002** (Marcus Burke): "Force deconsolidation — split creative types and messaging angles into separate ad sets to prevent self-cannibalization."
- **mb-li-003** (Marcus Burke): "Signal quality > signal volume. Always train the algorithm on the event that matters most."
- **mb-li-006** (Marcus Burke): "App Promotion and Web Sales campaigns access different audiences. Scaled brands use both."
- **mb-li-011** (Marcus Burke): "Breakthrough requires: creative diversity, architecture for scale, funnel expansion, organic amplification."
- **mb-cd-001** (Marcus Burke): "EAC — web campaigns with in-app conversion feedback for subscription apps."
- **ds-pt-005** (Dara Saeed): "ASC campaigns need minimum 20 creatives for optimal performance."
- **br-li-001** (Ben Radack): "CBO scaling with monthly winner rotation — new ad set each month for that month's proven winners."
- **br-li-002** (Ben Radack): "Zombie campaign — low cost cap CBO where every failed creative gets a second chance."
- **lp-pt-001** (Lauren Petrullo): "Meta requires at least 25% creative difference for Andromeda."
- **lp-pt-002** (Lauren Petrullo): "Minimum 6 creatives per offering — 6 unique concepts or 2 concepts × 3 formats."

---

## Procedure

### Step 1: Pull Account Structure

3 API calls — structure only, no insights:

```
get_meta_campaigns(ad_account_id="act_123456789")
get_meta_adsets(ad_account_id="act_123456789")
get_meta_ads(ad_account_id="act_123456789")
```

### Step 2: Run Architecture Checks

| Check | What | Flag | Source |
|-------|------|------|--------|
| Over-consolidation | All ads in 1-2 campaigns | ⚠ Self-cannibalization risk | mb-li-002 |
| Creative type mixing | Video + static + carousel in same ad set | ⚠ Prevents unique reach per format | mb-li-002 |
| Creative count | <6 ads per ad set / <20 in ASC | ⚠ Insufficient for Andromeda | lp-pt-002, ds-pt-005 |
| Campaign type diversity | App-only, no web campaigns | ⚠ Missing older demographics | mb-li-006, mb-li-011 |
| Optimization event | Upper-funnel event (installs) when deeper events exist | ⚠ Signal quality issue | mb-li-003 |
| Bid strategy | No cost caps on scaling campaigns | ⚠ No spend protection | br-li-001 |
| EAC | No web2app campaigns for subscription app | 💡 Opportunity | mb-cd-001 |
| Zombie campaign | No low-cap recovery campaign | 💡 Opportunity | br-li-002 |
| Creative similarity | Ads with likely similar first 3 seconds | ⚠ Andromeda treats them as identical | oh-li-001, lp-pt-001 |

### Step 3: Score and Prioritize

Rate each check:
- ✅ **Good**: Well-structured
- ⚠ **Issue**: Problem that limits scale
- 💡 **Opportunity**: Missing capability that could unlock growth

---

## Output Template

```markdown
## Campaign Architecture Review: [Account Name]

### Structure Summary
- Active campaigns: X | Ad sets: Y | Ads: Z
- Campaign types: [list]
- Bid strategies: [list]

### Architecture Checks
| Check | Status | Finding | Action | Source |
|-------|--------|---------|--------|--------|
| Over-consolidation | ⚠ | All 30 ads in 1 campaign | Split by creative type into separate ad sets | mb-li-002 |
| Creative count | ⚠ | Avg 3 ads per ad set | Add more concepts — minimum 6 per offering | lp-pt-002 |
| Campaign type diversity | ⚠ | App-only | Add Web Sales campaigns for older demos | mb-li-006 |
| ... | ... | ... | ... | ... |

### Opportunities
1. **EAC campaigns** [mb-cd-001]: Web campaigns with in-app conversion feedback for subscription apps — reaches demographics that App Promotion misses.
2. **Zombie campaign** [br-li-002]: Low cost cap CBO where failed creatives get a second chance — recovers value from retired ads.

### Recommended Architecture
[Proposed campaign structure based on findings]

### Knowledge Base References
- mb-li-002, mb-li-003, mb-li-006, mb-li-011, mb-cd-001, ds-pt-005, br-li-001, br-li-002, lp-pt-001, lp-pt-002
```
