import { Module } from "@nestjs/common";
import { ConnectionService } from "./connection.service";
import { RealtimeGateway } from "./realtime.gateway";
import { WsAuthGuard } from "./ws-auth.guard";
import { TokenVerifierService } from "./token-verifier.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../auth/user.entity";
import { Message } from "../aeroworld/entities/message.entity";
import { PrivateChat } from "../aeroworld/entities/privateChat.entity";

@Module({
  providers: [
    ConnectionService,
    WsAuthGuard,
    TokenVerifierService,
    RealtimeGateway,
  ],
  imports: [
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forFeature([Message, PrivateChat]),
  ],
  exports: [ConnectionService, RealtimeGateway],
})
export class RealtimeModule {}
