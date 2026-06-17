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

  @Column({ type: "text", nullable: true })
  bio!: string | null;

  @Column({ type: "date", nullable: true })
  date_of_birth!: string | null;

  @Column({ default: true })
  show_year_of_birth!: boolean;

  @Column({ type: "text", nullable: true })
  like_stuff!: string | null;

  @Column({ type: "text", nullable: true })
  dislike_stuff!: string | null;

  @Column({ type: "text", nullable: true })
  avatar_url!: string | null;

  @Column({ type: "text", nullable: true })
  background_image_url!: string | null;

  @Column({ type: "timestamp", nullable: true })
  last_seen!: Date;

  @Column({ default: true })
  allow_messages_from_everyone!: boolean;

  @CreateDateColumn({ nullable: true })
  created_at!: Date;

  @UpdateDateColumn({ nullable: true })
  updated_at!: Date;
}
