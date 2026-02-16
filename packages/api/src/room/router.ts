import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { PrismaClient } from "@dubai/db";
import { aiClient, classifyRoomTypeByName } from "@dubai/ai-client";
import {
  addRoomPhotoInput,
  createProjectInput,
  createRoomInput,
  deleteRoomPhotoInput,
  paginationInput,
  reorderPhotosInput,
  reorderRoomsInput,
  setRoomTypeInput,
  updateProjectInput,
  updateRoomInput,
  uploadFloorPlanInput,
} from "@dubai/validators";

import { authedProcedure } from "../trpc";

// ═══════════════════════════════════════════
// Helper: verify user owns the project
// ═══════════════════════════════════════════

async function verifyProjectOwnership(
  db: PrismaClient,
  projectId: string,
  userId: string,
) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return project;
}

async function verifyRoomOwnership(
  db: PrismaClient,
  roomId: string,
  userId: string,
) {
  const room = await db.room.findFirst({
    where: { id: roomId, project: { userId } },
    select: { id: true, projectId: true },
  });
  if (!room) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
  }
  return room;
}

// ═══════════════════════════════════════════
// Room Router — Stories 2.1–2.6
// ═══════════════════════════════════════════

export const roomRouter = {
  // ─── Story 2.1: Project CRUD ───

  createProject: authedProcedure
    .input(createProjectInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.project.create({
        data: {
          userId: ctx.user.id,
          name: input.name,
          address: input.address ?? null,
        },
        select: {
          id: true,
          name: true,
          address: true,
          createdAt: true,
        },
      });
    }),

  listProjects: authedProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const projects = await ctx.db.project.findMany({
        where: { userId: ctx.user.id },
        orderBy: { updatedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          name: true,
          address: true,
          floorPlanThumbUrl: true,
          updatedAt: true,
          _count: { select: { rooms: true } },
        },
      });

      let nextCursor: string | undefined;
      if (projects.length > input.limit) {
        const next = projects.pop();
        nextCursor = next?.id;
      }

      return { items: projects, nextCursor };
    }),

  getProject: authedProcedure
    .input(z.object({ projectId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.project.findFirst({
        where: { id: input.projectId, userId: ctx.user.id },
        select: {
          id: true,
          name: true,
          address: true,
          floorPlanUrl: true,
          floorPlanThumbUrl: true,
          createdAt: true,
          updatedAt: true,
          rooms: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              name: true,
              type: true,
              widthCm: true,
              lengthCm: true,
              heightCm: true,
              displayUnit: true,
              orderIndex: true,
              _count: { select: { photos: true } },
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      return project;
    }),

  updateProject: authedProcedure
    .input(updateProjectInput)
    .mutation(async ({ ctx, input }) => {
      await verifyProjectOwnership(ctx.db, input.projectId, ctx.user.id);

      return ctx.db.project.update({
        where: { id: input.projectId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
        },
        select: { id: true, name: true, address: true, updatedAt: true },
      });
    }),

  deleteProject: authedProcedure
    .input(z.object({ projectId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyProjectOwnership(ctx.db, input.projectId, ctx.user.id);

      await ctx.db.project.delete({ where: { id: input.projectId } });
      return { success: true };
    }),

  // ─── Story 2.2: Room CRUD with dimensions ───

  createRoom: authedProcedure
    .input(createRoomInput)
    .mutation(async ({ ctx, input }) => {
      await verifyProjectOwnership(ctx.db, input.projectId, ctx.user.id);

      // Get next orderIndex
      const lastRoom = await ctx.db.room.findFirst({
        where: { projectId: input.projectId },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });

      return ctx.db.room.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          type: input.type,
          widthCm: input.widthCm ?? null,
          lengthCm: input.lengthCm ?? null,
          heightCm: input.heightCm ?? null,
          displayUnit: input.displayUnit,
          orderIndex: (lastRoom?.orderIndex ?? -1) + 1,
        },
        select: {
          id: true,
          name: true,
          type: true,
          widthCm: true,
          lengthCm: true,
          heightCm: true,
          displayUnit: true,
          orderIndex: true,
        },
      });
    }),

  getRoom: authedProcedure
    .input(z.object({ roomId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const room = await ctx.db.room.findFirst({
        where: { id: input.roomId, project: { userId: ctx.user.id } },
        select: {
          id: true,
          projectId: true,
          name: true,
          type: true,
          typeConfidence: true,
          typeSource: true,
          widthCm: true,
          lengthCm: true,
          heightCm: true,
          displayUnit: true,
          orderIndex: true,
          createdAt: true,
          updatedAt: true,
          photos: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              storageUrl: true,
              thumbnailUrl: true,
              orderIndex: true,
              uploadedAt: true,
            },
          },
        },
      });

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }

      return room;
    }),

  updateRoom: authedProcedure
    .input(updateRoomInput)
    .mutation(async ({ ctx, input }) => {
      await verifyRoomOwnership(ctx.db, input.roomId, ctx.user.id);

      return ctx.db.room.update({
        where: { id: input.roomId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.widthCm !== undefined ? { widthCm: input.widthCm } : {}),
          ...(input.lengthCm !== undefined ? { lengthCm: input.lengthCm } : {}),
          ...(input.heightCm !== undefined ? { heightCm: input.heightCm } : {}),
          ...(input.displayUnit !== undefined
            ? { displayUnit: input.displayUnit }
            : {}),
        },
        select: {
          id: true,
          name: true,
          type: true,
          widthCm: true,
          lengthCm: true,
          heightCm: true,
          displayUnit: true,
        },
      });
    }),

  deleteRoom: authedProcedure
    .input(z.object({ roomId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyRoomOwnership(ctx.db, input.roomId, ctx.user.id);

      await ctx.db.room.delete({ where: { id: input.roomId } });
      return { success: true };
    }),

  reorderRooms: authedProcedure
    .input(reorderRoomsInput)
    .mutation(async ({ ctx, input }) => {
      await verifyProjectOwnership(ctx.db, input.projectId, ctx.user.id);

      await ctx.db.$transaction(
        input.roomIds.map((roomId, index) =>
          ctx.db.room.update({
            where: { id: roomId },
            data: { orderIndex: index },
          }),
        ),
      );

      return { success: true };
    }),

  // ─── Story 2.3: Room Photos ───

  addPhoto: authedProcedure
    .input(addRoomPhotoInput)
    .mutation(async ({ ctx, input }) => {
      await verifyRoomOwnership(ctx.db, input.roomId, ctx.user.id);

      return ctx.db.roomPhoto.create({
        data: {
          roomId: input.roomId,
          storageUrl: input.storageUrl,
          thumbnailUrl: input.thumbnailUrl ?? null,
          orderIndex: input.orderIndex,
        },
        select: {
          id: true,
          storageUrl: true,
          thumbnailUrl: true,
          orderIndex: true,
          uploadedAt: true,
        },
      });
    }),

  deletePhoto: authedProcedure
    .input(deleteRoomPhotoInput)
    .mutation(async ({ ctx, input }) => {
      const photo = await ctx.db.roomPhoto.findFirst({
        where: {
          id: input.photoId,
          room: { project: { userId: ctx.user.id } },
        },
        select: { id: true },
      });

      if (!photo) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Photo not found" });
      }

      await ctx.db.roomPhoto.delete({ where: { id: input.photoId } });
      return { success: true };
    }),

  reorderPhotos: authedProcedure
    .input(reorderPhotosInput)
    .mutation(async ({ ctx, input }) => {
      await verifyRoomOwnership(ctx.db, input.roomId, ctx.user.id);

      await ctx.db.$transaction(
        input.photoIds.map((photoId, index) =>
          ctx.db.roomPhoto.update({
            where: { id: photoId },
            data: { orderIndex: index },
          }),
        ),
      );

      return { success: true };
    }),

  // ─── Story 2.4: Floor Plan ───

  uploadFloorPlan: authedProcedure
    .input(uploadFloorPlanInput)
    .mutation(async ({ ctx, input }) => {
      await verifyProjectOwnership(ctx.db, input.projectId, ctx.user.id);

      return ctx.db.project.update({
        where: { id: input.projectId },
        data: {
          floorPlanUrl: input.storageUrl,
          floorPlanThumbUrl: input.thumbnailUrl ?? null,
        },
        select: {
          id: true,
          floorPlanUrl: true,
          floorPlanThumbUrl: true,
        },
      });
    }),

  deleteFloorPlan: authedProcedure
    .input(z.object({ projectId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyProjectOwnership(ctx.db, input.projectId, ctx.user.id);

      return ctx.db.project.update({
        where: { id: input.projectId },
        data: { floorPlanUrl: null, floorPlanThumbUrl: null },
        select: { id: true },
      });
    }),

  // ─── Story 2.6: Room Type ───

  setRoomType: authedProcedure
    .input(setRoomTypeInput)
    .mutation(async ({ ctx, input }) => {
      await verifyRoomOwnership(ctx.db, input.roomId, ctx.user.id);

      return ctx.db.room.update({
        where: { id: input.roomId },
        data: {
          type: input.type,
          typeSource: input.source,
          typeConfidence: input.confidence ?? null,
        },
        select: {
          id: true,
          type: true,
          typeSource: true,
          typeConfidence: true,
        },
      });
    }),

  // ─── AI Room Type Detection ───

  detectRoomType: authedProcedure
    .input(z.object({ roomId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifyRoomOwnership(ctx.db, input.roomId, ctx.user.id);

      // Fetch the room with photos and name
      const room = await ctx.db.room.findFirst({
        where: { id: input.roomId, project: { userId: ctx.user.id } },
        select: {
          id: true,
          name: true,
          photos: {
            select: { storageUrl: true },
            orderBy: { orderIndex: "asc" },
          },
        },
      });

      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      }

      if (room.photos.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Upload room photos first for AI detection",
        });
      }

      const photoUrls = room.photos.map((p) => p.storageUrl);

      let detectedType: string;
      let confidence: number;
      let source: string;

      try {
        const result = await aiClient.classifyRoomType(photoUrls);
        detectedType = result.type;
        confidence = result.confidence;
        source = result.source === "ai" ? "AI_SUGGESTED" : "AI_SUGGESTED";

        // If AI gave low confidence or returned OTHER, try name-based fallback
        if (
          result.source === "fallback" ||
          (result.confidence < 0.3 && result.type === "OTHER")
        ) {
          const nameBased = classifyRoomTypeByName(room.name);
          if (nameBased.confidence > result.confidence) {
            detectedType = nameBased.type;
            confidence = nameBased.confidence;
          }
        }
      } catch {
        // Fallback to name-based heuristic
        const nameBased = classifyRoomTypeByName(room.name);
        detectedType = nameBased.type;
        confidence = nameBased.confidence;
        source = "AI_SUGGESTED";
      }

      // Update the room with detected type
      const updated = await ctx.db.room.update({
        where: { id: input.roomId },
        data: {
          type: detectedType as "LIVING_ROOM",
          typeSource: source as "AI_SUGGESTED",
          typeConfidence: confidence,
        },
        select: {
          id: true,
          type: true,
          typeSource: true,
          typeConfidence: true,
        },
      });

      return updated;
    }),
} satisfies TRPCRouterRecord;
