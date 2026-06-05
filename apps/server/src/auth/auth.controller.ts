import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { AuthService } from "./auth.service";
//import { JwtService } from "@nestjs/jwt";
//import type { Request } from "express";
//import { ApiException } from "../common/exceptions/ApiException";

@Controller("users")
export class UsersController {
  constructor(
    private readonly AuthService: AuthService,
    //private readonly jwtService: JwtService,
  ) {}

  @Get("ping")
  async pingDatabase() {
    return this.AuthService.pingDatabase();
  }

  @Get()
  async getAllUsers() {
    return this.AuthService.getAllUsers();
  }
  @Get("refresh-tokens")
  async getRefreshTokens() {
    return this.AuthService.getRefreshTokens();
  }

  @Post("me")
    async me(@Body() body: { accessToken: string; refreshToken: string }) {
      const { accessToken, refreshToken } = body;
      return this.AuthService.getMe(accessToken, refreshToken);
    }

  @Get("search")
    async searchUser(@Query("username") username: string) {
      return this.AuthService.searchUsersByUsername(username);
    }

  @Post()
    async createUser(
      @Body("username") username: string,
      @Body("nickname") nickname: string,
      @Body("password") password: string
    ) {
      return this.AuthService.createUser(username, nickname, password);
    }

  @Post("login")
    async login(
      @Body("username") username: string,
      @Body("password") password: string
    ) {

    const result = await this.AuthService.login(username, password);

    return {
      ok: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }
  @Post("refresh-access-token")
    async refresh(@Body() body: any) {
      return this.AuthService.refresh(body.refreshToken, body.accessToken);
  }
}
