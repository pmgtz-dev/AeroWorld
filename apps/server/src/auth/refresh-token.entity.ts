import { Entity, PrimaryGeneratedColumn, Column, Unique } from "typeorm";

@Entity()
@Unique(["user_id", "device_id"])
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  user_id!: number;

  @Column({ nullable: true })
  token_hash!: string;

  @Column({ nullable: true })
  device_id!: string;

  @Column({ nullable: true })
  expires_at!: Date;
}