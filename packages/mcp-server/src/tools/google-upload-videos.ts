import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  googleAdsMutate,
  googleAdsQuery,
  normalizeCustomerId,
  type MutateOperation,
} from "../google/client.js";
import { resolveAdGroupId } from "../google/format.js";
import { applyAppAdAdditions, formatPlans, getAppAd, planAppAdAdditions } from "../google/app-ad.js";

/** Extract an 11-char YouTube video ID from an ID or any common YouTube URL. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** Existing YouTube video assets in the account, keyed by video ID. */
async function existingVideoAssets(customerId: string, ids: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (ids.length === 0) return found;
  const list = ids.map((id) => `'${id}'`).join(", ");
  const query = `SELECT asset.resource_name, asset.youtube_video_asset.youtube_video_id FROM asset WHERE asset.type = YOUTUBE_VIDEO AND asset.youtube_video_asset.youtube_video_id IN (${list})`;
  const chunks = await googleAdsQuery(customerId, query);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of chunks.flatMap((c) => (c as { results?: any[] }).results ?? [])) {
    const vid = row.asset?.youtubeVideoAsset?.youtubeVideoId;
    if (vid && !found.has(vid)) found.set(vid, row.asset.resourceName);
  }
  return found;
}

export function registerUploadGoogleVideoAssets(server: McpServer): void {
  server.tool(
    "upload_google_video_assets",
    "Add YouTube videos as video assets in a Google Ads account. Google Ads can't take video files: " +
      "upload the video to YouTube first (public or unlisted), then pass its ID or URL here. " +
      "Skips videos that already exist as assets (matched by YouTube video ID). Optionally adds them " +
      "to an App campaign ad group's ad (max 20 videos per ad). Up to 50 videos per call. " +
      "Tip: name videos by length and theme (e.g. 30s_UGC_feature1) so asset reports stay readable.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      videos: z
        .array(
          z.object({
            youtube: z.string().describe("YouTube video ID (11 chars) or URL (watch, youtu.be, shorts)"),
            name: z.string().optional().describe("Asset name in Google Ads (default: the video ID)"),
          })
        )
        .min(1)
        .max(50),
      ad_group_id: z
        .string()
        .optional()
        .describe("App campaign ad group (ID or exact name) whose ad should get these videos"),
      dry_run: z.boolean().optional().describe("Preview without making changes"),
    },
    async ({ customer_id, videos, ad_group_id, dry_run }) => {
      try {
        const cid = normalizeCustomerId(customer_id);
        const parsed = videos.map((v) => ({ ...v, id: parseYouTubeId(v.youtube) }));
        const invalid = parsed.filter((v) => !v.id);
        const valid = parsed.filter((v): v is typeof v & { id: string } => !!v.id);
        const uniqueIds = [...new Set(valid.map((v) => v.id))];
        const existing = await existingVideoAssets(cid, uniqueIds);
        const toCreate = valid.filter((v, i) => !existing.has(v.id) && valid.findIndex((x) => x.id === v.id) === i);

        let text = `${dry_run ? "**Dry run** — " : ""}**YouTube video assets** for customer ${customer_id}\n\n`;
        for (const v of invalid) text += `✗ "${v.youtube}" — not a YouTube ID or URL\n`;
        for (const [vid, rn] of existing) text += `= ${vid} already exists → ${rn}\n`;

        const resourceById = new Map(existing);
        if (dry_run) {
          for (const v of toCreate) text += `+ would create ${v.name ?? v.id} (${v.id})\n`;
        } else if (toCreate.length > 0) {
          const ops: MutateOperation[] = toCreate.map((v) => ({
            assetOperation: {
              create: { name: v.name ?? v.id, type: "YOUTUBE_VIDEO", youtubeVideoAsset: { youtubeVideoId: v.id } },
            },
          }));
          const res = await googleAdsMutate(cid, ops);
          res.mutateOperationResponses.forEach((r, i) => {
            const rn = r.assetResult?.resourceName ?? "";
            if (rn) resourceById.set(toCreate[i].id, rn);
            text += rn ? `✓ ${toCreate[i].name ?? toCreate[i].id} → ${rn}\n` : `✗ ${toCreate[i].id} — create failed\n`;
          });
        }

        if (ad_group_id) {
          const agId = await resolveAdGroupId(cid, ad_group_id);
          const state = await getAppAd(cid, agId);
          const names = uniqueIds.map((id) => resourceById.get(id)).filter((x): x is string => !!x);
          if (dry_run) {
            // New assets have no resource name yet; plan with placeholders so caps are checked.
            const placeholders = toCreate.map((v) => `new:${v.id}`);
            const plans = planAppAdAdditions(state, { youtubeVideos: [...names, ...placeholders] });
            text += "\n" + formatPlans(state, plans, true);
          } else {
            const plans = planAppAdAdditions(state, { youtubeVideos: names });
            await applyAppAdAdditions(cid, state, plans);
            text += "\n" + formatPlans(state, plans, false);
          }
        }
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );
}
