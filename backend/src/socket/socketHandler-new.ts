import { Server, Socket } from 'socket.io';
import { RoomController } from '../controllers/roomController';
import { CommentController } from '../controllers/commentController';
import { socketEvents, type SocketEvent } from '../config/socket';
import { prisma } from '../utils/db';
import config from '../config/env';

export function setupSocketHandlers(
  io: Server,
  roomController: RoomController,
  commentController: CommentController
): void {
  console.log('🔧 Setting up Socket.IO handlers...');

  io.on(socketEvents.CONNECTION, (socket: Socket) => {
    console.log(`👋 User connected: ${socket.id}`);
    
    // Connection logging
    if (config.isProduction) {
      console.log('📊 Connection stats:', {
        socketId: socket.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        timestamp: new Date().toISOString()
      });
    }

    // Join room handler
    socket.on(socketEvents.JOIN_ROOM, async (payload: unknown) => {
      try {
        if (!payload || typeof payload !== 'object') {
          socket.emit(socketEvents.ERROR, { 
            code: 'INVALID_PAYLOAD',
            message: 'Invalid payload format' 
          });
          return;
        }

        const { roomId, username } = payload as Record<string, unknown>;
        
        if (!roomId || typeof roomId !== 'string' || !username || typeof username !== 'string') {
          socket.emit(socketEvents.ERROR, { 
            code: 'MISSING_FIELDS',
            message: 'roomId and username are required' 
          });
          return;
        }

        // Validate room exists
        const room = await prisma.room.findUnique({
          where: { id: roomId }
        });

        if (!room) {
          socket.emit(socketEvents.ERROR, { 
            code: 'ROOM_NOT_FOUND',
            message: 'Room does not exist' 
          });
          return;
        }

        // Join socket room
        await socket.join(roomId);
        
        // Update room state
        roomController.joinRoom(socket, io, { roomId, username });
        
        // Load room data
        if (room.code) {
          socket.emit(socketEvents.LOAD_CODE, room.code);
        }

        // Load comments
        const comments = await prisma.comment.findMany({
          where: { roomId },
          orderBy: { createdAt: 'asc' }
        });
        socket.emit(socketEvents.LOAD_COMMENTS, comments);

        console.log(`🏠 User ${username} joined room ${roomId}`);

      } catch (error) {
        console.error('❌ Error in join-room handler:', error);
        socket.emit(socketEvents.ERROR, { 
          code: 'JOIN_ROOM_ERROR',
          message: 'Failed to join room' 
        });
      }
    });

    // Code change handler
    socket.on(socketEvents.CODE_CHANGE, async (payload: unknown) => {
      try {
        if (!payload || typeof payload !== 'object') {
          socket.emit(socketEvents.ERROR, { 
            code: 'INVALID_PAYLOAD',
            message: 'Invalid payload format' 
          });
          return;
        }

        const { roomId, code } = payload as Record<string, unknown>;
        
        if (!roomId || typeof roomId !== 'string' || !code || typeof code !== 'string') {
          socket.emit(socketEvents.ERROR, { 
            code: 'MISSING_FIELDS',
            message: 'roomId and code are required' 
          });
          return;
        }

        // Validate code length (prevent DoS)
        if (code.length > 1000000) { // 1MB limit
          socket.emit(socketEvents.ERROR, { 
            code: 'CODE_TOO_LARGE',
            message: 'Code exceeds maximum length' 
          });
          return;
        }

        // Save to database
        await prisma.room.upsert({
          where: { id: roomId },
          update: { code },
          create: { id: roomId, code }
        });

        // Broadcast to room
        socket.to(roomId).emit(socketEvents.CODE_CHANGE, { code });

        if (config.isDevelopment) {
          console.log(`📝 Code updated in room ${roomId}`);
        }

      } catch (error) {
        console.error('❌ Error in code-change handler:', error);
        socket.emit(socketEvents.ERROR, { 
          code: 'CODE_CHANGE_ERROR',
          message: 'Failed to update code' 
        });
      }
    });

    // Cursor move handler
    socket.on(socketEvents.CURSOR_MOVE, (payload: unknown) => {
      try {
        if (!payload || typeof payload !== 'object') {
          return; // Silently fail for cursor updates
        }

        const { roomId, position } = payload as Record<string, unknown>;
        
        if (!roomId || typeof roomId !== 'string' || !position || typeof position !== 'object') {
          return;
        }

        const { lineNumber, column } = position as Record<string, unknown>;
        
        if (typeof lineNumber !== 'number' || typeof column !== 'number') {
          return;
        }

        // Broadcast cursor position
        socket.to(roomId).emit(socketEvents.CURSOR_MOVE, {
          userId: socket.id,
          position: { lineNumber, column }
        });

      } catch (error) {
        console.error('❌ Error in cursor-move handler:', error);
      }
    });

    // Add comment handler
    socket.on(socketEvents.ADD_COMMENT, async (payload: unknown) => {
      try {
        if (!payload || typeof payload !== 'object') {
          socket.emit(socketEvents.ERROR, { 
            code: 'INVALID_PAYLOAD',
            message: 'Invalid payload format' 
          });
          return;
        }

        const { roomId, lineNumber, text, username } = payload as Record<string, unknown>;
        
        if (!roomId || typeof roomId !== 'string' || 
            !lineNumber || typeof lineNumber !== 'number' || 
            !text || typeof text !== 'string' || 
            !username || typeof username !== 'string') {
          socket.emit(socketEvents.ERROR, { 
            code: 'MISSING_FIELDS',
            message: 'roomId, lineNumber, text, and username are required' 
          });
          return;
        }

        // Validate comment length
        if (text.length > 1000) {
          socket.emit(socketEvents.ERROR, { 
            code: 'COMMENT_TOO_LONG',
            message: 'Comment exceeds maximum length' 
          });
          return;
        }

        // Validate line number
        if (lineNumber < 1 || lineNumber > 10000) {
          socket.emit(socketEvents.ERROR, { 
            code: 'INVALID_LINE_NUMBER',
            message: 'Line number out of range' 
          });
          return;
        }

        // Save comment to database
        const comment = await prisma.comment.create({
          data: {
            roomId,
            userId: socket.id,
            lineNumber,
            text,
            username
          }
        });

        // Broadcast to room
        io.to(roomId).emit(socketEvents.RECEIVE_COMMENT, comment);

        console.log(`💬 Comment added to room ${roomId} at line ${lineNumber}`);

      } catch (error) {
        console.error('❌ Error in add-comment handler:', error);
        socket.emit(socketEvents.ERROR, { 
          code: 'ADD_COMMENT_ERROR',
          message: 'Failed to add comment' 
        });
      }
    });

    // Disconnection handler
    socket.on(socketEvents.DISCONNECTING, () => {
      console.log(`👋 User disconnecting: ${socket.id}`);
      roomController.handleDisconnect(socket, io);
    });

    socket.on(socketEvents.DISCONNECT, (reason) => {
      console.log(`👋 User disconnected: ${socket.id}, reason: ${reason}`);
      
      if (config.isProduction) {
        console.log('📊 Disconnection stats:', {
          socketId: socket.id,
          reason,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Error handler
    socket.on(socketEvents.ERROR, (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  // Server-level error handling
  io.on('error', (error) => {
    console.error('❌ Socket.IO server error:', error);
  });

  console.log('✅ Socket.IO handlers configured');
}

export default setupSocketHandlers;
