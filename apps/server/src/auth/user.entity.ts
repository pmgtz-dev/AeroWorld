import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column({ nullable: true })
  password_hash!: string;

  @Column()
  nickname!: string;

  @Column({ nullable: true })
  bio!: string;

  @Column({ nullable: true })
  avatar_url!: string;

  @Column({ type: "timestamp", nullable: true })
  last_seen!: Date;

  @Column({ default: true })
  allow_messages_from_everyone!: boolean;

  @Column({ nullable: true })
  refresh_token_hash!: string;

  @CreateDateColumn({ nullable: true })
  created_at!: Date;

  @UpdateDateColumn({ nullable: true })
  updated_at!: Date;
}