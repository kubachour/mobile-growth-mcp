// Attach assets to an App campaign ad (ad_group_ad.ad.app_ad).
//
// App campaigns don't use AdGroupAsset links: images, videos and text live as
// arrays on the ad itself. An update REPLACES the array, so we always read the
// current arrays, append, de-duplicate and enforce Google's per-ad caps.
// Pattern proven in kubachour/google-ads-uac-scripts (PROVEN_API_EXAMPLES.md).

import { googleAdsMutate, googleAdsQuery, normalizeCustomerId } from "./client.js";

export const APP_AD_CAPS = {
  images: 20,
  youtubeVideos: 20,
  headlines: 5,
  descriptions: 5,
} as const;

export const TEXT_LIMITS = { headlines: 30, descriptions: 90 } as const;

export type AppAdField = keyof typeof APP_AD_CAPS;

const FIELD_TO_MASK: Record<AppAdField, string> = {
  images: "app_ad.images",
  youtubeVideos: "app_ad.youtube_videos",
  headlines: "app_ad.headlines",
  descriptions: "app_ad.descriptions",
};

export interface AppAdState {
  adResourceName: string;
  adGroupName: string;
  campaignName: string;
  images: string[]; // asset resource names
  youtubeVideos: string[]; // asset resource names
  headlines: string[]; // text
  descriptions: string[]; // text
}

/** Accept a bare asset ID or a full resource name. */
export function toAssetResourceName(customerId: string, idOrName: string): string {
  if (idOrName.startsWith("customers/")) return idOrName;
  return `customers/${normalizeCustomerId(customerId)}/assets/${idOrName}`;
}

/** Read the (single, enabled) App ad of an ad group. */
export async function getAppAd(customerId: string, adGroupId: string): Promise<AppAdState> {
  const query = `
    SELECT ad_group_ad.ad.resource_name, ad_group.name, campaign.name,
      ad_group_ad.ad.app_ad.images, ad_group_ad.ad.app_ad.youtube_videos,
      ad_group_ad.ad.app_ad.headlines, ad_group_ad.ad.app_ad.descriptions
    FROM ad_group_ad
    WHERE ad_group.id = ${adGroupId}
      AND ad_group_ad.ad.type = APP_AD
      AND ad_group_ad.status != REMOVED`;
  const chunks = await googleAdsQuery(customerId, query);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = chunks.flatMap((c) => (c as { results?: unknown[] }).results ?? []);
  if (rows.length === 0) {
    throw new Error(`No App ad found in ad group ${adGroupId} (is this an App campaign ad group?)`);
  }
  if (rows.length > 1) {
    throw new Error(`Ad group ${adGroupId} has ${rows.length} App ads; expected exactly one.`);
  }
  const r = rows[0];
  const app = r.adGroupAd?.ad?.appAd ?? {};
  const assets = (xs?: { asset?: string }[]) => (xs ?? []).map((x) => x.asset ?? "").filter(Boolean);
  const texts = (xs?: { text?: string }[]) => (xs ?? []).map((x) => x.text ?? "").filter(Boolean);
  return {
    adResourceName: r.adGroupAd.ad.resourceName,
    adGroupName: r.adGroup?.name ?? "",
    campaignName: r.campaign?.name ?? "",
    images: assets(app.images),
    youtubeVideos: assets(app.youtubeVideos),
    headlines: texts(app.headlines),
    descriptions: texts(app.descriptions),
  };
}

export interface AddToAppAdInput {
  images?: string[]; // asset resource names
  youtubeVideos?: string[]; // asset resource names
  headlines?: string[];
  descriptions?: string[];
}

export interface FieldPlan {
  field: AppAdField;
  current: number;
  added: string[];
  skippedDuplicate: string[];
  skippedOverCap: string[];
  skippedTooLong: string[];
  final: string[];
}

/** Work out what an append would do, without calling the API. */
export function planAppAdAdditions(state: AppAdState, input: AddToAppAdInput): FieldPlan[] {
  const plans: FieldPlan[] = [];
  for (const field of Object.keys(APP_AD_CAPS) as AppAdField[]) {
    const incoming = input[field];
    if (!incoming || incoming.length === 0) continue;
    const current = state[field];
    const final = [...current];
    const plan: FieldPlan = {
      field,
      current: current.length,
      added: [],
      skippedDuplicate: [],
      skippedOverCap: [],
      skippedTooLong: [],
      final,
    };
    for (const item of incoming) {
      const limit = (TEXT_LIMITS as Record<string, number>)[field];
      if (limit && item.length > limit) plan.skippedTooLong.push(item);
      else if (final.includes(item)) plan.skippedDuplicate.push(item);
      else if (final.length >= APP_AD_CAPS[field]) plan.skippedOverCap.push(item);
      else {
        final.push(item);
        plan.added.push(item);
      }
    }
    plans.push(plan);
  }
  return plans;
}

/** Apply planned additions in one ad update. Returns the plans actually applied. */
export async function applyAppAdAdditions(
  customerId: string,
  state: AppAdState,
  plans: FieldPlan[]
): Promise<FieldPlan[]> {
  const changed = plans.filter((p) => p.added.length > 0);
  if (changed.length === 0) return changed;
  const appAd: Record<string, unknown> = {};
  for (const p of changed) {
    appAd[p.field] =
      p.field === "headlines" || p.field === "descriptions"
        ? p.final.map((text) => ({ text }))
        : p.final.map((asset) => ({ asset }));
  }
  await googleAdsMutate(customerId, [
    {
      adOperation: {
        update: { resourceName: state.adResourceName, appAd },
        updateMask: changed.map((p) => FIELD_TO_MASK[p.field]).join(","),
      },
    },
  ]);
  return changed;
}

/** Human-readable summary of plans (used by tools for dry runs and results). */
export function formatPlans(state: AppAdState, plans: FieldPlan[], dryRun: boolean): string {
  let text = `${dryRun ? "**Dry run** — " : ""}App ad in "${state.adGroupName}" (${state.campaignName})\n`;
  for (const p of plans) {
    text += `\n- ${p.field}: ${p.current} → ${p.final.length}/${APP_AD_CAPS[p.field]}`;
    if (p.added.length) text += `, ${dryRun ? "would add" : "added"} ${p.added.length}`;
    if (p.skippedDuplicate.length) text += `, ${p.skippedDuplicate.length} already there`;
    if (p.skippedOverCap.length) text += `, ${p.skippedOverCap.length} skipped (slot cap full; remove a "Low" asset first, after checking its CPI)`;
    if (p.skippedTooLong.length) text += `, ${p.skippedTooLong.length} skipped (over ${(TEXT_LIMITS as Record<string, number>)[p.field]} chars: ${p.skippedTooLong.map((t) => `"${t}"`).join(", ")})`;
  }
  return text;
}
