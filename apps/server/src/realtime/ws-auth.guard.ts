import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Socket } from "socket.io";

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();

    const userId = client.data?.userId;
    if (!userId) {
      throw new UnauthorizedException("WS_UNAUTHORIZED");
    }
    return true;
  }
}