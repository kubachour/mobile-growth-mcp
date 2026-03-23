# Admin Briefing

You are generating a morning briefing for the Mobile Growth MCP admin. Check all pending items and present a concise summary.

## Steps

1. **Pending Suggestions**: Call `review_suggestions` with status `pending`. Report how many are waiting for review. For each, show the title, submitter, and a one-line summary of the insight.

2. **Recent Activity Summary**: Call `suggest_improvement` with `days: 7` to get:
   - Recent feedback submissions (especially `bug_report` and `missing_knowledge` categories)
   - Zero-result searches (topics users searched for but got no results)
   - Error patterns (tools that are failing)
   - Top search queries (what users are asking about most)

3. **Present the Briefing** in this format:

```
## Admin Briefing — [today's date]

### Pending Suggestions ([count])
- [title] — submitted by [name] on [date]
  Brief: [one-line summary]

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

4. **Prioritize actions**: If there are bug reports, those come first. Then pending suggestions. Then knowledge gaps that align with top searches (high demand + no content = highest ROI for new content).

## Notes
- This briefing uses admin-only tools (`review_suggestions`, `suggest_improvement`). If these return errors, the user may not have admin access.
- Keep the briefing scannable — use bullet points, not paragraphs.
- If everything is clean (no pending items, no bugs, no gaps), say so briefly and suggest proactive actions like reviewing the most-searched topics.
