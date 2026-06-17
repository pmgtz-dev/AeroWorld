import { Controller, Get, Param, Post, Body, ParseIntPipe, DefaultValuePipe, Query } from '@nestjs/common';
import { AewoService } from './aewo.service';

class CreateChatDto {
  userId!: number;
  otherUserId!: number;
}

class SendMessageDto {
  chatId!: number;
  senderId!: number;
  content!: string;
  replyToMessageId!: number | null;
  forwardedFromMessageId!: number | null;
}

class DeleteChatDto {
  chatId!: number;
  userId!: number;
  scope!: "self" | "other" | "all";
}

@Controller('chats')
export class AewoController {
  constructor(private readonly aewoService: AewoService) {}

  @Post('get')
  async createChat(@Body() dto: CreateChatDto) {
    return this.aewoService.getOrCreateChat(dto.userId, dto.otherUserId);
  }

  @Get('user/:userId')
  async getUserChats(@Param('userId', ParseIntPipe) userId: number) {
    return this.aewoService.getUserChats(userId);
  }

  @Get(':chatId/messages')
  async getMessages(
    @Param('chatId', ParseIntPipe) chatId: number,
    @Query('userId', ParseIntPipe) userId: number,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take = 50,
    @Query('lastMessageId') lastMessageId?: string,
  ) {
    const cursor = lastMessageId ? Number(lastMessageId) : undefined;
    return this.aewoService.getMessages(
      chatId,
      userId,
      take,
      Number.isFinite(cursor) ? cursor : undefined
    );
  }

  @Post('message')
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.aewoService.sendMessage(
      dto.chatId,
      dto.senderId,
      dto.content,
      dto.replyToMessageId,
      dto.forwardedFromMessageId
    );
  }

  @Post('delete')
  async deleteChat(@Body() dto: DeleteChatDto) {
    return this.aewoService.deleteChat(dto.chatId, dto.userId, dto.scope);
  }
}
