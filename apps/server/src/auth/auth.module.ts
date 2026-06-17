import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { User } from "./user.entity";
import { RefreshToken } from "./refresh-token.entity";
import { JwtModule } from "@nestjs/jwt";
import { PrivateChat } from "../aeroworld/entities/privateChat.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, PrivateChat]),
    JwtModule.register({
        secret: process.env.JWT_SECRET || "dev-secret",
        signOptions: {
          expiresIn: "100y",
        },
      }),
    ],

  controllers: [UsersController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
