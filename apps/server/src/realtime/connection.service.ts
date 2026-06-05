import { Injectable } from "@nestjs/common";

@Injectable()
export class ConnectionService {
  private readonly userToSockets = new Map<number, Set<string>>();
  private readonly socketToUser = new Map<string, number>();
  private readonly usersOnline = new Set<number>();

  addConnection(userId: number, socketId: string) {
    const set = this.userToSockets.get(userId);
    const nextSet = set ?? new Set<string>();
    nextSet.add(socketId);
    this.userToSockets.set(userId, nextSet);
    this.socketToUser.set(socketId, userId);

    return { userId };
  }

  removeConnection(socketId: string) {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return { userId: null };

    this.socketToUser.delete(socketId);
    const set = this.userToSockets.get(userId);
    if (!set) return { userId };
    set.delete(socketId);

    if (set.size === 0) {
      this.userToSockets.delete(userId);
    }

    return { userId };
  }

  isOnline(userId: number): boolean {
    return this.usersOnline.has(userId);
  }
  setOnline(userId: number) {
    this.usersOnline.add(userId);
  }
  setOffline(userId: number) {
    this.usersOnline.delete(userId);
  }

  getUserIdBySocket(socketId: string): number | null {
    return this.socketToUser.get(socketId) ?? null;
  }

  getSocketIdsByUser(userId: number): string[] {
    return Array.from(this.userToSockets.get(userId) ?? []);
  }
}