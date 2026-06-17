import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { User } from "./user.entity";
import { RefreshToken } from "./refresh-token.entity";
import { ApiException } from "../common/exceptions/ApiException";
import * as crypto from "crypto";
import { PrivateChat } from "../aeroworld/entities/privateChat.entity";
//import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshRepo: Repository<RefreshToken>,
    @InjectRepository(PrivateChat)
    private readonly chatsRepo: Repository<PrivateChat>,
    private readonly jwtService: JwtService
  ) {}

  async pingDatabase() {
    await this.usersRepo.query("SELECT 1");
    return { status: "connected" };
  }

  async getAllUsers() {
    return this.usersRepo.find();
  }

  async getRefreshTokens() {
    return this.refreshRepo.find();
  }

  async createUser(username: string, nickname: string, password: string) { 
    const existing = await this.usersRepo.findOne({
      where: { username },
    });

    if (existing) {
      throw new ApiException("USERNAME_ALREADY_TAKEN");
    }

    const hash = await bcrypt.hash(password, 10);
    const user = this.usersRepo.create({ username, nickname, password_hash: hash, }); 
    return this.usersRepo.save(user); 
  }

  async login(username: string, password: string) {
    const user = await this.usersRepo.findOne({
      where: { username },
    });

    if (!user) {
      throw new ApiException("INVALID_CREDENTIALS");
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new ApiException("INVALID_CREDENTIALS");
    }

    const token = this.jwtService.sign(
      { sub: user.id },
      { expiresIn: "15m" }
    );

    const refreshToken = crypto.randomUUID();
    const hash = await bcrypt.hash(refreshToken, 10);

    await this.refreshRepo.save({
      user_id: user.id,
      token_hash: hash,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100), // 100 лет
    });

    return {
      ok: true,
      accessToken: token,
      refreshToken: refreshToken,
      user: {
        id: user.id,
        username: user.username,
      },
    };
  }

  async logout(refreshToken: string) {
    if (!refreshToken) {
      return { ok: true };
    }
    const records = await this.refreshRepo.find();
    for (const r of records) {
      if (await bcrypt.compare(refreshToken, r.token_hash)) {
        await this.refreshRepo.delete(r.id);
      }
    }
    return { ok: true };
  }

  async refresh(refreshToken: string, accessToken: string) {
    if (!refreshToken) {
      throw new ApiException("UNAUTHORIZED");
    }
    const records = await this.refreshRepo.find();
    const record = await Promise.any(
      records.map(async r =>
        (await bcrypt.compare(refreshToken, r.token_hash)) ? r : Promise.reject()
      )
    ).catch(() => null);

    if (!record || record.expires_at < new Date()) {
      throw new ApiException("UNAUTHORIZED");
    }
    
    try {
      this.jwtService.verify(accessToken);
    } catch {
        accessToken = this.jwtService.sign(
          { sub: record.user_id },
          { expiresIn: "15m" }
        );
    }
    return { accessToken: accessToken, userId: record.user_id };
  }

  async getMe(accessToken: string, refreshToken: string){
    const refreshed = await this.refresh(refreshToken, accessToken)
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshed.accessToken);
    } catch {
      throw new ApiException("UNAUTHORIZED");
    };
    
    const user = await this.getUserById(payload.sub);

    return {
      ok: true,
      user,
      accessToken
    };
  }
  
  async getUserById(userId: number) {
    const user = await this.usersRepo
      .createQueryBuilder("u")
      .select([
        "u.id", "u.username", "u.nickname", "u.avatar_url", "u.background_image_url", "u.bio", "u.date_of_birth", "u.show_year_of_birth", "u.like_stuff", "u.dislike_stuff", "u.last_seen", "u.allow_messages_from_everyone", "u.created_at"
      ])
      .where("u.id = :userId", { userId })
      .getOne();

    if (!user) {
      throw new ApiException("USER_NOT_FOUND");
    }
    return user;
  }

  async searchUsersByUsername(username: string) {
    if (!username) {
      return null;
    }
    const normQuery = username.trim().toLowerCase();

    const users = this.usersRepo
      .createQueryBuilder("u")
      .select(["u.id", "u.username", "u.nickname", "u.avatar_url", "u.background_image_url", "u.bio", "u.date_of_birth", "u.show_year_of_birth", "u.like_stuff", "u.dislike_stuff", "u.last_seen", "u.allow_messages_from_everyone", "u.created_at"])
      .where("LOWER(u.username) = :username", { username: normQuery })
      .getMany();

    return users;
  }

  async getLatestUsers(limit = 20, excludeUserId?: number) {
    const qb = this.usersRepo
      .createQueryBuilder("u")
      .select([
        "u.id",
        "u.username",
        "u.nickname",
        "u.avatar_url",
        "u.background_image_url",
        "u.bio",
        "u.date_of_birth",
        "u.show_year_of_birth",
        "u.like_stuff",
        "u.dislike_stuff",
        "u.last_seen",
        "u.allow_messages_from_everyone",
        "u.created_at",
      ])
      .orderBy("u.created_at", "DESC")
      .limit(limit);

    if (excludeUserId) {
      qb.where("u.id != :excludeUserId", { excludeUserId });
    }

    return qb.getMany();
  }

  async updateAvatar(accessToken: string, refreshToken: string, avatarUrl: string) {
    const refreshed = await this.refresh(refreshToken, accessToken);
    let payload: any;

    try {
      payload = this.jwtService.verify(refreshed.accessToken);
    } catch {
      throw new ApiException("UNAUTHORIZED");
    }

    await this.usersRepo.update(
      { id: Number(payload.sub) },
      { avatar_url: avatarUrl }
    );

    const user = await this.getUserById(Number(payload.sub));

    return {
      ok: true,
      user,
      accessToken: refreshed.accessToken,
    };
  }

  async updateProfile(
    accessToken: string,
    refreshToken: string,
    payload: {
      username: string;
      nickname: string;
      bio?: string | null;
      dateOfBirth?: string | null;
      showYearOfBirth?: string | boolean | null;
      likeStuff?: string | null;
      dislikeStuff?: string | null;
      avatarUrl?: string | null;
      backgroundImageUrl?: string | null;
      avatarFileUrl?: string;
      backgroundImageFileUrl?: string;
    }
  ) {
    const refreshed = await this.refresh(refreshToken, accessToken);
    let jwtPayload: any;

    try {
      jwtPayload = this.jwtService.verify(refreshed.accessToken);
    } catch {
      throw new ApiException("UNAUTHORIZED");
    }

    const userId = Number(jwtPayload.sub);
    const username = payload.username?.trim().toLowerCase();
    const nickname = payload.nickname?.trim();

    if (!username || !nickname) {
      throw new ApiException("MISSING_FIELDS");
    }

    const conflictingUser = await this.usersRepo.findOne({
      where: { username },
      select: ["id", "username"],
    });

    if (conflictingUser && Number(conflictingUser.id) !== userId) {
      throw new ApiException("USERNAME_ALREADY_TAKEN");
    }

    const currentUser = await this.usersRepo.findOne({
      where: { id: userId },
      select: ["id", "avatar_url", "background_image_url"],
    });

    if (!currentUser) {
      throw new ApiException("USER_NOT_FOUND");
    }

    const nextDateOfBirth =
      payload.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(payload.dateOfBirth)
        ? payload.dateOfBirth
        : null;

    await this.usersRepo.update(
      { id: userId },
      {
        username,
        nickname,
        bio: payload.bio?.trim() ? payload.bio.trim() : null,
        date_of_birth: nextDateOfBirth,
        show_year_of_birth:
          !!nextDateOfBirth &&
          (payload.showYearOfBirth === true || payload.showYearOfBirth === "true"),
        like_stuff: payload.likeStuff?.trim() ? payload.likeStuff.trim() : null,
        dislike_stuff: payload.dislikeStuff?.trim() ? payload.dislikeStuff.trim() : null,
        avatar_url:
          payload.avatarFileUrl ??
          (payload.avatarUrl?.trim()
            ? payload.avatarUrl.trim()
            : currentUser.avatar_url ?? null),
        background_image_url:
          payload.backgroundImageFileUrl ??
          (payload.backgroundImageUrl?.trim()
            ? payload.backgroundImageUrl.trim()
            : currentUser.background_image_url ?? null),
      }
    );

    const user = await this.getUserById(userId);

    return {
      ok: true,
      user,
      accessToken: refreshed.accessToken,
    };
  }

  async deleteAccountByUserId(userId: number) {
    const existingUser = await this.usersRepo.findOne({
      where: { id: userId },
      select: ["id"],
    });

    if (!existingUser) {
      throw new ApiException("USER_NOT_FOUND");
    }

    await this.refreshRepo.delete({ user_id: userId });
    await this.chatsRepo
      .createQueryBuilder()
      .delete()
      .where("user0_id = :userId OR user1_id = :userId", { userId })
      .execute();
    await this.usersRepo.delete({ id: userId });

    return { ok: true };
  }
}
