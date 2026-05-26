import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
let socketAuthToken: string | null = null;

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('argus-auth');
    const state = stored ? JSON.parse(stored).state : null;
    return state?.accessToken || state?.token || null;
  } catch {
    return null;
  }
}

function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      auth: { token: getToken() },
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
    });
    // Suppress noisy console errors; polling remains as a fallback.
    socket.on('connect_error', () => {});
    socket.on('disconnect', () => {});
    socket.on('error', () => {});
  }
  return socket;
}

export function refreshSocketAuth(): void {
  const s = getSocket();
  const token = getToken();
  const tokenChanged = socketAuthToken !== token;
  socketAuthToken = token;
  s.auth = { token };
  if (!token && s.connected) {
    s.disconnect();
    return;
  }
  if (token && !s.connected) {
    s.connect();
  } else if (token && tokenChanged) {
    s.disconnect();
    s.connect();
  }
}

export function useSocket(): Socket {
  const socketRef = useRef<Socket>(getSocket());
  useEffect(() => {
    const s = socketRef.current;
    refreshSocketAuth();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'argus-auth') refreshSocketAuth();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return socketRef.current;
}

export function emitEvent<T = unknown>(event: string, data?: T): void {
  const s = getSocket();
  if (s.connected) s.emit(event, data);
}

export function onEvent<T = unknown>(event: string, cb: (data: T) => void): () => void {
  const s = getSocket();
  s.on(event, cb as (...args: unknown[]) => void);
  return () => { s.off(event, cb as (...args: unknown[]) => void); };
}

export function disconnectSocket(): void {
  socketAuthToken = null;
  if (socket) { socket.disconnect(); socket = null; }
}
