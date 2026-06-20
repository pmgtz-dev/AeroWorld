"use client";

import { useState, useEffect } from "react";
import styles from "@/styles/home.module.scss";
import { useRouter } from "next/navigation";

import PersonalInfoHeader from "@/components/PersonalInfoHeader/PersonalInfoHeader";
import ChatList from "@/components/ChatList/ChatList";
import ActiveChat from "@/components/ActiveChat/ActiveChat";
import AewoInfo from "@/components/AewoInfo/AewoInfo";
import { useActiveChat } from "@/app/_providers/ActiveChatContext";
import { getSocket } from "@/lib/socket/socket";
import { WS_EVENTS } from "@/lib/socket/events";

export default function HomePage() {
  const [sidebarWidth, setSidebarWidth] = useState(24);
  const [user, setUser] = useState<any>(null);
  const { activeUser } = useActiveChat();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/get-me", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.status === 401) {
        router.replace("/auth/signup");
        return;
      }
    try {
      const data = await res.json();
      setUser(data.user);
    } catch (e) {
      alert("Ошибка парсинга ответа от сервера");
    }
    })();
  }, [router]);

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const nextUser = (event as CustomEvent).detail;
      if (!nextUser) return;
      setUser(nextUser);
    };

    window.addEventListener("aeroworld-profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("aeroworld-profile-updated", handleProfileUpdated);
    };
  }, []);
  
  
  useEffect(() => {
    if (!user) return;

    const s = getSocket();
    if (!s.connected) s.connect();

    let idleTimer: any = null;
    let isActive = true;

    const emitOnline = () => s.emit(WS_EVENTS.PRESENCE_ONLINE, {userId: user.id});
    const emitOffline = () => s.emit(WS_EVENTS.PRESENCE_OFFLINE, {userId: user.id});

    const setActive = () => {
      if (document.hidden) return;

      if (!isActive) {
        isActive = true;
        emitOnline();
      }

      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (isActive) {
          isActive = false;
          console.log("offline from timeout")
          emitOffline();
        }
      }, 60000*5);     // 5 минут бездействия = оффлайн
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (isActive) {
          isActive = false;
          console.log("offline from document.hidden")
          emitOffline();
        }
        clearTimeout(idleTimer);
      } else {
        setActive();
      }
    };

    const onAnyActivity = () => setActive();

    document.addEventListener("visibilitychange", onVisibility);

    ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "pointermove"].forEach((ev) =>
      window.addEventListener(ev, onAnyActivity, { passive: true })
    );
    if (!document.hidden) {
      emitOnline();
      setActive();
    } else {
      emitOffline();
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "pointermove"].forEach((ev) =>
        window.removeEventListener(ev, onAnyActivity)
      );
      clearTimeout(idleTimer);
    };
  }, [user]);

  if (!user) return null;

  const handleVerticalResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    document.body.style.cursor = "ew-resize";

    const onMouseMove = (e: MouseEvent) => {
      const pageWidth = window.innerWidth;
      const newWidth = (e.clientX / pageWidth) * 100;
      if (newWidth > 19 && newWidth < 50) {
        setSidebarWidth(newWidth);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.body.style.cursor = "default";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp, { once: true });
  };

  return (
    <div className={styles.NXKO}>
      <div
        className={styles["myNXKO-left"]}
        style={{ width: `${sidebarWidth}%` }}
      >
        <PersonalInfoHeader user={user} isSelf />
        <ChatList />
        <div className={styles["blue-cyan-strip"]}></div>
        <AewoInfo />
      </div>
      <div className={styles["resizer-vertical"]} onMouseDown={handleVerticalResize}>
        <div
          style={{
            background: `url(/images/divstart.png)`,
            backgroundSize: `100%`,
            backgroundRepeat: `no-repeat`,
            width: `100%`,
            height: `7px`,
          }}
        />
        <div
          style={{
            background: `url(/images/divbody.png)`,
            flex: 1,
            backgroundSize: `100% 100%`,
            backgroundRepeat: `repeat-y`,
            width: `100%`,
          }}
        />
        <div
          style={{
            background: `url(/images/divend.png)`,
            backgroundSize: `100%`,
            backgroundRepeat: `no-repeat`,
            width: `100%`,
            height: `8px`,
          }}
        />
      </div>
      <div
        className={styles["myNXKO-right"]}
        style={{
          background: `url('/images/197_2.jpg')`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
          backgroundSize: "cover",
        }}
      >
        <ActiveChat user={activeUser} />
      </div>
    </div>
  );
}
