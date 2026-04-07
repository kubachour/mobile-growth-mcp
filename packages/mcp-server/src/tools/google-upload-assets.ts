import { z } from "zod";
import { readFile } from "fs/promises";
import { basename, resolve } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  googleAdsMutate,
  normalizeCustomerId,
  type MutateOperation,
} from "../google/client.js";

/**
 * Fetch a URL and return its contents as a base64 string.
 * Works for both http(s) URLs and data: URIs.
 */
async function fetchAsBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) {
    const commaIdx = url.indexOf(",");
    if (commaIdx === -1) throw new Error("Invalid data URI");
    return url.slice(commaIdx + 1);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

/**
 * Read a local file and return its contents as base64.
 */
async function readFileAsBase64(filePath: string): Promise<string> {
  const buf = await readFile(resolve(filePath));
  return buf.toString("base64");
}

export function registerUploadGoogleImageAssets(server: McpServer): void {
  server.tool(
    "upload_google_image_assets",
    "Upload image assets to a Google Ads account. Accepts URLs or local file paths. " +
      "Each image becomes an Asset resource in the account. Optionally link assets to a " +
      "campaign or ad group after upload. Supports batch upload (up to 50 images per call).",
    {
      customer_id: z.string().describe("Google Ads customer ID"),
      images: z
        .array(
          z.object({
            source: z
              .string()
              .describe(
                "Image URL (https://...) or local file path (/path/to/image.png)"
              ),
            name: z
              .string()
              .optional()
              .describe(
                "Asset name in Google Ads (default: filename from source)"
              ),
          })
        )
        .min(1)
        .max(50)
        .describe("Array of images to upload (max 50 per call)"),
      campaign_id: z
        .string()
        .optional()
        .describe(
          "Link uploaded assets to this campaign (creates CampaignAsset links)"
        ),
      ad_group_id: z
        .string()
        .optional()
        .describe(
          "Link uploaded assets to this ad group (creates AdGroupAsset links). Takes priority over campaign_id."
        ),
      field_type: z
        .enum(["IMAGE", "LANDSCAPE_LOGO", "LOGO", "MARKETING_IMAGE", "SQUARE_MARKETING_IMAGE", "PORTRAIT_MARKETING_IMAGE"])
        .optional()
        .describe("Asset field type when linking to campaign/ad group (default: IMAGE)"),
      dry_run: z
        .boolean()
        .optional()
        .describe("Preview what would be uploaded without making changes"),
    },
    async ({
      customer_id,
      images,
      campaign_id,
      ad_group_id,
      field_type,
      dry_run,
    }) => {
      try {
        const normalizedId = normalizeCustomerId(customer_id);
        const effectiveFieldType = field_type ?? "IMAGE";

        // --- Dry run ---
        if (dry_run) {
          let text = `**Dry run** — would upload ${images.length} image(s) to customer ${customer_id}\n\n`;
          for (const img of images) {
            const name =
              img.name ?? basename(img.source).replace(/\?.*$/, "") ?? "unnamed";
            text += `- ${name} ← ${img.source}\n`;
          }
          if (ad_group_id) {
            text += `\nWould link to ad group ${ad_group_id} as ${effectiveFieldType}`;
          } else if (campaign_id) {
            text += `\nWould link to campaign ${campaign_id} as ${effectiveFieldType}`;
          }
          return { content: [{ type: "text" as const, text }] };
        }

        // --- Step 1: Create Asset resources ---
        const assetOps: MutateOperation[] = [];
        const assetNames: string[] = [];

        for (const img of images) {
          const name =
            img.name ?? basename(img.source).replace(/\?.*$/, "") ?? "unnamed";
          assetNames.push(name);

          const isUrl =
            img.source.startsWith("http://") ||
            img.source.startsWith("https://") ||
            img.source.startsWith("data:");
          const data = isUrl
            ? await fetchAsBase64(img.source)
            : await readFileAsBase64(img.source);

          assetOps.push({
            assetOperation: {
              create: {
                name,
                type: "IMAGE",
                imageAsset: { data },
              },
            },
          });
        }

        const assetResult = await googleAdsMutate(normalizedId, assetOps);
        const createdResourceNames = assetResult.mutateOperationResponses.map(
          (r) => r.assetResult?.resourceName ?? ""
        );

        const successCount = createdResourceNames.filter(Boolean).length;

        let text = `**Uploaded ${successCount}/${images.length} image assets**\n\n`;
        for (let i = 0; i < images.length; i++) {
          const rn = createdResourceNames[i];
          if (rn) {
            text += `✓ ${assetNames[i]} → ${rn}\n`;
          } else {
            text += `✗ ${assetNames[i]} — failed\n`;
          }
        }

        // --- Step 2: Link to campaign or ad group (optional) ---
        if (successCount > 0 && (ad_group_id || campaign_id)) {
          const linkOps: MutateOperation[] = [];

          for (const resourceName of createdResourceNames) {
            if (!resourceName) continue;

            if (ad_group_id) {
              linkOps.push({
                adGroupAssetOperation: {
                  create: {
                    adGroup: `customers/${normalizedId}/adGroups/${ad_group_id}`,
                    asset: resourceName,
                    fieldType: effectiveFieldType,
                  },
                },
              });
            } else if (campaign_id) {
              linkOps.push({
                campaignAssetOperation: {
                  create: {
                    campaign: `customers/${normalizedId}/campaigns/${campaign_id}`,
                    asset: resourceName,
                    fieldType: effectiveFieldType,
                  },
                },
              });
            }
          }

          try {
            await googleAdsMutate(normalizedId, linkOps);
            const linkTarget = ad_group_id
              ? `ad group ${ad_group_id}`
              : `campaign ${campaign_id}`;
            text += `\n✓ Linked ${successCount} assets to ${linkTarget} as ${effectiveFieldType}`;
          } catch (linkErr) {
            text += `\n⚠️ Assets uploaded but linking failed: ${linkErr instanceof Error ? linkErr.message : String(linkErr)}`;
            text += `\nAssets exist in the account and can be linked manually.`;
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
