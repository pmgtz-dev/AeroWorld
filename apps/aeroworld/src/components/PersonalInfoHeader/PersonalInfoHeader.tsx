"use client";

import Image from "next/image";
import styles from "./PersonalInfoHeader.module.css";
import { User } from "@/types/User";
import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket/socket";
import { WS_EVENTS } from "@/lib/socket/events";
import { formatLastSeen } from "@/lib/utils"

type Props = {
  user: User;
};

export default function PersonalInfoHeader({ user }: Props) {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (isOnline) return;

    const interval = setInterval(() => {
      forceTick((v) => v + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, [isOnline]);

  useEffect(() => {
    if (!user?.id) return;

    const s = getSocket();
    if (!s.connected) s.connect();

    setIsOnline(true);
    if (user.lastSeen) setLastSeen(new Date(user.lastSeen));

    const onOnline = (payload: any) => {
      if (+payload.userId !== user.id) return;
      setIsOnline(true);
    };

    const onOffline = (payload: any) => {
      if (+payload.userId !== user.id) return;
      setIsOnline(false);
      setLastSeen(new Date());
    };

    s.on(WS_EVENTS.PRESENCE_ONLINE, onOnline);
    s.on(WS_EVENTS.PRESENCE_OFFLINE, onOffline);

    return () => {
      s.off(WS_EVENTS.PRESENCE_ONLINE, onOnline);
      s.off(WS_EVENTS.PRESENCE_OFFLINE, onOffline);
    };
  }, [user?.id]);

  return (
    <div className={styles["NXKOuser-personal-info-section"]}>
      <div className="userpic-wrapper">
        <Image
          width={50}
          height={50}
          src="/images/defaultpfp_1.jpg"
          alt="User"
          className="userpic"
          id="NXKOuser-userpic"/>
        <span className="online-status-circle" style={{ display: isOnline ? 'block' : 'none'}}></span>
      </div>

      <div className={styles["NXKOuser-userinfo"]}>
        <div className={styles["NXKOuser-username"]}>{user.nickname || "user1800325200"}</div>
        <div className={styles["NXKOuser-username-id"]}>@{user.username}</div>
        <div className={isOnline ? styles["online-status"] : `${styles["online-status"]} ${styles["inactive"]}`}>
          {isOnline ? "Онлайн" : `Был(а) ${lastSeen ? formatLastSeen(lastSeen) : ""}`}
        </div>
      </div>
    </div>
  );
}