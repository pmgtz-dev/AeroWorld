export type DeleteChatScope = "self" | "other" | "all";

export type LocalChatDeletedDetail = {
  chatId: number;
  scope: DeleteChatScope;
  otherUserId: number | null;
};

export const LOCAL_CHAT_DELETED_EVENT = "aeroworld:chat-deleted";

export async function deleteChatRequest(chatId: number, scope: DeleteChatScope) {
  const res = await fetch("/api/chats/delete", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chatId,
      scope,
    }),
  });

  const response = await res.json();

  if (!res.ok || !response?.ok) {
    throw response;
  }

  return response;
}

export function announceLocalChatDeleted(detail: LocalChatDeletedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LOCAL_CHAT_DELETED_EVENT, { detail }));
}
