import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiException } from "../common/exceptions/ApiException";
import { User } from '../auth/user.entity';
import { Message } from './entities/message.entity';
import { PrivateChat } from './entities/privateChat.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WS_EVENTS } from '../realtime/events';

@Injectable()
export class AewoService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Message) private readonly messagesRepo: Repository<Message>,
    @InjectRepository(PrivateChat) private readonly chatsRepo: Repository<PrivateChat>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  private mapForwardedFromMessage(
    forwardedMessage:
      | {
          id: number;
          sender_id: number | null;
          sender_username?: string | null;
          sender_avatar_url?: string | null;
          content: string | null;
          created_at: Date | string | null;
        }
      | null
      | undefined,
  ) {
    if (!forwardedMessage) return null;

    return {
      id: forwardedMessage.id,
      userId: forwardedMessage.sender_id ?? null,
      username: forwardedMessage.sender_username ?? null,
      avatarUrl: forwardedMessage.sender_avatar_url ?? null,
      content: forwardedMessage.content ?? '',
      createdAt: forwardedMessage.created_at ?? null,
    };
  }

  private mapReplyToMessage(
    replyMessage:
      | {
          id: number;
          content: string | null;
          sender_id: number | null;
          sender_username?: string | null;
        }
      | null
      | undefined,
  ) {
    if (!replyMessage) return null;

    return {
      id: replyMessage.id,
      content: replyMessage.content ?? '',
      senderId: replyMessage.sender_id ?? 0,
      senderUsername: replyMessage.sender_username ?? null,
    };
  }

  private mapMessagePayload(
    message:
      | {
          id: number;
          content: string | null;
          sender_id: number;
          is_viewed: boolean;
          is_edited: boolean;
          is_pinned: boolean;
          viewed_at: Date | string | null;
          edited_at: Date | string | null;
          created_at: Date | string;
          reply_to_message?:
            | {
                id: number;
                content: string | null;
                sender_id: number | null;
                sender_username?: string | null;
              }
            | null;
          forwarded_from_message?:
            | {
                id: number;
                sender_id: number | null;
                sender_username?: string | null;
                sender_avatar_url?: string | null;
                content: string | null;
                created_at: Date | string | null;
              }
            | null;
        }
      | null,
  ) {
    if (!message) return null;

    return {
      id: message.id,
      content: message.content ?? '',
      senderId: message.sender_id,
      isViewed: !!message.is_viewed,
      isEdited: !!message.is_edited,
      isPinned: !!message.is_pinned,
      viewedAt: message.viewed_at ?? null,
      editedAt: message.edited_at ?? null,
      createdAt: message.created_at,
      replyToMessageId: this.mapReplyToMessage(message.reply_to_message),
      forwardedFromMessage: this.mapForwardedFromMessage(
        message.forwarded_from_message
      ),
    };
  }

  async getOrCreateChat(user0Id: number, user1Id: number) {
    let chat = await this.chatsRepo.findOne({
      where: [
        { user0: { id: user0Id }, user1: { id: user1Id } },
        { user0: { id: user1Id }, user1: { id: user0Id } }
      ],
    });

    if (!chat) {
      const user0 = await this.usersRepo.findOneBy({ id: user0Id });
      const user1 = await this.usersRepo.findOneBy({ id: user1Id });
      if (!user0 || !user1) {
        throw new ApiException("USER_NOT_FOUND");
      }

      chat = this.chatsRepo.create({
        user0: user0,
        user1: user1
    } as Partial<PrivateChat>);
      await this.chatsRepo.save(chat);
    }
    return chat;
  }

  async sendMessage(
    chatId: number,
    senderId: number,
    content: string,
    replyToMessageId: number | null,
    forwardedFromMessageId: number | null,
  ) {
    const chat = await this.chatsRepo.findOneBy({ id: chatId });
    if (!chat) {
      throw new ApiException("CHAT_NOT_FOUND");
    }

    const sender = await this.usersRepo.findOneBy({ id: senderId });
    if (!sender) {
      throw new ApiException("USER_NOT_FOUND");
    }

    let forwardedFromMessageEntity: Message | null = null;
    if (forwardedFromMessageId) {
      forwardedFromMessageEntity = await this.messagesRepo.findOne({
        where: { id: forwardedFromMessageId },
        relations: { sender: true },
      });

      if (!forwardedFromMessageEntity) {
        throw new ApiException("MESSAGE_NOT_FOUND");
      }
    }

    let replyToMessageEntity: Message | null = null;
    if (replyToMessageId) {
      replyToMessageEntity = await this.messagesRepo.findOneBy({ id: replyToMessageId });

      if (!replyToMessageEntity) {
        throw new ApiException("MESSAGE_NOT_FOUND");
      }
    }

    const message = this.messagesRepo.create({
      chat,
      sender,
      content,
      reply_to_message: replyToMessageEntity,
      forwarded_from_message: forwardedFromMessageEntity,
      forwarded_from_user: forwardedFromMessageEntity?.sender ?? null,
      original_content: forwardedFromMessageEntity?.content ?? null,
      original_created_at: forwardedFromMessageEntity?.created_at ?? null,
      created_at: new Date(),
    });

    await this.messagesRepo.save(message);

    const savedMessage = await this.messagesRepo.findOne({
      where: { id: message.id },
      relations: {
        reply_to_message: {
          sender: true,
        },
        forwarded_from_message: true,
        forwarded_from_user: true,
      },
    });

    if (!savedMessage) {
      throw new ApiException("MESSAGE_NOT_FOUND");
    }

    const messagePayload = this.mapMessagePayload({
      ...savedMessage,
      reply_to_message: savedMessage.reply_to_message
        ? {
            id: savedMessage.reply_to_message.id,
            content: savedMessage.reply_to_message.content,
            sender_id: savedMessage.reply_to_message.sender_id,
            sender_username:
              savedMessage.reply_to_message.sender?.nickname ?? null,
          }
        : null,
      forwarded_from_message: savedMessage.forwarded_from_message
        ? {
            id: savedMessage.forwarded_from_message.id,
            sender_id: savedMessage.forwarded_from_user?.id ?? null,
            sender_username: savedMessage.forwarded_from_user?.nickname ?? null,
            sender_avatar_url:
              savedMessage.forwarded_from_user?.avatar_url ?? null,
            content: savedMessage.original_content,
            created_at: savedMessage.original_created_at,
          }
        : null,
    });

    this.realtimeGateway.emitToChat(chatId, WS_EVENTS.CHAT_MESSAGE_NEW, {
      chatId,
      message: messagePayload,
    });
    return messagePayload;
  }

  async getMessageById(messageId: number) {
    const message = await this.messagesRepo.findOne({
      where: { id: messageId },
      relations: {
        reply_to_message: {
          sender: true,
        },
        forwarded_from_message: true,
        forwarded_from_user: true,
      },
    });
    if (!message) return null;

    return this.mapMessagePayload({
      ...message,
      reply_to_message: message.reply_to_message
        ? {
            id: message.reply_to_message.id,
            content: message.reply_to_message.content,
            sender_id: message.reply_to_message.sender_id,
            sender_username: message.reply_to_message.sender?.username ?? null,
          }
        : null,
      forwarded_from_message: message.forwarded_from_message
        ? {
            id: message.forwarded_from_message.id,
            sender_id: message.forwarded_from_user?.id ?? null,
            sender_username: message.forwarded_from_user?.username ?? null,
            sender_avatar_url: message.forwarded_from_user?.avatar_url ?? null,
            content: message.original_content,
            created_at: message.original_created_at,
          }
        : null,
    });
  }

  async getMessages(chatId: number, userId: number, take: number, lastMessageId?: number) {
    const qb = this.messagesRepo
      .createQueryBuilder("m")
      .leftJoin(Message, "rm", "rm.id = m.reply_to_message_id")
      .leftJoin(User, "ru", "ru.id = rm.sender_id")
      .leftJoin(User, "fu", "fu.id = m.forwarded_from_user_id")
      .where("m.chat_id = :chatId", { chatId })
      .andWhere(
        "(m.deleted_for_user_id IS NULL OR m.deleted_for_user_id != :userId)",
        { userId }
      );

    if (lastMessageId) {
      qb.andWhere(
        "m.created_at < (SELECT created_at FROM messages WHERE id = :lastMessageId)",
        { lastMessageId }
      );
    }

    const rows = await qb
      .orderBy("m.created_at", "DESC")
      .limit(take)
      .select([
        "m.id AS id",
        "m.content AS content",
        "m.sender_id AS sender_id",
        "m.is_viewed AS is_viewed",
        "m.is_edited AS is_edited",
        "m.is_pinned AS is_pinned",
        "m.edited_at AS edited_at",
        "m.viewed_at AS viewed_at",
        "m.created_at AS created_at",
        "rm.id AS reply_id",
        "rm.content AS reply_content",
        "rm.sender_id AS reply_sender_id",
        "ru.nickname AS reply_sender_username",
        "m.forwarded_from_message_id AS f_msg_id",
        "m.forwarded_from_user_id AS f_user_id",
        "m.original_content AS original_content",
        "m.original_created_at AS original_created_at",

        "fu.nickname AS fu_username",
        "fu.avatar_url AS fu_avatar_url",
      ])
      .getRawMany();

    const messages = rows.reverse().map((r) =>
      this.mapMessagePayload({
        id: +r.id,
        content: r.content,
        sender_id: +r.sender_id,
        is_viewed: !!r.is_viewed,
        is_edited: !!r.is_edited,
        is_pinned: !!r.is_pinned,
        viewed_at: r.viewed_at,
        edited_at: r.edited_at,
        created_at: r.created_at,
        reply_to_message: r.reply_id
          ? {
              id: +r.reply_id,
              content: r.reply_content,
              sender_id: r.reply_sender_id ? +r.reply_sender_id : null,
              sender_username: r.reply_sender_username ?? null,
            }
          : null,
        forwarded_from_message: r.f_msg_id
          ? {
              id: +r.f_msg_id,
              sender_id: r.f_user_id ? +r.f_user_id : null,
              sender_username: r.fu_username ?? null,
              sender_avatar_url: r.fu_avatar_url ?? null,
              content: r.original_content,
              created_at: r.original_created_at,
            }
          : null,
      })
    );
    return messages;
  }

  async getUserChats(userId: number) {
    const chats = await this.chatsRepo.find({
      where: [
        { user0: { id: userId } },
        { user1: { id: userId } },
      ],
      order: {
        id: "DESC",
      },
    });

    const mappedChats = await Promise.all(
      chats.map(async (chat) => {
        const otherUser = chat.user0.id === userId ? chat.user1 : chat.user0;
        const visibleMessage = await this.messagesRepo
          .createQueryBuilder("m")
          .where("m.chat_id = :chatId", { chatId: chat.id })
          .andWhere(
            "(m.deleted_for_user_id IS NULL OR m.deleted_for_user_id != :userId)",
            { userId }
          )
          .orderBy("m.created_at", "DESC")
          .getOne();
        const unreadCount = await this.messagesRepo
          .createQueryBuilder("m")
          .where("m.chat_id = :chatId", { chatId: chat.id })
          .andWhere("m.sender_id != :userId", { userId })
          .andWhere("m.is_viewed = false")
          .andWhere(
            "(m.deleted_for_user_id IS NULL OR m.deleted_for_user_id != :userId)",
            { userId }
          )
          .getCount();
        return {
          chat: { id: chat.id },
          otherUser: {
            id: otherUser.id,
            username: otherUser.username,
            nickname: otherUser.nickname,
            avatarUrl: otherUser.avatar_url,
            lastSeen: otherUser.last_seen,
          },
          lastMessage: visibleMessage
            ? {
                id: visibleMessage.id,
                content: visibleMessage.content,
                createdAt: visibleMessage.created_at,
                originalContent: visibleMessage.original_content,
                isViewed: !!visibleMessage.is_viewed,
                senderId: visibleMessage.sender_id,
              }
            : null,
          unreadCount,
        };
      })
    );
    return mappedChats.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;
      const bTime = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;
      return bTime - aTime;
    });
  }

}
