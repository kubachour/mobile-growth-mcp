import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { googleAdsQuery } from "../google/client.js";
import { resolveCampaignId, resolveAdGroupId } from "../google/format.js";
import type { GoogleAdsRow, GoogleAdsAsset } from "../google/types.js";

interface AssetEntry {
  asset: GoogleAdsAsset;
  fieldType: string;
  performanceLabel: string;
  adGroupName: string;
}

const SLOT_LIMITS: Record<string, number> = {
  HEADLINE: 5,
  DESCRIPTION: 5,
  IMAGE: 20,
  YOUTUBE_VIDEO: 20,
  MEDIA_BUNDLE: 20,
};

function classifyOrientation(w?: number, h?: number): "landscape" | "portrait" | "square" | "unknown" {
  if (!w || !h) return "unknown";
  if (w > h * 1.05) return "landscape";
  if (h > w * 1.05) return "portrait";
  return "square";
}

export function registerGetGoogleAdsAssets(server: McpServer): void {
  server.tool(
    "get_google_assets",
    "List creative assets linked to a campaign or ad group with metadata, performance labels, and slot utilization audit. Google allows up to 5 headlines, 5 descriptions, 20 images, 20 videos, 20 HTML5 per ad group. Missing asset types mean missing inventory channels. Google's built-in asset ratings (Low/Good/Best) measure scalability, not conversion value — evaluate by your own CPA/ROAS (ab-pt-008).",
    {
      customer_id: z
        .string()
        .describe("Google Ads customer ID"),
      campaign_id: z
        .string()
        .optional()
        .describe("Scope to a specific campaign"),
      ad_group_id: z
        .string()
        .optional()
        .describe("Scope to a specific ad group"),
      asset_type: z
        .array(z.enum(["IMAGE", "YOUTUBE_VIDEO", "TEXT", "MEDIA_BUNDLE"]))
        .optional()
        .describe("Filter by asset type"),
      include_slot_audit: z
        .boolean()
        .optional()
        .describe("Include slot utilization audit (default true)"),
      limit: z
        .number()
        .min(1)
        .max(500)
        .optional()
        .describe("Max results to return (default 50)"),
    },
    async ({ customer_id, campaign_id, ad_group_id, asset_type, include_slot_audit, limit }) => {
      try {
        const rowLimit = limit ?? 50;
        const showAudit = include_slot_audit !== false;

        const conditions: string[] = [
          "campaign.status = 'ENABLED'",
        ];
        if (campaign_id) {
          const resolvedCampaignId = await resolveCampaignId(customer_id, campaign_id);
          conditions.push(`campaign.id = ${resolvedCampaignId}`);
        }
        if (ad_group_id) {
          const resolvedAdGroupId = await resolveAdGroupId(customer_id, ad_group_id, campaign_id);
          conditions.push(`ad_group.id = ${resolvedAdGroupId}`);
        }
        if (asset_type?.length) {
          const typeList = asset_type.map((t) => `'${t}'`).join(", ");
          conditions.push(`asset.type IN (${typeList})`);
        }

        const query = `
          SELECT
            asset.id,
            asset.name,
            asset.type,
            asset.text_asset.text,
            asset.image_asset.full_size.url,
            asset.image_asset.full_size.width_pixels,
            asset.image_asset.full_size.height_pixels,
            asset.youtube_video_asset.youtube_video_id,
            asset.youtube_video_asset.youtube_video_title,
            ad_group_ad_asset_view.field_type,
            ad_group_ad_asset_view.performance_label,
            ad_group.id,
            ad_group.name,
            campaign.id,
            campaign.name
          FROM ad_group_ad_asset_view
          WHERE ${conditions.join("\n  AND ")}
          LIMIT ${rowLimit}
        `;

        const chunks = await googleAdsQuery(customer_id, query);
        const rows: GoogleAdsRow[] = chunks.flatMap((c) => c.results ?? []);

        if (rows.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No assets found matching filters.",
            }],
          };
        }

        // Group by asset type
        const assets: AssetEntry[] = rows
          .filter((r) => r.asset)
          .map((r) => ({
            asset: r.asset!,
            fieldType: r.adGroupAdAssetView?.fieldType ?? "—",
            performanceLabel: r.adGroupAdAssetView?.performanceLabel ?? "—",
            adGroupName: r.adGroup?.name ?? "—",
          }));

        const textAssets = assets.filter((a) => a.asset.type === "TEXT");
        const imageAssets = assets.filter((a) => a.asset.type === "IMAGE");
        const videoAssets = assets.filter((a) => a.asset.type === "YOUTUBE_VIDEO");
        const bundleAssets = assets.filter((a) => a.asset.type === "MEDIA_BUNDLE");

        const campaignName = rows[0]?.campaign?.name ?? "Unknown Campaign";
        const adGroupName = ad_group_id && rows[0]?.adGroup?.name
          ? ` / "${rows[0].adGroup.name}"`
          : "";

        let text = `## Assets for "${campaignName}"${adGroupName} (${assets.length} found)\n\n`;

        // Text assets
        if (textAssets.length > 0) {
          text += "### Text Assets\n";
          text += "| Asset | Field | Content | Label |\n|---|---|---|---|\n";
          for (const a of textAssets) {
            const content = a.asset.textAsset?.text ?? "—";
            text += `| ${a.asset.name} | ${a.fieldType} | ${content} | ${a.performanceLabel} |\n`;
          }
          text += "\n";
        }

        // Image assets
        if (imageAssets.length > 0) {
          text += "### Image Assets\n";
          text += "| Asset | Dimensions | Ratio | Label |\n|---|---|---|---|\n";
          for (const a of imageAssets) {
            const img = a.asset.imageAsset?.fullSize;
            const w = img?.widthPixels;
            const h = img?.heightPixels;
            const dims = w && h ? `${w}x${h}` : "—";
            const ratio = w && h ? `${(w / h).toFixed(2)}:1` : "—";
            text += `| ${a.asset.name} | ${dims} | ${ratio} | ${a.performanceLabel} |\n`;
          }
          text += "\n";
        }

        // Video assets
        if (videoAssets.length > 0) {
          text += "### Video Assets\n";
          text += "| Asset | YouTube ID | Title | Label |\n|---|---|---|---|\n";
          for (const a of videoAssets) {
            const yt = a.asset.youtubeVideoAsset;
            text += `| ${a.asset.name} | ${yt?.youtubeVideoId ?? "—"} | ${yt?.youtubeVideoTitle ?? "—"} | ${a.performanceLabel} |\n`;
          }
          text += "\n";
        }

        // HTML5/Media bundle
        if (bundleAssets.length > 0) {
          text += "### HTML5 Assets\n";
          text += "| Asset | Field | Label |\n|---|---|---|\n";
          for (const a of bundleAssets) {
            text += `| ${a.asset.name} | ${a.fieldType} | ${a.performanceLabel} |\n`;
          }
          text += "\n";
        }

        // Slot audit
        if (showAudit) {
          // Group by ad group for audit
          const adGroups = new Map<string, AssetEntry[]>();
          for (const a of assets) {
            const key = a.adGroupName;
            if (!adGroups.has(key)) adGroups.set(key, []);
            adGroups.get(key)!.push(a);
          }

          for (const [agName, agAssets] of adGroups) {
            const headlines = agAssets.filter((a) => a.fieldType === "HEADLINE");
            const descriptions = agAssets.filter((a) => a.fieldType === "DESCRIPTION");
            const images = agAssets.filter((a) => a.asset.type === "IMAGE");
            const videos = agAssets.filter((a) => a.asset.type === "YOUTUBE_VIDEO");
            const html5 = agAssets.filter((a) => a.asset.type === "MEDIA_BUNDLE");

            // Check video orientations
            const orientations = new Set<string>();
            for (const v of videos) {
              // Videos don't have dimension info from this query — note it
              orientations.add("unknown");
            }
            // For images linked as video creative, check orientation via image dimensions
            // Video orientation check is best-effort since GAQL doesn't return video dimensions
            const hasLandscape = images.some((a) => classifyOrientation(a.asset.imageAsset?.fullSize?.widthPixels, a.asset.imageAsset?.fullSize?.heightPixels) === "landscape");
            const hasPortrait = images.some((a) => classifyOrientation(a.asset.imageAsset?.fullSize?.widthPixels, a.asset.imageAsset?.fullSize?.heightPixels) === "portrait");
            const hasSquare = images.some((a) => classifyOrientation(a.asset.imageAsset?.fullSize?.widthPixels, a.asset.imageAsset?.fullSize?.heightPixels) === "square");

            text += `### Slot Utilization — "${agName}"\n`;
            text += "| Asset Type | Filled | Max | Status |\n|---|---|---|---|\n";

            const slotRow = (label: string, count: number, max: number, extra?: string) => {
              const pct = count >= max ? "✅ Full" : count >= Math.ceil(max * 0.6) ? "✅ OK" : `⚠️ Below Excellent (need ${max})`;
              return `| ${label} | ${count} | ${max} | ${extra ?? pct} |\n`;
            };

            text += slotRow("Headlines", headlines.length, SLOT_LIMITS.HEADLINE);
            text += slotRow("Descriptions", descriptions.length, SLOT_LIMITS.DESCRIPTION);
            text += slotRow("Images", images.length, SLOT_LIMITS.IMAGE,
              images.length > 0
                ? (hasLandscape && hasPortrait && hasSquare
                    ? "✅ OK (has landscape + portrait + square)"
                    : `⚠️ Missing orientations: ${[!hasLandscape && "landscape", !hasPortrait && "portrait", !hasSquare && "square"].filter(Boolean).join(", ")}`)
                : "⚠️ No images");
            text += slotRow("Videos", videos.length, SLOT_LIMITS.YOUTUBE_VIDEO,
              videos.length > 0 ? "✅ OK" : "⚠️ No videos — missing YouTube inventory");
            text += `| HTML5 | ${html5.length} | ${SLOT_LIMITS.MEDIA_BUNDLE} | ${html5.length > 0 ? "✅ OK" : "— Not required"} |\n`;

            // Ad Strength estimate
            const issues: string[] = [];
            if (headlines.length < 5) issues.push(`${5 - headlines.length} headlines`);
            if (descriptions.length < 5) issues.push(`${5 - descriptions.length} descriptions`);
            if (!hasLandscape) issues.push("landscape image");
            // Video orientations not checkable from this query
            const strength = issues.length === 0 ? "Excellent" : issues.length <= 2 ? "Good" : "Poor";
            text += `\n**Ad Strength: ${strength}**`;
            if (issues.length > 0) {
              text += ` (missing ${issues.join(" and ")} for Excellent)`;
            }
            text += "\n\n";
          }
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
