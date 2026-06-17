export interface User {
  id: number;
  username: string;
  nickname: string;
  avatarUrl: string | null;
  backgroundImageUrl: string | null;
  bio: string | null;
  dateOfBirth: string | null;
  showYearOfBirth: boolean;
  likeStuff: string | null;
  dislikeStuff: string | null;
  lastSeen: Date | null;
}
