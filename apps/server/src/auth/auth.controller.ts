import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { mkdirSync } from "fs";
import { join } from "path";
import { ApiException } from "../common/exceptions/ApiException";
import { generateStoredFileName } from "../common/generateStoredFileName";
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

  @Get("latest")
    async latestUsers(
      @Query("limit") limit?: string,
      @Query("excludeUserId") excludeUserId?: string
    ) {
      const parsedLimit = Number(limit);
      const parsedExcludeUserId = Number(excludeUserId);
      return this.AuthService.getLatestUsers(
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20,
        Number.isFinite(parsedExcludeUserId) && parsedExcludeUserId > 0
          ? parsedExcludeUserId
          : undefined
      );
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

  @Post("logout")
  async logout(@Body("refreshToken") refreshToken: string) {
    return this.AuthService.logout(refreshToken);
  }

  @Post("delete-account")
  async deleteAccount(@Body("userId") userId: number) {
    return this.AuthService.deleteAccountByUserId(Number(userId));
  }

  @Post("avatar")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req: any, _file: any, cb: any) => {
          const uploadDir = join(
            process.cwd(),
            "apps",
            "aeroworld",
            "public",
            "uploads",
            "avatars"
          );
          mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (_req: any, file: any, cb: any) => {
          cb(null, generateStoredFileName(file.originalname));
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!file.mimetype?.startsWith("image/")) {
          return cb(new ApiException("INVALID_FILE_TYPE") as any, false);
        }
        cb(null, true);
      },
    })
  )
  async uploadAvatar(
    @Body("accessToken") accessToken: string,
    @Body("refreshToken") refreshToken: string,
    @UploadedFile() file: any
  ) {
    if (!file) {
      throw new ApiException("MISSING_FIELDS");
    }

    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.AuthService.updateAvatar(accessToken, refreshToken, avatarUrl);
  }

  @Post("profile")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "avatarFile", maxCount: 1 },
        { name: "backgroundImageFile", maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_req: any, file: any, cb: any) => {
            const uploadDir = join(
              process.cwd(),
              "apps",
              "aeroworld",
              "public",
              "uploads",
              file.fieldname === "backgroundImageFile"
                ? "backgrounds"
                : "avatars"
            );
            mkdirSync(uploadDir, { recursive: true });
            cb(null, uploadDir);
          },
          filename: (_req: any, file: any, cb: any) => {
            cb(null, generateStoredFileName(file.originalname));
          },
        }),
        limits: {
          fileSize: 5 * 1024 * 1024,
        },
        fileFilter: (_req: any, file: any, cb: any) => {
          if (!file.mimetype?.startsWith("image/")) {
            return cb(new ApiException("INVALID_FILE_TYPE") as any, false);
          }
          cb(null, true);
        },
      }
    )
  )
  async updateProfile(
    @Body("accessToken") accessToken: string,
    @Body("refreshToken") refreshToken: string,
    @Body("username") username: string,
    @Body("nickname") nickname: string,
    @Body("bio") bio: string,
    @Body("dateOfBirth") dateOfBirth: string,
    @Body("showYearOfBirth") showYearOfBirth: string,
    @Body("likeStuff") likeStuff: string,
    @Body("dislikeStuff") dislikeStuff: string,
    @Body("avatarUrl") avatarUrl: string,
    @Body("backgroundImageUrl") backgroundImageUrl: string,
    @UploadedFiles()
    files:
      | {
          avatarFile?: any[];
          backgroundImageFile?: any[];
        }
      | undefined
  ) {
    return this.AuthService.updateProfile(accessToken, refreshToken, {
      username,
      nickname,
      bio,
      dateOfBirth,
      showYearOfBirth,
      likeStuff,
      dislikeStuff,
      avatarUrl,
      backgroundImageUrl,
      avatarFileUrl: files?.avatarFile?.[0]
        ? `/uploads/avatars/${files.avatarFile[0].filename}`
        : undefined,
      backgroundImageFileUrl: files?.backgroundImageFile?.[0]
        ? `/uploads/backgrounds/${files.backgroundImageFile[0].filename}`
        : undefined,
    });
  }
}
