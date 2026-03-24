import { Server } from 'socket.io';
import { RoomController } from '../controllers/roomController';
import { CommentController } from '../controllers/commentController';
import { prisma } from '../utils/db';

export function setupSocketHandlers(io: Server, roomController: RoomController, commentController: CommentController): void {
  console.log('🚀 Setting up socket handlers...');
  
  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);
    console.log('🔌 Total connected sockets:', io.sockets.sockets.size);

    socket.on('disconnecting', () => {
      console.log('👋 User disconnecting:', socket.id);
      roomController.handleDisconnect(socket, io);
    });

    socket.on('join-room', async (payload: unknown) => {
      console.log('📡 Received join-room event:', payload);
      
      if (!payload || typeof payload !== 'object') {
        console.log('❌ Invalid payload for join-room');
        return;
      }
      
      const { roomId, username } = payload as Record<string, unknown>;
      if (typeof roomId !== 'string' || !roomId || typeof username !== 'string') {
        console.log('❌ Invalid payload structure for join-room');
        return;
      }
      
      try {
        // Join socket room first
        await socket.join(roomId);
        console.log('🔗 Socket joined room:', roomId);
        
        // Load saved code from PostgreSQL
        const room = await prisma.room.findUnique({
          where: { id: roomId },
        });
        
        // Send saved code to user if it exists
        if (room?.code) {
          socket.emit('load-code', room.code);
          console.log('� Loaded saved code from database for room:', roomId);
        } else {
          // Send empty code if no saved code exists
          socket.emit('load-code', '');
          console.log('📄 No saved code found, sending empty editor for room:', roomId);
        }
        
        // Call existing business logic (preserves all existing functionality)
        await roomController.joinRoom(socket, io, payload);
        
        // Load comments from controller (using existing in-memory store for now)
        const comments = commentController.getRoomComments(roomId);
        socket.emit('load-comments', comments);
        
        console.log('✅ Room join completed for:', socket.id);
      } catch (error) {
        console.log('❌ Error joining room:', error);
      }
    });

    socket.on('code-change', async (payload: unknown) => {
      console.log('📝 Received code-change event');
      
      if (!payload || typeof payload !== 'object') {
        console.log('❌ Invalid payload for code-change');
        return;
      }
      
      const { roomId, code } = payload as Record<string, unknown>;
      if (typeof roomId !== 'string' || !roomId || typeof code !== 'string') {
        console.log('❌ Invalid payload structure for code-change');
        return;
      }
      
      try {
        // Save to DB (upsert)
        await prisma.room.upsert({
          where: { id: roomId },
          update: { code },
          create: {
            id: roomId,
            code,
          },
        });
        console.log('💾 Code saved to database for room:', roomId);
      } catch (error) {
        console.log('❌ Error saving code to database:', error);
      }
      
      // Keep existing real-time sync logic
      roomController.handleCodeChange(socket, io, payload);
    });

    socket.on('cursor-move', (payload: unknown) => {
      console.log('👆 Received cursor-move event');
      roomController.handleCursorMove(socket, payload);
    });

    socket.on('add-comment', (payload: unknown) => {
      console.log('💬 Received add-comment event:', payload);
      commentController.addComment(socket, io, payload);
    });
    
    console.log('✅ Socket handlers set up for:', socket.id);
  });
  
  console.log('🎯 Socket handlers ready');
}
