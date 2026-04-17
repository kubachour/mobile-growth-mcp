# Admin Briefing

You are generating a morning briefing for the Mobile Growth MCP admin. Check all pending items and present a concise summary.

---

## When to Use This

- Admin starts their day and wants a system status overview
- Before a review session to know what needs attention
- User says "admin briefing", "morning briefing", or "what needs review?"
- Periodic check (daily or whenever returning after time away)

## What It Needs

- Admin API key (admin-only tools: `review_suggestions`, `review_skill_suggestions`, `suggest_improvement`)
- No Meta API or Google Ads connection needed

## What It Produces

- Count and summary of pending insight suggestions
- Count and summary of pending skill suggestions (with/without .md drafts)
- Bug reports and tool errors from the last 7 days
- Knowledge gaps (zero-result searches)
- Top search queries
- Prioritized action list

## Steps

1. **Pending Insight Suggestions**: Call `review_suggestions` with status `pending`. Report how many are waiting for review. For each, show the title, submitter, and a one-line summary of the insight.

2. **Pending Skill Suggestions**: Call `review_skill_suggestions` with status `pending`. Report how many are waiting. For each, show: name, description, data_sources, whether a .md draft was included, and the submitter. Flag separately: (a) skills with a full draft ready to deploy, (b) skills that still need a .md written.

3. **Recent Activity Summary**: Call `suggest_improvement` with `days: 7` to get:
   - Recent feedback submissions (especially `bug_report` and `missing_knowledge` categories)
   - Zero-result searches (topics users searched for but got no results)
   - Error patterns (tools that are failing)
   - Top search queries (what users are asking about most)

4. **Present the Briefing** in this format:

```
## Admin Briefing — [today's date]

### Pending Insight Suggestions ([count])
- [title] — submitted by [name] on [date]
  Brief: [one-line summary]

### Pending Skill Suggestions ([count])
Ready to deploy (has .md draft):
- [name] — [description] — by [submitter]

Needs .md written:
- [name] — [description] — by [submitter]
  Idea: [one-line summary of user_description]

### Bug Reports ([count])
- [summary]

### Knowledge Gaps ([count])
- [topic/query that had no results]

### Tool Errors ([count])
- [tool]: [error pattern]

### Top Searches (last 7 days)
- [query] ([count]×)

### Recommended Actions
1. [Most urgent action based on the data above]
2. [Second action]
3. [Third action]
```

5. **Prioritize actions**: Bug reports first. Then skill suggestions with drafts ready (low effort, high value — just commit + deploy). Then pending insight suggestions. Then knowledge gaps that align with top searches.

## Notes
- This briefing uses admin-only tools (`review_suggestions`, `review_skill_suggestions`, `suggest_improvement`). If these return errors, the user may not have admin access.
- Keep the briefing scannable — use bullet points, not paragraphs.
- For skill suggestions with a draft: use `approve_skill_suggestion` to get the final .md, then commit to `skills/`, run `npm run build:prompts`, and deploy.
- If everything is clean, say so briefly and suggest proactive actions like reviewing most-searched topics or writing Google Ads skills.
