import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index
} from "typeorm";
import { PrivateChat } from "./privateChat.entity";
import { User } from "../../auth/user.entity";

@Entity("messages")
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => PrivateChat, { onDelete: "CASCADE" })
  @JoinColumn({ name: "chat_id" })
  @Index()
  chat!: PrivateChat;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_id" })
  @Index()
  sender!: User;

  @Column({ name: "sender_id" })
  sender_id!: number;

  @Column({ type: "text", nullable: true })
  content!: string | null;

  @Column({ default: false })
  is_viewed!: boolean;

  @Column({ default: false })
  is_edited!: boolean;

  @Column({ default: false })
  is_pinned!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  edited_at!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @Column({ type: "timestamptz", nullable: true })
  viewed_at!: Date | null;

  @Column({ name: "deleted_for_user_id", type: "int", nullable: true })
  @Index()
  deleted_for_user_id!: number | null;

  @ManyToOne(() => Message, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "reply_to_message_id" })
  @Index()
  reply_to_message!: Message | null;

  @ManyToOne(() => Message, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "forwarded_from_message_id" })
  @Index()
  forwarded_from_message!: Message | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "forwarded_from_user_id" })
  @Index()
  forwarded_from_user!: User | null;

  @Column({ type: "text", nullable: true })
  original_content!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  original_created_at!: Date | null;
}
