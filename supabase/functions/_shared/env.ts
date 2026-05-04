export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it via \`supabase secrets set ${name}=...\` or in the Supabase dashboard.`
    );
  }
  return value;
}
