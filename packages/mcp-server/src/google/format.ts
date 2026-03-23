// Shared formatting utilities for Google Ads tools

/** Convert micros string to formatted dollar amount */
export function formatMicros(micros: string | undefined): string {
  if (!micros) return "—";
  const val = parseInt(micros, 10);
  if (isNaN(val)) return "—";
  return `$${(val / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a number as percentage */
export function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

/** Format a number as compact (e.g. 1.2K, 580K, 1.2M) */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

/** Convert a date preset to a start/end date range */
export function datePresetToRange(preset: string): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  switch (preset) {
    case "LAST_7_DAYS": {
      const end = new Date(now);
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { start: fmt(start), end: fmt(end) };
    }
    case "LAST_14_DAYS": {
      const end = new Date(now);
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 13);
      return { start: fmt(start), end: fmt(end) };
    }
    case "LAST_30_DAYS": {
      const end = new Date(now);
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 29);
      return { start: fmt(start), end: fmt(end) };
    }
    case "THIS_MONTH": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now);
      end.setDate(end.getDate() - 1);
      return { start: fmt(start), end: fmt(end) };
    }
    case "LAST_MONTH": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: fmt(start), end: fmt(end) };
    }
    default:
      // Default to last 7 days
      return datePresetToRange("LAST_7_DAYS");
  }
}
