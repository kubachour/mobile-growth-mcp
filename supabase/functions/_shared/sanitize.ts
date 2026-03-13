/** Build a safe, loggable summary of tool input (no tokens or account IDs). */
export function sanitizeToolInput(
  name: string,
  args: Record<string, unknown>
): string {
  if (name === "search_insights") return `query: "${args.query}"`;
  if (name === "get_insight") return `id: "${args.id}"`;
  if (name === "submit_feedback")
    return `category: "${args.category}"`;
  if (name === "delete_insight")
    return `slugs: ${JSON.stringify(args.slugs)}`;
  // Meta tools / anything else: just the tool name (strip account IDs and tokens)
  return name;
}
