import { VALID_SOURCE_TYPES, TOPICS, APPLIES_TO } from "@mobile-growth/shared";

export function validateInsight(raw: unknown, fileName: string): void {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${fileName}: insight must be an object`);
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.id || typeof obj.id !== "string") {
    throw new Error(`${fileName}: missing or invalid 'id' (string slug required) — title: "${obj.title}"`);
  }
  if (!obj.title || typeof obj.title !== "string") {
    throw new Error(`${fileName}: missing or invalid 'title'`);
  }
  if (!obj.insight || typeof obj.insight !== "string") {
    throw new Error(`${fileName}: missing or invalid 'insight'`);
  }
  if (!obj.source_type || typeof obj.source_type !== "string") {
    throw new Error(`${fileName}: missing or invalid 'source_type'`);
  }
  if (
    !VALID_SOURCE_TYPES.includes(obj.source_type as (typeof VALID_SOURCE_TYPES)[number])
  ) {
    console.warn(
      `${fileName}: unknown source_type '${obj.source_type}' (not in reference vocabulary)`
    );
  }
  if (!Array.isArray(obj.topics)) {
    throw new Error(`${fileName}: 'topics' must be an array`);
  }
  for (const t of obj.topics) {
    if (!TOPICS.includes(t as (typeof TOPICS)[number])) {
      console.warn(`${fileName}: unknown topic '${t}' (not in reference vocabulary)`);
    }
  }
  if (!Array.isArray(obj.applies_to)) {
    throw new Error(`${fileName}: 'applies_to' must be an array`);
  }
  for (const a of obj.applies_to) {
    if (!APPLIES_TO.includes(a as (typeof APPLIES_TO)[number])) {
      console.warn(
        `${fileName}: unknown applies_to '${a}' (not in reference vocabulary)`
      );
    }
  }
  if (obj.confidence != null) {
    if (typeof obj.confidence !== "number" || obj.confidence < 1 || obj.confidence > 5) {
      throw new Error(
        `${fileName}: 'confidence' must be a number from 1 to 5`
      );
    }
  }
}
