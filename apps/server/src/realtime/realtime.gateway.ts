import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Logger, UseGuards } from "@nestjs/common";
import { Server, Socket } from "socket.io";

import { ConnectionService } from "./connection.service";
import { TokenVerifierService } from "./token-verifier.service";
import { WS_EVENTS, WS_NAMESPACE, WS_ROOMS } from "./events";
import { WsAuthGuard } from "./ws-auth.guard";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../auth/user.entity";
import { Message } from "../aeroworld/entities/message.entity";
import { PrivateChat } from "../aeroworld/entities/privateChat.entity";
import { ApiException } from "../common/exceptions/ApiException";
import { In } from "typeorm";

export interface WsTokenVerifier {
  verify(accessToken?: string, refreshToken?: string): Promise<{ userId: number }>;
}

type DeleteMessagesScope = "self" | "other" | "all";

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...v] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(v.join("=") || "");
  }
  return out;
}

@WebSocketGateway({
  namespace: WS_NAMESPACE,
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly connections: ConnectionService,
    private readonly tokenVerifier: TokenVerifierService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Message) private readonly messagesRepo: Repository<Message>,
    @InjectRepository(PrivateChat)
    private readonly chatsRepo: Repository<PrivateChat>,
  ) {}

  afterInit(server: Server) {
    server.use(async (socket: Socket, next) => {
      try {
        const cookies = parseCookies(socket.handshake.headers.cookie);
        const accessToken = cookies["access_token"];
        const refreshToken = cookies["refresh_token"];
        const { userId } = await this.tokenVerifier.verify(accessToken, refreshToken);
        socket.data.userId = userId;

        this.logger.log(`WS AUTH OK userId=${userId}`);
        return next();
      } catch (e: any) {
        this.logger.error(`WS AUTH FAIL: ${e?.message ?? e}`);
        return next(new Error("WS_UNAUTHORIZED"));
      }
    });
  }
  
  async handleConnection(client: Socket) {
    const userId: number | undefined = client.data?.userId;
    if (!userId) { 
      client.disconnect(true); 
      return; 
    }
    this.connections.addConnection(userId, client.id);
    client.join(WS_ROOMS.user(userId));
  }


  async handleDisconnect(client: Socket) {
    const { userId } = this.connections.removeConnection(client.id);
    if (userId) {
      this.server.emit(WS_EVENTS.PRESENCE_OFFLINE, { userId });
    }
  }

  emitToUser(userId: number, event: string, payload: any) {
    this.server.to(WS_ROOMS.user(userId)).emit(event, payload);
  }

  emitToChat(chatId: number, event: string, payload: any) {
    this.server.to(WS_ROOMS.chat(chatId)).emit(event, payload);
  }

  broadcast(event: string, payload: any) {
    this.server.emit(event, payload);
  }

  private async getAuthorizedChat(chatId: number, userId: number) {
    const chat = await this.chatsRepo.findOne({
      where: { id: chatId },
    });

    if (!chat) {
      throw new ApiException("CHAT_NOT_FOUND");
    }

    const isParticipant =
      chat.user0.id === userId || chat.user1.id === userId;

    if (!isParticipant) {
      return null;
    }

    return chat;
  }

  private getOtherParticipantId(chat: PrivateChat, userId: number) {
    return chat.user0.id === userId ? chat.user1.id : chat.user0.id;
  }

 @UseGuards(WsAuthGuard)
  @SubscribeMessage(WS_EVENTS.CHAT_JOIN)
  async chatJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { chatId: number }) {
    const chatId = Number(body?.chatId);
    if (!Number.isFinite(chatId)) 
      return { ok: false, error: "INVALID_CHAT_ID" };
    await client.join(WS_ROOMS.chat(chatId));

    return { ok: true, joined: WS_ROOMS.chat(chatId) };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(WS_EVENTS.CHAT_LEAVE)
  async chatLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { chatId: number }) {
    const chatId = Number(body?.chatId);
    if (!Number.isFinite(chatId)) 
      return { ok: false, error: "INVALID_CHAT_ID" };
    await client.leave(WS_ROOMS.chat(chatId));
    return { ok: true, left: WS_ROOMS.chat(chatId) };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(WS_EVENTS.CHAT_TYPING_START)
  typingStart(@ConnectedSocket() c: Socket, @MessageBody() b: { chatId: number }) {
    const userId = +c.data.userId, chatId = +b?.chatId;
    if (!Number.isFinite(chatId)) 
      return { ok: false };

    c.to(WS_ROOMS.chat(chatId)).emit(WS_EVENTS.CHAT_TYPING_START, { chatId, userId });
    return { ok: true };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(WS_EVENTS.CHAT_TYPING_STOP)
  typingStop(@ConnectedSocket() c: Socket, @MessageBody() b: { chatId: number }) {
    const userId = +c.data.userId, chatId = +b?.chatId;
  
    if (!Number.isFinite(chatId)) 
      return { ok: false };

    c.to(WS_ROOMS.chat(chatId)).emit(WS_EVENTS.CHAT_TYPING_STOP, { chatId, userId });
    return { ok: true };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(WS_EVENTS.PRESENCE_GET)
  getPresence(@ConnectedSocket() c: Socket, @MessageBody() b: { userId: number }){
    const userId = +b?.userId
    if (!Number.isFinite(userId)) 
      return { ok: false, undefined };

    const online = this.connections.isOnline(userId);
    console.log(userId, 'is online??', online)
    return {ok: true, online};
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(WS_EVENTS.PRESENCE_ONLINE)
  presenceOnline(@ConnectedSocket() c: Socket) {
    const userId = +c.data.userId;
    this.connections.setOnline(userId);
    this.server.emit(WS_EVENTS.PRESENCE_ONLINE, { userId });
    console.log('online', userId)
    return { ok: true };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(WS_EVENTS.PRESENCE_OFFLINE)
  async presenceOffline(@ConnectedSocket() c: Socket) {
    const userId = +c.data.userId;
    await this.usersRepo.update(
      { id: userId },
      { last_seen: new Date() },
    );
    this.connections.setOffline(userId);
    this.server.emit(WS_EVENTS.PRESENCE_OFFLINE, { userId });
    console.log('offline', userId)

    return { ok: true };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(WS_EVENTS.CHAT_MESSAGE_DELETE)
  async deleteMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      chatId: number;
      messageIds: number[];
      scope: DeleteMessagesScope;
    },
  ) {
    const userId = Number(client.data.userId);
    const chatId = Number(body?.chatId);
    const scope = body?.scope;
    const messageIds = Array.from(
      new Set((body?.messageIds ?? []).map((value) => Number(value)))
    ).filter(Number.isFinite);

    if (!Number.isFinite(chatId) || !messageIds.length) {
      return { ok: false, error: "INVALID_PAYLOAD" };
    }

    if (scope !== "self" && scope !== "other" && scope !== "all") {
      return { ok: false, error: "INVALID_DELETE_SCOPE" };
    }

    const chat = await this.getAuthorizedChat(chatId, userId);
    if (!chat) {
      return { ok: false, error: "FORBIDDEN" };
    }

    const messages = await this.messagesRepo.find({
      where: {
        id: In(messageIds),
        chat: { id: chatId },
      },
      select: ["id", "sender_id", "deleted_for_user_id"],
    });

    if (!messages.length) {
      return { ok: true, deletedMessageIds: [], scope };
    }

    if (scope === "all") {
      const idsToDelete = messages.map((message) => message.id);
      await this.messagesRepo.delete(idsToDelete);

      this.emitToChat(chatId, WS_EVENTS.CHAT_MESSAGE_DELETED, {
        chatId,
        messageIds: idsToDelete,
        scope,
      });

      return { ok: true, deletedMessageIds: idsToDelete, scope };
    }

    const targetUserId =
      scope === "self" ? userId : this.getOtherParticipantId(chat, userId);
    const idsToHide = messages
      .filter((message) => message.deleted_for_user_id == null)
      .map((message) => message.id);
    const idsToDelete = messages
      .filter(
        (message) =>
          message.deleted_for_user_id != null &&
          Number(message.deleted_for_user_id) !== targetUserId
      )
      .map((message) => message.id);

    if (idsToHide.length) {
      await this.messagesRepo.update(
        { id: In(idsToHide) },
        { deleted_for_user_id: targetUserId }
      );
    }

    if (idsToDelete.length) {
      await this.messagesRepo.delete(idsToDelete);
    }

    this.emitToUser(targetUserId, WS_EVENTS.CHAT_MESSAGE_DELETED, {
      chatId,
      messageIds: [...idsToHide, ...idsToDelete],
      scope,
    });

    return {
      ok: true,
      deletedMessageIds: [...idsToHide, ...idsToDelete],
      scope,
    };
  }

@UseGuards(WsAuthGuard)
@SubscribeMessage(WS_EVENTS.MESSAGE_VIEW)
async onMessageView(
  @ConnectedSocket() client: Socket,
  @MessageBody() body: { messageIds: number[] },
) {

  const viewerId = Number(client.data.userId);

  const ids = Array.from(
    new Set((body?.messageIds ?? []).map(n => Number(n)))
  ).filter(Number.isFinite);

  if (!ids.length) {
    return { ok: true };
  }

  const messages = await this.messagesRepo.find({
    where: { id: In(ids) },
    select: ["id", "sender_id"],
  });

  console.log("📦 messages from DB:", messages);

  if (!messages.length) {
    return { ok: true };
  }
  const candidates = messages.filter(m => Number(m.sender_id) !== viewerId);

  if (!candidates.length) {
    return { ok: true };
  }
  const senderId = Number(candidates[0].sender_id);

  for (const m of candidates) {
    if (Number(m.sender_id) !== senderId) {
      throw new ApiException("MULTIPLE_SENDERS");
    }
  }
  const viewedAt = new Date();
  const candidateIds = candidates.map(m => m.id);
  const updateResult = await this.messagesRepo
    .createQueryBuilder()
    .update()
    .set({
      is_viewed: true,
      viewed_at: viewedAt,
    })
    .where("id IN (:...ids)", { ids: candidateIds })
    .execute();

  console.log("🧠 update result:", updateResult);

  const room = `user:${senderId}`;

  this.server.to(room).emit(WS_EVENTS.MESSAGE_VIEWED, {
    messageIds: candidateIds,
    viewedAt: viewedAt,
  });

  return { ok: true };
}


}
