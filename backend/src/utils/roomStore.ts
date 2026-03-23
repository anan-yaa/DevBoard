export type RoomComment = {
  id: string;
  lineNumber: number;
  text: string;
  userId: string;
  username: string;
};

export type User = {
  id: string;
  username: string;
};

export class RoomStore {
  private roomSocketIds = new Map<string, Set<string>>();
  private roomUsers = new Map<string, User[]>();
  private roomLatestCode = new Map<string, string>();
  private roomComments = new Map<string, RoomComment[]>();

  // Socket management
  addSocketToRoom(roomId: string, socketId: string): void {
    let set = this.roomSocketIds.get(roomId);
    if (!set) {
      set = new Set();
      this.roomSocketIds.set(roomId, set);
    }
    set.add(socketId);
  }

  removeSocketFromRoom(roomId: string, socketId: string): void {
    const set = this.roomSocketIds.get(roomId);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) this.roomSocketIds.delete(roomId);
  }

  getRoomSocketIds(roomId: string): Set<string> {
    return this.roomSocketIds.get(roomId) || new Set();
  }

  // User management
  addUserToRoom(roomId: string, user: User): void {
    const users = this.roomUsers.get(roomId) ?? [];
    const existingUserIndex = users.findIndex(u => u.id === user.id);
    if (existingUserIndex >= 0) {
      users[existingUserIndex] = user;
    } else {
      users.push(user);
    }
    this.roomUsers.set(roomId, users);
  }

  removeUserFromRoom(roomId: string, userId: string): void {
    const users = this.roomUsers.get(roomId) ?? [];
    const filteredUsers = users.filter(u => u.id !== userId);
    this.roomUsers.set(roomId, filteredUsers);
  }

  getRoomUsers(roomId: string): User[] {
    return this.roomUsers.get(roomId) ?? [];
  }

  // Code management
  setRoomCode(roomId: string, code: string): void {
    this.roomLatestCode.set(roomId, code);
  }

  getRoomCode(roomId: string): string {
    return this.roomLatestCode.get(roomId) ?? "";
  }

  // Comment management
  addComment(roomId: string, comment: RoomComment): void {
    const existing = this.roomComments.get(roomId) ?? [];
    existing.push(comment);
    this.roomComments.set(roomId, existing);
  }

  getRoomComments(roomId: string): RoomComment[] {
    return this.roomComments.get(roomId) ?? [];
  }
}
