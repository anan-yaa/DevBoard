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
/** In-memory: each roomId -> user objects with id and username. */
const roomUsers = new Map<string, {id: string, username: string}[]>();
/** In-memory: latest code snapshot per room (lost on server restart). */
const roomLatestCode = new Map<string, string>();
type RoomComment = {
  id: string;
  lineNumber: number;
  text: string;
  userId: string;
  username: string;
};
/** In-memory: roomId -> inline comments for that room. */
const roomComments = new Map<string, RoomComment[]>();

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

// CHALLENGE 10: User list broadcasting was sending socket IDs instead of user objects
// SOLUTION: Updated to send user objects with both ID and username for frontend display
function emitRoomUsers(roomId: string) {
  const users = roomUsers.get(roomId) ?? [];
  io.to(roomId).emit("room-users", { users });
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      removeSocketFromRoom(roomId, socket.id);
      
      // Remove user from room users
      const users = roomUsers.get(roomId) ?? [];
      const filteredUsers = users.filter(u => u.id !== socket.id);
      roomUsers.set(roomId, filteredUsers);
      
      emitRoomUsers(roomId);
    }
  });

  // CHALLENGE 7: User identity was inconsistent across the app
  // SOLUTION: Changed join-room to accept username payload instead of just roomId
  socket.on("join-room", async (payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return;
    }
    // CHALLENGE 8: Backend needed to handle new payload structure with username
    // SOLUTION: Added username extraction and validation
    const { roomId, username } = payload as Record<string, unknown>;
    if (typeof roomId !== "string" || !roomId || typeof username !== "string") {
      return;
    }
    
    await socket.join(roomId);
    addSocketToRoom(roomId, socket.id);
    
    // CHALLENGE 9: User management was using only socket IDs, not usernames
    // SOLUTION: Store user objects with both ID and username for unified identity
    const users = roomUsers.get(roomId) ?? [];
    const existingUserIndex = users.findIndex(u => u.id === socket.id);
    if (existingUserIndex >= 0) {
      // Update existing user's username in case they rejoin with different one
      users[existingUserIndex] = { id: socket.id, username };
    } else {
      users.push({ id: socket.id, username });
    }
    roomUsers.set(roomId, users);
    
    console.log(`User ${socket.id} (${username}) joined room "${roomId}"`);
    emitRoomUsers(roomId);
    socket.emit("load-code", roomLatestCode.get(roomId) ?? "");
    socket.emit("load-comments", roomComments.get(roomId) ?? []);
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

  // CHALLENGE 1: Initial comment system had no hover text display
// SOLUTION: Added hoverMessage to Monaco decorations with comment text and username
socket.on("add-comment", (payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return;
    }
    // CHALLENGE 2: Comments were missing username field
    // SOLUTION: Added username to payload validation and comment creation
    const { roomId, lineNumber, text, userId, username } = payload as Record<
      string,
      unknown
    >;
    // CHALLENGE 3: Backend needed to validate new username field
    // SOLUTION: Added username type checking to prevent invalid data
    if (
      typeof roomId !== "string" ||
      !roomId ||
      typeof lineNumber !== "number" ||
      !Number.isFinite(lineNumber) ||
      typeof text !== "string" ||
      !text.trim() ||
      typeof userId !== "string" ||
      userId !== socket.id ||
      typeof username !== "string"
    ) {
      return;
    }

    // CHALLENGE 4: Comment IDs were not unique enough, causing potential duplicates
    // SOLUTION: Enhanced ID generation with multiple random components
    const comment: RoomComment = {
      id: `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${Math.random().toString(36).slice(2, 6)}`,
      lineNumber: Math.max(1, Math.floor(lineNumber)),
      text: text.trim(),
      userId: socket.id,
      username: username.trim(),
    };

    const existing = roomComments.get(roomId) ?? [];
    existing.push(comment);
    roomComments.set(roomId, existing);

    // CHALLENGE 5: Debug visibility was poor, making troubleshooting difficult
    // SOLUTION: Added detailed logging for comment ID, username, and counts
    console.log("Comment added with ID:", comment.id, "Username:", comment.username);
    console.log("Total comments in room", roomId, ":", roomComments.get(roomId)?.length);
    // CHALLENGE 6: Comments weren't broadcasting to all users properly
    // SOLUTION: Used io.to(roomId).emit() to ensure all users receive comments
    console.log("Broadcasting comment to room", roomId, "with", roomSocketIds.get(roomId)?.size, "users");
    io.to(roomId).emit("new-comment", comment);
    console.log("Comment broadcast sent:", comment.id);
  });
});

const PORT = 5000;
httpServer.listen(PORT, () => {
  console.log("Server running on port 5000");
});
