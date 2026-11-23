import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { normalizeCustomerId } from "../google/client.js";
import { resolveAdGroupId } from "../google/format.js";
import {
  APP_AD_CAPS,
  applyAppAdAdditions,
  formatPlans,
  getAppAd,
  planAppAdAdditions,
  toAssetResourceName,
} from "../google/app-ad.js";

export function registerAddAssetsToAppAd(server: McpServer): void {
  server.tool(
    "add_assets_to_app_ad",
    "Add existing assets and new text to an App campaign ad group's ad. Keeps everything already " +
      "in the ad (Google replaces the whole array on update, so this tool reads it first and appends). " +
      `Enforces per-ad caps: ${APP_AD_CAPS.headlines} headlines (30 chars), ${APP_AD_CAPS.descriptions} descriptions (90 chars), ` +
      `${APP_AD_CAPS.images} images, ${APP_AD_CAPS.youtubeVideos} videos. Does not remove anything. ` +
      "Use upload_google_image_assets / upload_google_video_assets first to create the assets.",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      ad_group_id: z.string().describe("App campaign ad group (ID or exact name)"),
      image_asset_ids: z.array(z.string()).optional().describe("Image asset IDs or resource names"),
      video_asset_ids: z.array(z.string()).optional().describe("YouTube video asset IDs or resource names"),
      headlines: z.array(z.string()).optional().describe("New headline texts (max 30 chars each)"),
      descriptions: z.array(z.string()).optional().describe("New description texts (max 90 chars each)"),
      dry_run: z.boolean().optional().describe("Preview without making changes"),
    },
    async ({ customer_id, ad_group_id, image_asset_ids, video_asset_ids, headlines, descriptions, dry_run }) => {
      try {
        const cid = normalizeCustomerId(customer_id);
        const agId = await resolveAdGroupId(cid, ad_group_id);
        const state = await getAppAd(cid, agId);
        const plans = planAppAdAdditions(state, {
          images: image_asset_ids?.map((x) => toAssetResourceName(cid, x)),
          youtubeVideos: video_asset_ids?.map((x) => toAssetResourceName(cid, x)),
          headlines,
          descriptions,
        });
        if (plans.length === 0) {
          return { content: [{ type: "text" as const, text: "Nothing to add: pass assets, headlines or descriptions." }] };
        }
        if (!dry_run) await applyAppAdAdditions(cid, state, plans);
        return { content: [{ type: "text" as const, text: formatPlans(state, plans, !!dry_run) }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    }
  );
}
