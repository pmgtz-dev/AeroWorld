import { io, Socket } from "socket.io-client";
import { WS_NAMESPACE } from "./events";

let socket: Socket | null = null;

export function getSocket() {
  if (socket) return socket;

  // если Nest доступен на том же домене, можно оставить origin текущий
  // но namespace у тебя "/ws", поэтому URL должен включать namespace:
  socket = io(WS_NAMESPACE, {
    transports: ["websocket"],     // быстрее и предсказуемо, без long-polling
    withCredentials: true,         // КЛЮЧЕВО: отправит cookies на handshake
    path: "/socket.io",            // важно если nginx проксит /socket.io/
    autoConnect: false,            // подключаемся руками, когда нужно
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelayMax: 5000,
  });

  // удобно сразу логировать
  socket.on("connect_error", (err) => {
    console.error("WS connect_error:", err?.message || err);
  });

  return socket;
}
