import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomStore } from './utils/roomStore';
import { RoomController } from './controllers/roomController';
import { CommentController } from './controllers/commentController';
import { setupSocketHandlers } from './socket/socketHandler';
import { createRoomRoutes } from './routes/roomRoutes';
import { createCommentRoutes } from './routes/commentRoutes';

const app = express();

// Allow browsers on other origins to call this API and open Socket.IO connections.
app.use(cors());
app.use(express.json());

// Raw HTTP server: Express handles ordinary HTTP; Socket.IO attaches to the same server.
const httpServer = createServer(app);

// Socket.IO shares the HTTP server and handles WebSocket (and fallback) transport.
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

// Initialize shared room store
const roomStore = new RoomStore();
console.log('🏪 RoomStore initialized');

// Initialize controllers
const roomController = new RoomController(roomStore);
const commentController = new CommentController(roomStore);
console.log('🎮 Controllers initialized with shared RoomStore');

// Setup routes
app.use('/api/rooms', createRoomRoutes(roomController));
app.use('/api/comments', createCommentRoutes(commentController));

// Setup socket handlers
console.log('🔧 Setting up socket handlers...');
setupSocketHandlers(io, roomController, commentController);
console.log('✅ Socket handlers configured');

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
