import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();

// Allow browsers on other origins to call this API and open Socket.IO connections.
app.use(cors());

// Raw HTTP server: Express handles ordinary HTTP; Socket.IO attaches to the same server.
const httpServer = createServer(app);

// Socket.IO shares the HTTP server and handles WebSocket (and fallback) transport.
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

/** In-memory: each roomId -> socket ids currently joined (mirrors join-room / disconnect). */
const roomSocketIds = new Map<string, Set<string>>();
/** In-memory: latest code snapshot per room (lost on server restart). */
const roomLatestCode = new Map<string, string>();

function addSocketToRoom(roomId: string, socketId: string) {
  let set = roomSocketIds.get(roomId);
  if (!set) {
    set = new Set();
    roomSocketIds.set(roomId, set);
  }
  set.add(socketId);
}

function removeSocketFromRoom(roomId: string, socketId: string) {
  const set = roomSocketIds.get(roomId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) roomSocketIds.delete(roomId);
}

function emitRoomUsers(roomId: string) {
  const socketIds = [...(roomSocketIds.get(roomId) ?? [])];
  io.to(roomId).emit("room-users", { socketIds });
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      removeSocketFromRoom(roomId, socket.id);
      emitRoomUsers(roomId);
    }
  });

  socket.on("join-room", async (roomId: unknown) => {
    if (typeof roomId !== "string" || !roomId) {
      return;
    }
    await socket.join(roomId);
    addSocketToRoom(roomId, socket.id);
    console.log(`User ${socket.id} joined room "${roomId}"`);
    emitRoomUsers(roomId);
    socket.emit("load-code", roomLatestCode.get(roomId) ?? "");
  });

  socket.on("code-change", (payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const { roomId, code } = payload as Record<string, unknown>;
    if (typeof roomId !== "string" || !roomId || typeof code !== "string") {
      return;
    }
    roomLatestCode.set(roomId, code);
    socket.to(roomId).emit("code-change", { code });
  });

  socket.on("cursor-move", (payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const { roomId, position } = payload as Record<string, unknown>;
    if (typeof roomId !== "string" || !roomId) {
      return;
    }
    if (!position || typeof position !== "object") {
      return;
    }
    const { lineNumber, column } = position as Record<string, unknown>;
    if (typeof lineNumber !== "number" || typeof column !== "number") {
      return;
    }
    if (!Number.isFinite(lineNumber) || !Number.isFinite(column)) {
      return;
    }
    socket.to(roomId).emit("cursor-update", {
      userId: socket.id,
      position: { lineNumber, column },
    });
  });
});

const PORT = 5000;
httpServer.listen(PORT, () => {
  console.log("Server running on port 5000");
});
