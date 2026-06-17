export const WS_NAMESPACE = "/ws";

export const WS_ROOMS = {
  user: (userId: number) => `user:${userId}`,
  chat: (chatId: number) => `chat:${chatId}`,
} as const;

export const WS_EVENTS = {
  PRESENCE_ONLINE: "presence:online",
  PRESENCE_OFFLINE: "presence:offline",
  PRESENCE_GET: "presence:get",

  CHAT_JOIN: "chat:join",
  CHAT_LEAVE: "chat:leave",
  CHAT_MESSAGE_SEND: "chat:message:send",
  CHAT_MESSAGE_NEW: "chat:message:new",
  CHAT_MESSAGE_EDIT: "chat:message:edit",
  CHAT_MESSAGE_EDITED: "chat:message:edited",
  CHAT_MESSAGE_DELETE: "chat:message:delete",
  CHAT_MESSAGE_DELETED: "chat:message:deleted",
  CHAT_LIST_REFRESH: "chat:list:refresh",
  MESSAGE_VIEW: "message.view",
  MESSAGE_VIEWED: "message.viewed",

  CHAT_TYPING_START: "chat:typing:start",
  CHAT_TYPING_STOP: "chat:typing:stop",
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
