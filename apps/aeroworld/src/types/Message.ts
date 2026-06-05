export type Message = {
  id: number;
  content: string;
  type: "sent" | "received";
  last?: boolean;
  isViewed: boolean;
  isEdited: boolean;
  isPinned: boolean;
  editedAt: string | null;
  createdAt: string;
  viewedAt: string | null,
  replyToMessageId: {
    id: number;
    content: string;
    senderId: number;
    senderUsername: string | null;
  } | null;

  forwardedFromMessage: {
    id: number;
    userId: number;
    username: string | null;
    avatarUrl: string | null;
    content: string;
    createdAt: string;
  } | null;
};
