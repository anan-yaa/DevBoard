import { RoomStore, RoomComment } from '../utils/roomStore';

export class CommentController {
  constructor(private roomStore: RoomStore) {}

  addComment(socket: any, io: any, payload: any): void {
    console.log('🔥 addComment called with payload:', payload);
    console.log('🔥 socket.id:', socket.id);
    console.log('🔥 io instance exists:', !!io);
    
    if (!payload || typeof payload !== 'object') {
      console.log('❌ Invalid payload');
      return;
    }
    
    const { roomId, lineNumber, text, userId, username } = payload as Record<string, unknown>;
    if (
      typeof roomId !== 'string' ||
      !roomId ||
      typeof lineNumber !== 'number' ||
      !Number.isFinite(lineNumber) ||
      typeof text !== 'string' ||
      !text.trim() ||
      typeof userId !== 'string' ||
      userId !== socket.id ||
      typeof username !== 'string'
    ) {
      console.log('❌ Payload validation failed');
      return;
    }

    const comment: RoomComment = {
      id: `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${Math.random().toString(36).slice(2, 6)}`,
      lineNumber: Math.max(1, Math.floor(lineNumber)),
      text: text.trim(),
      userId: socket.id,
      username: username.trim(),
    };

    this.roomStore.addComment(roomId, comment);
    console.log('💾 Comment added to room store');

    console.log('Comment added with ID:', comment.id, 'Username:', comment.username);
    console.log('Total comments in room', roomId, ':', this.roomStore.getRoomComments(roomId).length);
    console.log('Broadcasting comment to room', roomId, 'with', this.roomStore.getRoomSocketIds(roomId).size, 'users');
    
    // CRITICAL FIX: Ensure we're using io.to() for room broadcast
    console.log('📡 Broadcasting to room:', roomId);
    io.to(roomId).emit('new-comment', comment);
    console.log('✅ Comment broadcast sent:', comment.id);
  }

  getRoomComments(roomId: string): RoomComment[] {
    return this.roomStore.getRoomComments(roomId);
  }
}
