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
import config from './config/env';
import { 
  securityHeaders, 
  rateLimiter, 
  compressionMiddleware, 
  corsOptions as corsConfig, 
  apiSecurity, 
  requestLogger 
} from './middleware/security';

const app = express();

// Apply security middleware in production
if (config.isProduction) {
  app.use(securityHeaders);
}

// Apply compression, rate limiting, and CORS
app.use(compressionMiddleware);
app.use(rateLimiter);
app.use(cors(corsConfig));
app.use(apiSecurity);
app.use(requestLogger);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint for load balancers
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    const { prisma } = await import('./utils/db');
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      environment: config.NODE_ENV
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      uptime: process.uptime()
    });
  }
});

// Raw HTTP server: Express handles ordinary HTTP; Socket.IO attaches to the same server.
const httpServer = createServer(app);

// Socket.IO shares the HTTP server and handles WebSocket (and fallback) transport.
const io = new Server(httpServer, {
  cors: corsConfig,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8, // 100 MB
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

const PORT = config.PORT;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${config.NODE_ENV}`);
  console.log(`🔗 CORS Origins: ${config.CORS_ORIGIN.join(', ')}`);
});
