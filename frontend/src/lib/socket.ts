import { io, type Socket } from 'socket.io-client';

type SocketOptions = {
  url: string;
  roomId?: string;
  username?: string;
};

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(options: SocketOptions): Promise<Socket> {
    return new Promise((resolve, reject) => {
      // Close existing connection
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      // Production-safe socket configuration
      const socketOptions = {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: this.maxReconnectAttempts,
        autoConnect: true,
        // CORS credentials for production
        withCredentials: true,
        // Handle SSL certificate issues in development
        secure: process.env.NODE_ENV === 'production',
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      };

      this.socket = io(options.url, socketOptions);

      // Connection event handlers
      this.socket.on('connect', () => {
        console.log('🔌 Socket connected:', this.socket?.id);
        this.reconnectAttempts = 0;
        
        // Auto-join room if provided
        if (options.roomId && options.username) {
          this.socket?.emit('join-room', {
            roomId: options.roomId,
            username: options.username
          });
        }
        
        resolve(this.socket!);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('👋 Socket disconnected:', reason);
        
        if (reason === 'io server disconnect') {
          // Server disconnected, reconnect manually
          this.socket?.connect();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('🚫 Max reconnection attempts reached');
          reject(new Error('Failed to connect after maximum attempts'));
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
        
        // Re-join room after reconnection
        if (options.roomId && options.username) {
          this.socket?.emit('join-room', {
            roomId: options.roomId,
            username: options.username
          });
        }
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('❌ Socket reconnection error:', error);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Emit events with error handling
  emit(event: string, data: any): boolean {
    if (!this.socket?.connected) {
      console.warn('⚠️ Socket not connected, cannot emit event:', event);
      return false;
    }

    this.socket.emit(event, data);
    return true;
  }

  // Listen to events with automatic cleanup
  on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback);
  }

  // Remove event listeners
  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }
}

// Singleton instance
export const socketService = new SocketService();

// Export types
export type { Socket };
