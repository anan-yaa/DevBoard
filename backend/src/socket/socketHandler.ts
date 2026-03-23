import { Server } from 'socket.io';
import { RoomController } from '../controllers/roomController';
import { CommentController } from '../controllers/commentController';

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
      await roomController.joinRoom(socket, io, payload);
    });

    socket.on('code-change', (payload: unknown) => {
      console.log('📝 Received code-change event');
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
