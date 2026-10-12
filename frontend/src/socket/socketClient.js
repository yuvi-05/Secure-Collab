import { io } from 'socket.io-client';

class SocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.joinedRooms = new Set();
  }

  connect(userId) {
    if (this.socket && this.socket.connected) {
      if (userId) {
        this.socket.emit('authenticate_socket', { user_id: userId });
      }
      return this.socket;
    }

    // Connect using relative path (proxied by Vite in dev or served directly in prod)
    this.socket = io('/', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      if (userId) {
        this.socket.emit('authenticate_socket', { user_id: userId });
      }
      // Re-join any active rooms after reconnecting
      this.joinedRooms.forEach((room) => {
        this.socket.emit('join_room', { room });
      });
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.joinedRooms.clear();
    }
  }

  joinRoom(room) {
    if (!room) return;
    this.joinedRooms.add(room);
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_room', { room });
    }
  }

  leaveRoom(room) {
    if (!room) return;
    this.joinedRooms.delete(room);
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_room', { room });
    }
  }

  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketClient = new SocketClient();
export default socketClient;
