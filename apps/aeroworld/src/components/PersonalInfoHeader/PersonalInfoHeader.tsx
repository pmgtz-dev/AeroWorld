"use client";

import Image from "next/image";
import styles from "./PersonalInfoHeader.module.css";
import { User } from "@/types/User";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getSocket } from "@/lib/socket/socket";
import { WS_EVENTS } from "@/lib/socket/events";
import { formatLastSeen } from "@/lib/utils"
import { useEditProfileModal } from "@/app/_providers/EditProfileModalContext";
import { useRouter } from "next/navigation";

type Props = {
  user: User;
  showEditBadge?: boolean;
};

type SettingsMenu = {
  x: number;
  y: number;
  isPositioned: boolean;
} | null;

export default function PersonalInfoHeader({ user, showEditBadge = false }: Props) {
  const { openEditProfile } = useEditProfileModal();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
  const [settingsMenu, setSettingsMenu] = useState<SettingsMenu>(null);
  const [settingsConfirmAction, setSettingsConfirmAction] = useState<{
    action: "logout" | "delete";
    label: string;
  } | null>(null);
  const [, forceTick] = useState(0);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const navigationStartRef = useRef<HTMLAudioElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const playNavigationSound = () => {
    const navigationStart = navigationStartRef.current;
    if (!navigationStart) return;
    navigationStart.currentTime = 0;
    void navigationStart.play().catch(() => {});
  };

  useEffect(() => {
    setAvatarUrl(user.avatarUrl ?? null);
  }, [user.avatarUrl]);

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

    setIsOnline(false);
    setLastSeen(user.lastSeen ? new Date(user.lastSeen) : null);

    s.emit(WS_EVENTS.PRESENCE_GET, { userId: user.id }, (res: any) => {
      if (!res?.ok) return;
      setIsOnline(!!res.online);
    });

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
  }, [user?.id, user?.lastSeen]);

  const openAvatarPicker = () => {
    if (!showEditBadge) return;
    playNavigationSound();
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Choose an image file only.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Изображение должно быть размером максимум 5МБ.");
      event.target.value = "";
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/auth/upload-avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data?.message ?? "Не удалось открыть изорражение.");
        return;
      }

      setAvatarUrl(data.user?.avatarUrl ?? null);
    } catch {
      alert("Не удалось открыть изорражение.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSettingsAction = async () => {
    if (!settingsConfirmAction) return;

    const targetUrl =
      settingsConfirmAction.action === "logout"
        ? "/api/auth/logout"
        : "/api/auth/delete-account";

    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data?.message ?? "Request failed.");
        return;
      }

      setSettingsConfirmAction(null);
      router.push("/");
      router.refresh();
    } catch {
      alert("Request failed.");
    }
  };

  useEffect(() => {
    if (!settingsMenu) return;

    const closeMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target?.closest('.menu-item')) return;
      setSettingsMenu(null);
    };

    document.addEventListener("mousedown", closeMenu);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
    };
  }, [settingsMenu]);

  useEffect(() => {
    if (!settingsMenu || !settingsMenuRef.current || !headerRef.current) return;

    const menu = settingsMenuRef.current;
    const wrapperRect = headerRef.current.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gap = 6;

    let nextX = settingsMenu.x;
    let nextY = settingsMenu.y;

    if (nextX + menuRect.width > wrapperRect.width - gap) {
      nextX = Math.max(gap, settingsMenu.x - menuRect.width);
    }

    if (nextY + menuRect.height > wrapperRect.height - gap) {
      nextY = Math.max(gap, settingsMenu.y - menuRect.height);
    }

    if (
      nextX !== settingsMenu.x ||
      nextY !== settingsMenu.y ||
      !settingsMenu.isPositioned
    ) {
      setSettingsMenu((current) =>
        current
          ? { ...current, x: nextX, y: nextY, isPositioned: true }
          : current
      );
    }
  }, [settingsMenu]);

  return (
    <div className={styles["NXKOuser-personal-info-section"]} ref={headerRef}>
      <audio ref={navigationStartRef} src="/audio/navigation_start.wav" preload="auto" />
      { showEditBadge && (
      <img
        src="/images/CP051.ico"
        className={styles['settings']}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (settingsMenu) {
            setSettingsMenu(null);
            return;
          }
          const wrapperRect = headerRef.current?.getBoundingClientRect();
          const x = wrapperRect ? event.clientX - wrapperRect.left : event.clientX;
          const y = wrapperRect ? event.clientY - wrapperRect.top : event.clientY;
          setSettingsMenu({x, y, isPositioned: false});
        }}
      />)}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleAvatarChange}
      />
      <div
        className="userpic-wrapper"
        onClick={openAvatarPicker}
        title={showEditBadge ? "Выбрать аватарку" : ''}
        style={{ cursor: showEditBadge ? "pointer" : "default", flexShrink: 0 }}
      >
        <Image
          width={50}
          height={50}
          src={avatarUrl || "/images/defaultpfp_grey.jpg"}
          alt="User"
          className="userpic"
          id="NXKOuser-userpic"/>
        <span className="online-status-circle" style={{ display: isOnline ? 'block' : 'none'}}></span>
      </div>

      <div className={styles["NXKOuser-userinfo"]}>
        <div className={styles["username-edit-row"]}>
          <div className={styles["NXKOuser-username"]}>{user.nickname || "user1800325200"}</div>
          {showEditBadge && (
            <img
              src="/images/edit_profile.png"
              className={styles["username-edit-badge"]}
              onClick={() => openEditProfile(user)}
              title="Редактировать профиль"
            />
          )}
        </div>
        <div className={styles["NXKOuser-username-id"]}>@{user.username}</div>
        <div className={isOnline ? styles["online-status"] : `${styles["online-status"]} ${styles["inactive"]}`}>
          {isOnline ? "Онлайн" : `Был(а) ${lastSeen ? formatLastSeen(lastSeen) : "недавно"}`}
        </div>
      </div>
      {settingsMenu && (
        <div
          ref={settingsMenuRef}
          className='menu'
          style={{
            left: settingsMenu.x,
            top: settingsMenu.y,
            visibility: settingsMenu.isPositioned ? "visible" : "hidden",
            transform: 'translate(-2px, -4px)'
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button" className="menu-item"
            onClick={() => {
              setSettingsMenu(null);
              setSettingsConfirmAction({ action: "logout", label: "Выйти из этого аккаунта" });
            }}
          >
            Выйти из аккаунта
          </button>
          <button
            type="button" className="menu-item" style= {{ color: 'red'}}
            onClick={() => {
              setSettingsMenu(null);
              setSettingsConfirmAction({ action: "delete", label: "Все данные вашего аккаунта будут безвозвратно потеряны :(" });
            }}
          >
            Удалить аккаунт
          </button>
        </div>
      )}
      {typeof document !== "undefined" && settingsConfirmAction &&
        createPortal(
          <div className="delete-dialog-backdrop" onClick={() => setSettingsConfirmAction(null)}>
            <div className="delete-dialog-frame" onClick={(event) => event.stopPropagation()}>
              <div className="delete-dialog">
                <div className="delete-dialog-actions">
                  <div className="delete-dialog-confirm-text">
                    <span className="delete-dialog-confirm-title">Вы уверены?</span>
                    <span className="delete-dialog-confirm-subtitle">
                      {settingsConfirmAction.label}
                    </span>
                  </div>
                  <button type="button" className="delete-option" onClick={() => { playNavigationSound(); setSettingsConfirmAction(null); }}>
                    <span className="delete-option-glare"></span>
                    Отмена
                  </button>
                  <button type="button" className="delete-option cancel" onClick={() => { playNavigationSound(); void handleSettingsAction(); }}>
                    <span className="delete-option-glare"></span>
                    {settingsConfirmAction.action === 'delete' ? 'Удалить аккаунт' : 'Выйти'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
