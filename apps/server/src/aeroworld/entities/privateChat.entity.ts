import {
  Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Unique, Index
} from "typeorm";
import { User } from "../../auth/user.entity";

@Entity("private_chats")
@Unique(["user0", "user1"])
export class PrivateChat {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { eager: true, nullable: false })
  @JoinColumn({ name: "user0_id" })
  @Index()
  user0!: User;

  @ManyToOne(() => User, { eager: true, nullable: false })
  @JoinColumn({ name: "user1_id" })
  @Index()
  user1!: User;
}
