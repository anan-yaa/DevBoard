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

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-room", async (roomId: unknown) => {
    if (typeof roomId !== "string" || !roomId) {
      return;
    }
    await socket.join(roomId);
    console.log(`User ${socket.id} joined room "${roomId}"`);
  });

  socket.on("send-message", (payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const { roomId, message } = payload as Record<string, unknown>;
    if (typeof roomId !== "string" || !roomId || typeof message !== "string") {
      return;
    }
    socket.to(roomId).emit("receive-message", { message });
  });
});

const PORT = 5000;
httpServer.listen(PORT, () => {
  console.log("Server running on port 5000");
});
