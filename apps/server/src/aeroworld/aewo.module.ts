import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AewoService } from './aewo.service';
import { AewoController } from './aewo.controller';

import { User } from '../auth/user.entity';
import { Message } from './entities/message.entity';
import { PrivateChat } from './entities/privateChat.entity';
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Message, PrivateChat]),
    RealtimeModule
  ],
  controllers: [AewoController],
  providers: [AewoService],
  exports: [AewoService],
})
export class AewoModule {}