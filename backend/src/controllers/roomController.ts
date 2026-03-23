import { RoomStore, User } from '../utils/roomStore';

export class RoomController {
  constructor(private roomStore: RoomStore) {}

  async joinRoom(socket: any, io: any, payload: any): Promise<void> {
    console.log('🏠 joinRoom called with payload:', payload);
    console.log('🏠 socket.id:', socket.id);
    
    if (!payload || typeof payload !== 'object') {
      console.log('❌ Invalid payload for joinRoom');
      return;
    }
    
    const { roomId, username } = payload as Record<string, unknown>;
    if (typeof roomId !== 'string' || !roomId || typeof username !== 'string') {
      console.log('❌ Payload validation failed for joinRoom');
      return;
    }
    
    console.log('🔗 Socket joining room:', roomId);
    await socket.join(roomId);
    console.log('✅ Socket joined room successfully');
    
    this.roomStore.addSocketToRoom(roomId, socket.id);
    console.log('📝 Socket added to room store');
    
    // Add user to room users
    this.roomStore.addUserToRoom(roomId, { id: socket.id, username });
    
    console.log(`User ${socket.id} (${username}) joined room "${roomId}"`);
    console.log('👥 Room users after join:', this.roomStore.getRoomUsers(roomId).length);
    console.log('🔌 Room sockets after join:', this.roomStore.getRoomSocketIds(roomId).size);
    
    this.emitRoomUsers(io, roomId);
    socket.emit('load-code', this.roomStore.getRoomCode(roomId));
    socket.emit('load-comments', this.roomStore.getRoomComments(roomId));
  }

  handleCodeChange(socket: any, io: any, payload: any): void {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    
    const { roomId, code } = payload as Record<string, unknown>;
    if (typeof roomId !== 'string' || !roomId || typeof code !== 'string') {
      return;
    }
    
    this.roomStore.setRoomCode(roomId, code);
    socket.to(roomId).emit('code-change', { roomId, code });
  }

  handleCursorMove(socket: any, payload: any): void {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    
    const { roomId, position } = payload as Record<string, unknown>;
    if (typeof roomId !== 'string' || !roomId) {
      return;
    }
    if (!position || typeof position !== 'object') {
      return;
    }
    
    const { lineNumber, column } = position as Record<string, unknown>;
    if (typeof lineNumber !== 'number' || typeof column !== 'number') {
      return;
    }
    if (!Number.isFinite(lineNumber) || !Number.isFinite(column)) {
      return;
    }
    
    socket.to(roomId).emit('cursor-update', {
      userId: socket.id,
      position: { lineNumber, column },
    });
  }

  handleDisconnect(socket: any, io: any): void {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      this.roomStore.removeSocketFromRoom(roomId, socket.id);
      this.roomStore.removeUserFromRoom(roomId, socket.id);
      this.emitRoomUsers(io, roomId);
    }
  }

  emitRoomUsers(io: any, roomId: string): void {
    const users = this.roomStore.getRoomUsers(roomId);
    io.to(roomId).emit('room-users', { users });
  }

  getRoomUsers(roomId: string): User[] {
    return this.roomStore.getRoomUsers(roomId);
  }
}
