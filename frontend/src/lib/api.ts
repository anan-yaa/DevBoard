// API utility functions for Vercel deployment

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  }

  // Generic fetch wrapper with error handling
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Room management
  async getRoom(roomId: string) {
    return this.request<any>(`/api/rooms/${roomId}`);
  }

  async createRoom(roomId: string) {
    return this.request<any>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ id: roomId }),
    });
  }

  // Comments management
  async getComments(roomId: string) {
    return this.request<any[]>(`/api/comments?roomId=${roomId}`);
  }

  async createComment(roomId: string, comment: {
    lineNumber: number;
    text: string;
    username: string;
  }) {
    return this.request<any>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ roomId, ...comment }),
    });
  }

  // Health check
  async healthCheck() {
    return this.request<{ status: string }>('/health');
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// Export for convenience
export const API_URL = API_BASE_URL;
