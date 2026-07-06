import { io } from 'socket.io-client';

let socket = null;

export function getSocket(options = {}) {
  if (!socket || socket.disconnected) {
    socket = io({
      withCredentials: true,
      transports: ['websocket', 'polling'],
      ...options,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
