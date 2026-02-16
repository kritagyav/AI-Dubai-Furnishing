import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { storageClient } from "@dubai/storage";

import { authedProcedure } from "../trpc";

const S3_BUCKET = process.env.S3_BUCKET ?? "dubai-furnishing-uploads";

const purposeSchema = z.enum([
  "product_photo",
  "floor_plan",
  "room_photo",
  "ticket_attachment",
]);

/**
 * Storage router — presigned URL generation for file uploads.
 *
 * All procedures require authentication. The purpose field determines
 * the S3 key prefix and access control rules.
 */
export const storageRouter = {
  /**
   * Generate a presigned upload URL.
   * Returns the presigned URL and the storage key for later reference.
   */
  getUploadUrl: authedProcedure
    .input(
      z.object({
        purpose: purposeSchema,
        filename: z.string().min(1).max(255),
        contentType: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { purpose, filename, contentType } = input;

      let key: string;

      switch (purpose) {
        case "product_photo": {
          // For product photos, use the user's ID as retailer identifier
          key = storageClient.getProductPhotoKey(
            ctx.user.id,
            crypto.randomUUID(),
            filename,
          );
          break;
        }
        case "floor_plan": {
          // Generate a project-scoped key
          key = storageClient.getFloorPlanKey(crypto.randomUUID(), filename);
          break;
        }
        case "room_photo": {
          key = storageClient.getRoomPhotoKey(crypto.randomUUID(), filename);
          break;
        }
        case "ticket_attachment": {
          key = `support/tickets/${ctx.user.id}/${crypto.randomUUID()}/${filename}`;
          break;
        }
        default: {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid upload purpose",
          });
        }
      }

      const result = await storageClient.generateUploadUrl(
        S3_BUCKET,
        key,
        contentType,
      );

      return {
        uploadUrl: result.url,
        key: result.key,
      };
    }),
} satisfies TRPCRouterRecord;
