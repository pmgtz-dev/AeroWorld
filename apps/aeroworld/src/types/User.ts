export interface User {
  id: number;
  username: string;
  nickname: string;
  avatarUrl: string | null;
  lastSeen: Date | null;
}