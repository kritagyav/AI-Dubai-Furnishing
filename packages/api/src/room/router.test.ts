import { TRPCError } from "@trpc/server";
import { vi } from "vitest";

// ─── Imports ───

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

// ─── Mock external dependencies ───

// vi.hoisted ensures these are available when vi.mock factories run (hoisted to top)
const { mockAiClient, mockClassifyRoomTypeByName } = vi.hoisted(() => ({
  mockAiClient: {
    classifyRoomType: vi.fn(),
  },
  mockClassifyRoomTypeByName: vi.fn(),
}));

vi.mock("@dubai/db", () => ({
  prisma: {},
  scopedClient: vi.fn(),
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    }),
  })),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

vi.mock("../audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@dubai/ai-client", () => ({
  aiClient: mockAiClient,
  classifyRoomTypeByName: mockClassifyRoomTypeByName,
}));

const createCaller = createCallerFactory(appRouter);

// ─── Helpers ───

const TEST_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_UUID_2 = "b2c3d4e5-f6a7-8901-bcde-f12345678901";

function createMockDb() {
  return {
    project: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    room: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    roomPhoto: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

function authedUserCtx(db: ReturnType<typeof createMockDb>, userId = "user-1") {
  db.user.findUnique.mockResolvedValue({
    id: userId,
    role: "USER",
    tenantId: null,
    email: "user@test.com",
    name: "Test User",
  });

  return {
    session: { user: { id: "supabase-user-1" } },
    headers: new Headers(),
    db: db as any,
    supabase: { auth: { getSession: vi.fn() } } as any,
    source: "test",
    correlationId: "test-corr",
  };
}

function unauthCtx(db: ReturnType<typeof createMockDb>) {
  return {
    session: null,
    headers: new Headers(),
    db: db as any,
    supabase: { auth: { getSession: vi.fn() } } as any,
    source: "test",
    correlationId: "test-corr",
  };
}

// ═══════════════════════════════════════════
// Project CRUD Tests
// ═══════════════════════════════════════════

describe("room.createProject", () => {
  it("creates project for user", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.create.mockResolvedValue({
      id: "proj-1",
      name: "My Villa",
      address: "Dubai Marina",
      createdAt: new Date(),
    });

    const result = await caller.room.createProject({
      name: "My Villa",
      address: "Dubai Marina",
    });

    expect(result.id).toBe("proj-1");
    expect(result.name).toBe("My Villa");
    expect(result.address).toBe("Dubai Marina");
    expect(db.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          name: "My Villa",
        }),
      }),
    );
  });

  it("creates project without address", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.create.mockResolvedValue({
      id: "proj-2",
      name: "Test Project",
      address: null,
      createdAt: new Date(),
    });

    const result = await caller.room.createProject({ name: "Test Project" });

    expect(result.name).toBe("Test Project");
    expect(result.address).toBeNull();
  });

  it("rejects unauthenticated users", async () => {
    const db = createMockDb();
    const ctx = unauthCtx(db);
    const caller = createCaller(ctx);

    await expect(caller.room.createProject({ name: "Test" })).rejects.toThrow(
      TRPCError,
    );
  });
});

describe("room.listProjects", () => {
  it("returns user's projects paginated", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.findMany.mockResolvedValue([
      {
        id: "proj-1",
        name: "Villa 1",
        address: "Dubai",
        floorPlanThumbUrl: null,
        updatedAt: new Date(),
        _count: { rooms: 3 },
      },
    ]);

    const result = await caller.room.listProjects({ limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!._count.rooms).toBe(3);
    expect(result.nextCursor).toBeUndefined();
  });

  it("returns nextCursor when more pages exist", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    const projects = Array.from({ length: 3 }, (_, i) => ({
      id: `proj-${i}`,
      name: `Project ${i}`,
      address: null,
      floorPlanThumbUrl: null,
      updatedAt: new Date(),
      _count: { rooms: 0 },
    }));
    db.project.findMany.mockResolvedValue(projects);

    const result = await caller.room.listProjects({ limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("proj-2");
  });
});

describe("room.getProject", () => {
  it("returns project with rooms", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({
      id: "proj-1",
      name: "Villa",
      address: "Dubai Marina",
      floorPlanUrl: null,
      floorPlanThumbUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      rooms: [
        {
          id: "room-1",
          name: "Living Room",
          type: "LIVING_ROOM",
          widthCm: 500,
          lengthCm: 600,
          heightCm: 300,
          displayUnit: "METRIC",
          orderIndex: 0,
          _count: { photos: 2 },
        },
      ],
    });

    const result = await caller.room.getProject({ projectId: TEST_UUID });

    expect(result.id).toBe("proj-1");
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0]!.name).toBe("Living Room");
  });

  it("throws NOT_FOUND for non-existent project", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue(null);

    await expect(
      caller.room.getProject({ projectId: TEST_UUID }),
    ).rejects.toThrow("Project not found");
  });
});

describe("room.updateProject", () => {
  it("updates project fields", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    // verifyProjectOwnership
    db.project.findFirst.mockResolvedValue({ id: "proj-1" });
    db.project.update.mockResolvedValue({
      id: "proj-1",
      name: "Updated Name",
      address: "New Address",
      updatedAt: new Date(),
    });

    const result = await caller.room.updateProject({
      projectId: TEST_UUID,
      name: "Updated Name",
      address: "New Address",
    });

    expect(result.name).toBe("Updated Name");
  });

  it("rejects other user's project", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    // verifyProjectOwnership returns null (not owned by user)
    db.project.findFirst.mockResolvedValue(null);

    await expect(
      caller.room.updateProject({ projectId: TEST_UUID, name: "Hack" }),
    ).rejects.toThrow("Project not found");
  });
});

describe("room.deleteProject", () => {
  it("deletes project owned by user", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: "proj-1" });
    db.project.delete.mockResolvedValue({});

    const result = await caller.room.deleteProject({ projectId: TEST_UUID });

    expect(result.success).toBe(true);
    expect(db.project.delete).toHaveBeenCalledWith({
      where: { id: TEST_UUID },
    });
  });

  it("rejects other user's project", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue(null);

    await expect(
      caller.room.deleteProject({ projectId: TEST_UUID }),
    ).rejects.toThrow("Project not found");
  });
});

// ═══════════════════════════════════════════
// Room CRUD Tests
// ═══════════════════════════════════════════

describe("room.createRoom", () => {
  it("creates room with dimensions", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: "proj-1" });
    db.room.findFirst.mockResolvedValue({ orderIndex: 2 }); // last room
    db.room.create.mockResolvedValue({
      id: "room-1",
      name: "Living Room",
      type: "LIVING_ROOM",
      widthCm: 500,
      lengthCm: 600,
      heightCm: 300,
      displayUnit: "METRIC",
      orderIndex: 3,
    });

    const result = await caller.room.createRoom({
      projectId: TEST_UUID,
      name: "Living Room",
      type: "LIVING_ROOM",
      widthCm: 500,
      lengthCm: 600,
      heightCm: 300,
    });

    expect(result.id).toBe("room-1");
    expect(result.type).toBe("LIVING_ROOM");
    expect(result.widthCm).toBe(500);
    expect(result.orderIndex).toBe(3);
  });

  it("creates room as first room (orderIndex 0)", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: "proj-1" });
    db.room.findFirst.mockResolvedValue(null); // no existing rooms
    db.room.create.mockResolvedValue({
      id: "room-1",
      name: "Bedroom",
      type: "BEDROOM",
      widthCm: null,
      lengthCm: null,
      heightCm: null,
      displayUnit: "METRIC",
      orderIndex: 0,
    });

    const result = await caller.room.createRoom({
      projectId: TEST_UUID,
      name: "Bedroom",
      type: "BEDROOM",
    });

    expect(result.orderIndex).toBe(0);
  });

  it("rejects project not owned by user", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue(null);

    await expect(
      caller.room.createRoom({
        projectId: TEST_UUID,
        name: "Room",
      }),
    ).rejects.toThrow("Project not found");
  });
});

describe("room.getRoom", () => {
  it("returns room with photos", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst.mockResolvedValue({
      id: "room-1",
      projectId: "proj-1",
      name: "Living Room",
      type: "LIVING_ROOM",
      typeConfidence: 0.9,
      typeSource: "AI_SUGGESTED",
      widthCm: 500,
      lengthCm: 600,
      heightCm: 300,
      displayUnit: "METRIC",
      orderIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      photos: [
        {
          id: "photo-1",
          storageUrl: "https://storage.example.com/photo.jpg",
          thumbnailUrl: null,
          orderIndex: 0,
          uploadedAt: new Date(),
        },
      ],
    });

    const result = await caller.room.getRoom({ roomId: TEST_UUID });

    expect(result.id).toBe("room-1");
    expect(result.photos).toHaveLength(1);
    expect(result.typeConfidence).toBe(0.9);
  });

  it("throws NOT_FOUND for non-existent room", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst.mockResolvedValue(null);

    await expect(caller.room.getRoom({ roomId: TEST_UUID })).rejects.toThrow(
      "Room not found",
    );
  });
});

describe("room.updateRoom", () => {
  it("updates room fields", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    // verifyRoomOwnership
    db.room.findFirst.mockResolvedValue({ id: "room-1", projectId: "proj-1" });
    db.room.update.mockResolvedValue({
      id: "room-1",
      name: "Updated Room",
      type: "BEDROOM",
      widthCm: 400,
      lengthCm: 500,
      heightCm: 280,
      displayUnit: "IMPERIAL",
    });

    const result = await caller.room.updateRoom({
      roomId: TEST_UUID,
      name: "Updated Room",
      type: "BEDROOM",
      displayUnit: "IMPERIAL",
    });

    expect(result.name).toBe("Updated Room");
    expect(result.type).toBe("BEDROOM");
  });

  it("rejects room not owned by user", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst.mockResolvedValue(null);

    await expect(
      caller.room.updateRoom({ roomId: TEST_UUID, name: "Hack" }),
    ).rejects.toThrow("Room not found");
  });
});

describe("room.deleteRoom", () => {
  it("deletes room owned by user", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst.mockResolvedValue({ id: "room-1", projectId: "proj-1" });
    db.room.delete.mockResolvedValue({});

    const result = await caller.room.deleteRoom({ roomId: TEST_UUID });

    expect(result.success).toBe(true);
  });

  it("rejects room not owned by user", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst.mockResolvedValue(null);

    await expect(caller.room.deleteRoom({ roomId: TEST_UUID })).rejects.toThrow(
      "Room not found",
    );
  });
});

// ═══════════════════════════════════════════
// Room Type Tests
// ═══════════════════════════════════════════

describe("room.setRoomType", () => {
  it("sets room type manually", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst.mockResolvedValue({ id: "room-1", projectId: "proj-1" });
    db.room.update.mockResolvedValue({
      id: "room-1",
      type: "KITCHEN",
      typeSource: "MANUAL",
      typeConfidence: null,
    });

    const result = await caller.room.setRoomType({
      roomId: TEST_UUID,
      type: "KITCHEN",
    });

    expect(result.type).toBe("KITCHEN");
    expect(result.typeSource).toBe("MANUAL");
  });

  it("sets room type with AI confidence", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst.mockResolvedValue({ id: "room-1", projectId: "proj-1" });
    db.room.update.mockResolvedValue({
      id: "room-1",
      type: "BEDROOM",
      typeSource: "AI_CONFIRMED",
      typeConfidence: 0.95,
    });

    const result = await caller.room.setRoomType({
      roomId: TEST_UUID,
      type: "BEDROOM",
      source: "AI_CONFIRMED",
      confidence: 0.95,
    });

    expect(result.typeConfidence).toBe(0.95);
  });
});

describe("room.detectRoomType", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls AI client and updates room type", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    // verifyRoomOwnership
    db.room.findFirst
      .mockResolvedValueOnce({ id: "room-1", projectId: "proj-1" }) // ownership check
      .mockResolvedValueOnce({
        // room fetch with photos and name
        id: "room-1",
        name: "My Room",
        photos: [{ storageUrl: "https://storage.example.com/photo.jpg" }],
      });

    mockAiClient.classifyRoomType.mockResolvedValue({
      type: "LIVING_ROOM",
      confidence: 0.92,
      source: "ai",
    });

    db.room.update.mockResolvedValue({
      id: "room-1",
      type: "LIVING_ROOM",
      typeSource: "AI_SUGGESTED",
      typeConfidence: 0.92,
    });

    const result = await caller.room.detectRoomType({ roomId: TEST_UUID });

    expect(result.type).toBe("LIVING_ROOM");
    expect(result.typeConfidence).toBe(0.92);
    expect(mockAiClient.classifyRoomType).toHaveBeenCalledWith([
      "https://storage.example.com/photo.jpg",
    ]);
  });

  it("falls back to name-based detection when AI fails", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst
      .mockResolvedValueOnce({ id: "room-1", projectId: "proj-1" })
      .mockResolvedValueOnce({
        id: "room-1",
        name: "Master Bedroom",
        photos: [{ storageUrl: "https://storage.example.com/photo.jpg" }],
      });

    mockAiClient.classifyRoomType.mockRejectedValue(
      new Error("AI unavailable"),
    );

    mockClassifyRoomTypeByName.mockReturnValue({
      type: "BEDROOM",
      confidence: 0.85,
      source: "fallback",
    });

    db.room.update.mockResolvedValue({
      id: "room-1",
      type: "BEDROOM",
      typeSource: "AI_SUGGESTED",
      typeConfidence: 0.85,
    });

    const result = await caller.room.detectRoomType({ roomId: TEST_UUID });

    expect(result.type).toBe("BEDROOM");
    expect(result.typeConfidence).toBe(0.85);
    expect(mockClassifyRoomTypeByName).toHaveBeenCalledWith("Master Bedroom");
  });

  it("uses name-based fallback when AI returns low confidence OTHER", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst
      .mockResolvedValueOnce({ id: "room-1", projectId: "proj-1" })
      .mockResolvedValueOnce({
        id: "room-1",
        name: "Living Room Area",
        photos: [{ storageUrl: "https://storage.example.com/photo.jpg" }],
      });

    mockAiClient.classifyRoomType.mockResolvedValue({
      type: "OTHER",
      confidence: 0.2,
      source: "fallback",
    });

    mockClassifyRoomTypeByName.mockReturnValue({
      type: "LIVING_ROOM",
      confidence: 0.85,
      source: "fallback",
    });

    db.room.update.mockResolvedValue({
      id: "room-1",
      type: "LIVING_ROOM",
      typeSource: "AI_SUGGESTED",
      typeConfidence: 0.85,
    });

    const result = await caller.room.detectRoomType({ roomId: TEST_UUID });

    expect(result.type).toBe("LIVING_ROOM");
    expect(result.typeConfidence).toBe(0.85);
  });

  it("throws BAD_REQUEST when room has no photos", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst
      .mockResolvedValueOnce({ id: "room-1", projectId: "proj-1" })
      .mockResolvedValueOnce({
        id: "room-1",
        name: "Empty Room",
        photos: [],
      });

    await expect(
      caller.room.detectRoomType({ roomId: TEST_UUID }),
    ).rejects.toThrow("Upload room photos first");
  });

  it("throws NOT_FOUND when room does not exist", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst.mockResolvedValue(null);

    await expect(
      caller.room.detectRoomType({ roomId: TEST_UUID }),
    ).rejects.toThrow("Room not found");
  });
});

// ═══════════════════════════════════════════
// Photo Tests
// ═══════════════════════════════════════════

describe("room.addPhoto", () => {
  it("adds photo to room", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst.mockResolvedValue({ id: "room-1", projectId: "proj-1" });
    db.roomPhoto.create.mockResolvedValue({
      id: "photo-1",
      storageUrl: "https://storage.example.com/photo.jpg",
      thumbnailUrl: null,
      orderIndex: 0,
      uploadedAt: new Date(),
    });

    const result = await caller.room.addPhoto({
      roomId: TEST_UUID,
      storageUrl: "https://storage.example.com/photo.jpg",
      orderIndex: 0,
    });

    expect(result.id).toBe("photo-1");
    expect(result.storageUrl).toBe("https://storage.example.com/photo.jpg");
  });

  it("adds photo with thumbnail", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.room.findFirst.mockResolvedValue({ id: "room-1", projectId: "proj-1" });
    db.roomPhoto.create.mockResolvedValue({
      id: "photo-2",
      storageUrl: "https://storage.example.com/photo.jpg",
      thumbnailUrl: "https://storage.example.com/photo-thumb.jpg",
      orderIndex: 1,
      uploadedAt: new Date(),
    });

    const result = await caller.room.addPhoto({
      roomId: TEST_UUID,
      storageUrl: "https://storage.example.com/photo.jpg",
      thumbnailUrl: "https://storage.example.com/photo-thumb.jpg",
      orderIndex: 1,
    });

    expect(result.thumbnailUrl).toBe(
      "https://storage.example.com/photo-thumb.jpg",
    );
  });
});

describe("room.deletePhoto", () => {
  it("deletes photo owned by user", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.roomPhoto.findFirst.mockResolvedValue({ id: "photo-1" });
    db.roomPhoto.delete.mockResolvedValue({});

    const result = await caller.room.deletePhoto({ photoId: TEST_UUID });

    expect(result.success).toBe(true);
  });

  it("throws NOT_FOUND for photo not belonging to user", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.roomPhoto.findFirst.mockResolvedValue(null);

    await expect(
      caller.room.deletePhoto({ photoId: TEST_UUID }),
    ).rejects.toThrow("Photo not found");
  });
});

// ═══════════════════════════════════════════
// Floor Plan Tests
// ═══════════════════════════════════════════

describe("room.uploadFloorPlan", () => {
  it("updates project floor plan", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: "proj-1" });
    db.project.update.mockResolvedValue({
      id: "proj-1",
      floorPlanUrl: "https://storage.example.com/plan.pdf",
      floorPlanThumbUrl: "https://storage.example.com/plan-thumb.jpg",
    });

    const result = await caller.room.uploadFloorPlan({
      projectId: TEST_UUID,
      storageUrl: "https://storage.example.com/plan.pdf",
      thumbnailUrl: "https://storage.example.com/plan-thumb.jpg",
    });

    expect(result.floorPlanUrl).toBe("https://storage.example.com/plan.pdf");
    expect(result.floorPlanThumbUrl).toBe(
      "https://storage.example.com/plan-thumb.jpg",
    );
  });

  it("rejects floor plan for project not owned by user", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue(null);

    await expect(
      caller.room.uploadFloorPlan({
        projectId: TEST_UUID,
        storageUrl: "https://storage.example.com/plan.pdf",
      }),
    ).rejects.toThrow("Project not found");
  });

  it("uploads floor plan without thumbnail", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: "proj-1" });
    db.project.update.mockResolvedValue({
      id: "proj-1",
      floorPlanUrl: "https://storage.example.com/plan.pdf",
      floorPlanThumbUrl: null,
    });

    const result = await caller.room.uploadFloorPlan({
      projectId: TEST_UUID,
      storageUrl: "https://storage.example.com/plan.pdf",
    });

    expect(result.floorPlanUrl).toBe("https://storage.example.com/plan.pdf");
    expect(result.floorPlanThumbUrl).toBeNull();
  });
});
