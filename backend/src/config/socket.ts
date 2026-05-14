import config from './env';

export const socketConfig = {
  // CORS configuration
  cors: {
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },
  
  // Transport configuration
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  
  // Connection settings
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  maxHttpBufferSize: 1e8, // 100 MB
  
  // Production-specific settings
  ...(config.isProduction && {
    // Enable compression for WebSocket frames
    perMessageDeflate: {
      threshold: 1024,
      level: 3,
    },
    
    // Connection limits for scalability
    maxHttpBufferSize: 1e7, // 10 MB per message in production
    
    // Disable upgrade for better stability behind proxies
    upgrade: false,
  }),
  
  // Development-specific settings
  ...(config.isDevelopment && {
    // More verbose logging in development
    connectTimeout: 10000,
    
    // Allow more connections in development
    maxHttpBufferSize: 1e8, // 100 MB
  }),
};

export const socketEvents = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  DISCONNECTING: 'disconnecting',
  
  // Room events
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  
  // Collaboration events
  CODE_CHANGE: 'code-change',
  CURSOR_MOVE: 'cursor-move',
  
  // Comment events
  ADD_COMMENT: 'add-comment',
  RECEIVE_COMMENT: 'receive-comment',
  LOAD_COMMENTS: 'load-comments',
  
  // Sync events
  LOAD_CODE: 'load-code',
  ROOM_USERS: 'room-users',
  
  // Error events
  ERROR: 'error',
} as const;

export type SocketEvent = typeof socketEvents[keyof typeof socketEvents];
