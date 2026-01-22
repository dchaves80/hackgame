import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private currentComputerId: string | null = null;

  /**
   * Connect to Socket.io server with JWT token
   */
  connect(token: string) {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      // Rejoin computer room if we had one
      if (this.currentComputerId) {
        this.joinComputer(this.currentComputerId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    // Re-bind existing listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(cb => {
        this.socket?.on(event, cb);
      });
    });
  }

  /**
   * Disconnect from Socket.io server
   */
  disconnect() {
    if (this.currentComputerId) {
      this.socket?.emit('leave-computer', this.currentComputerId);
    }
    this.socket?.disconnect();
    this.socket = null;
    this.currentComputerId = null;
  }

  /**
   * Join a computer's room to receive events
   */
  joinComputer(computerId: string) {
    this.currentComputerId = computerId;
    this.socket?.emit('join-computer', computerId);
  }

  /**
   * Leave current computer's room
   */
  leaveComputer() {
    if (this.currentComputerId) {
      this.socket?.emit('leave-computer', this.currentComputerId);
      this.currentComputerId = null;
    }
  }

  /**
   * Subscribe to an event
   * @returns Unsubscribe function
   */
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    this.socket?.on(event, callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
      this.socket?.off(event, callback);
    };
  }

  /**
   * Emit an event to server
   */
  emit(event: string, data: any) {
    this.socket?.emit(event, data);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

const socketService = new SocketService();
export default socketService;
