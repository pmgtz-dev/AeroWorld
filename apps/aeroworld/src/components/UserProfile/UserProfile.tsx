"use client";

import { useProfileModal } from "@/app/_providers/ProfileModalContext";
import styles from "./UserProfile.module.scss";
import PersonalInfoHeader from "../PersonalInfoHeader/PersonalInfoHeader";
import { useEffect, useRef, useState } from "react";
import { useActiveChat } from "@/app/_providers/ActiveChatContext";
import DeleteChatDialog from "../DeleteChatDialog/DeleteChatDialog";
import { DeleteChatScope } from "@/lib/chat/deleteChat";
import { User } from "@/types/User";
import { getNextWindowZIndex } from "@/lib/windowZIndex";

interface UserProfileProps {
  previewUser?: User | null;
  previewOpen?: boolean;
  onPreviewClose?: () => void;
  previewZIndex?: number;
  initialPosition?: { x: number; y: number };
}

export default function UserProfile({
  previewUser,
  previewOpen,
  onPreviewClose,
  previewZIndex,
  initialPosition,
}: UserProfileProps = {}) {

  const [size, setSize] = useState({ width: 30, height: 80 });

  const [position, setPosition] = useState(initialPosition ?? { x: 80, y: 110 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zIndex, setZIndex] = useState(previewZIndex ?? getNextWindowZIndex());
  const [isMinimizing, setIsMinimizing] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const navigationStartRef = useRef<HTMLAudioElement | null>(null);

  const { isOpen, user: modalUser, closeProfile } = useProfileModal();
  const { setActiveUser } = useActiveChat();
  const [deleteChatDialog, setDeleteChatDialog] = useState<{
    chatId: number;
    otherUserId: number | null;
  } | null>(null);
  const isControlledPreview = previewOpen !== undefined;
  const user = previewUser ?? modalUser;
  const isVisible = isControlledPreview ? Boolean(previewOpen) : isOpen;
  const closeCurrentProfile = onPreviewClose ?? closeProfile;
  const isPreviewMode = !!previewUser;

  useEffect(() => {
    if (!initialPosition) return;
    setPosition(initialPosition);
  }, [initialPosition]);

  useEffect(() => {
    if (!isVisible || !user) return;
    setZIndex(previewZIndex ?? getNextWindowZIndex());
    setIsMinimizing(false);
  }, [isVisible, user?.id, previewZIndex]);

  useEffect(() => {
    if (previewZIndex === undefined) return;
    setZIndex(previewZIndex);
  }, [previewZIndex]);

  const openDeleteChatDialog = async () => {
    if (!user) return;

    try {
      const res = await fetch("/api/chats/get-chats", {
        method: "GET",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("Failed to load chats", data);
        return;
      }

      const existingChat = (data.chats ?? []).find(
        (chat: any) => Number(chat.otherUser?.id) === Number(user.id)
      );

      if (!existingChat?.chat?.id) {
        return;
      }

      setDeleteChatDialog({
        chatId: Number(existingChat.chat.id),
        otherUserId: user.id,
      });
    } catch (error) {
      console.error("Failed to open delete chat dialog", error);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    setPosition({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = "none";
    setZIndex(getNextWindowZIndex());
    setDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseUp = () => {
    document.body.style.userSelect = "";
    setDragging(false);
  };

  const handleMinimize = () => {
    if (!frameRef.current) {
      closeCurrentProfile();
      return;
    }
    document.body.style.userSelect = "";
    setDragging(false);
    setIsMinimizing(true);
    window.setTimeout(() => {
      setIsMinimizing(false);
      closeCurrentProfile();
    }, 280);
  };
  const playNavigationSound = () => {
    const navigationStart = navigationStartRef.current;
    if (!navigationStart) return;
    navigationStart.currentTime = 0;
    void navigationStart.play().catch(() => {});
  };

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  });

  if (!isVisible || !user) return null;

  const bioText = user.bio?.trim() ? user.bio : "Не указано";
  const likeStuffText = user.likeStuff?.trim() ? user.likeStuff : "Не указано";
  const dislikeStuffText = user.dislikeStuff?.trim() ? user.dislikeStuff : "Не указано";

  const birthDateText = user.dateOfBirth
    ? (() => {
        const birthDate = new Date(user.dateOfBirth);
        if (Number.isNaN(birthDate.getTime())) return "Не указано";
        const today = new Date();
        const sixYearsAgo = new Date(today);
        sixYearsAgo.setFullYear(today.getFullYear() - 6);
        return user.showYearOfBirth && birthDate.getTime() <= sixYearsAgo.getTime()
          ? birthDate.toLocaleDateString("ru-RU")
          : birthDate.toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
            });
      })()
    : "Не указано";

  const formattedBirthDateText = user.dateOfBirth
    ? (() => {
        const birthDate = new Date(user.dateOfBirth);
        if (Number.isNaN(birthDate.getTime())) return birthDateText;

        const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();

        if (
          today.getMonth() < birthDate.getMonth() ||
          (today.getMonth() === birthDate.getMonth() &&
            today.getDate() < birthDate.getDate())
        ) {
          age -= 1;
        }

        const baseText = `${birthDate.getDate()} ${months[birthDate.getMonth()]}`;
        if (!user.showYearOfBirth) return baseText;

        const lastTwoDigits = age % 100;
        const lastDigit = age % 10;
        const ageLabel =
          lastTwoDigits >= 11 && lastTwoDigits <= 14
            ? "лет"
            : lastDigit === 1
              ? "год"
              : lastDigit >= 2 && lastDigit <= 4
                ? "года"
                : "лет";

        return `${baseText}, ${birthDate.getFullYear()} (${age} ${ageLabel})`;
      })()
    : birthDateText;

  const MIN_W = 25;
  const MAX_W = 50;

  const MIN_H = 50;
  const MAX_H = 100;

  const handleResize = (e: React.MouseEvent<HTMLDivElement>, direction: string) => {
    e.preventDefault();
    e.stopPropagation();

    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const startY = e.clientY;

    const startWidth = size.width;   
    const startHeight = size.height; 

    const startPosX = position.x;
    const startPosY = position.y;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const onMouseMove = (ev: MouseEvent) => {
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startPosX;
      let newY = startPosY;

      if (direction.includes("right")) {
        const deltaVW = (ev.clientX - startX) / viewportW * 100;
        newWidth = startWidth + deltaVW;
      }

      if (direction.includes("left")) {
        const deltaVW = (ev.clientX - startX) / viewportW * 100;
        newWidth = startWidth - deltaVW;
      }

      if (direction.includes("bottom")) {
        const deltaVH = (ev.clientY - startY) / viewportH * 100;
        newHeight = startHeight + deltaVH;
      }

      if (direction.includes("top")) {
        const deltaVH = (ev.clientY - startY) / viewportH * 100;
        newHeight = startHeight - deltaVH;
      }

      newWidth = Math.min(MAX_W, Math.max(MIN_W, newWidth));
      newHeight = Math.min(MAX_H, Math.max(MIN_H, newHeight));

      if (direction.includes("left")) {
        const startWidthPx = (startWidth / 100) * viewportW;
        const newWidthPx = (newWidth / 100) * viewportW;
        const dx = startWidthPx - newWidthPx;      
        newX = startPosX + dx;
      }

      if (direction.includes("top")) {
        const startHeightPx = (startHeight / 100) * viewportH;
        const newHeightPx = (newHeight / 100) * viewportH;
        const dy = startHeightPx - newHeightPx;   
        newY = startPosY + dy;
      }

      if (newX + (newWidth/100)*viewportW > viewportW) {
        newX = viewportW - (newWidth/100)*viewportW;
      }
      if (newX < 0) {
        newX = 0;
      }
      if (newY + (newHeight/100)*viewportH > viewportH) {
        newY = viewportH - (newHeight/100)*viewportH;
      }
      if (newY < 0) {
        newY = 0;
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };
  return (
    <div ref={frameRef} className={`aero-frame more-transparent${isMinimizing ? " window-minimizing" : ""}`} 
          style={{
            zIndex: `${zIndex}`,
            top: `${position.y}px`,
            left: `${position.x}px`,
            width: `${size.width}vw`,
            height: `${size.height}vh`,
            position: `absolute`,
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
            setZIndex(getNextWindowZIndex());
          }}>

      <div className={styles["aero-frame-header"]} onMouseDown={handleMouseDown}>
        <span className="aero-title">@{ user.username }</span>
        <div className="header-control-buttons">
          <button className="aero-buttons-blue aero-button-minimize"  onClick={handleMinimize}/>
          <button className="aero-buttons-blue aero-button-maximize"/>
          <button className="aero-button-close"  onClick={closeCurrentProfile}/>
        </div>
      </div>
      <div
        className={styles["profile-window"]}
        onClick={(e) => e.stopPropagation()}
        style={user.backgroundImageUrl ? {
          backgroundImage: `url(${user.backgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        } : undefined}
      > 
        <audio ref={navigationStartRef} src="/audio/navigation_start.wav" preload="auto" />

        <div className={styles["profile-header"]}>
          <PersonalInfoHeader user={user} />
        </div>

        <div className={styles["interaction-buttons"]}>
            <button className={`delete-option ${styles["auto-width-button"]}`} disabled={isPreviewMode} onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();  
              if (isPreviewMode) return;
              playNavigationSound();
              setActiveUser(user);
            }}>
              <div className='delete-option-glare'></div>
              В чат
            </button>
            <button className={`delete-option cancel ${styles["auto-width-button"]}`} disabled={isPreviewMode} onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isPreviewMode) return;
              playNavigationSound();
              void openDeleteChatDialog();
            }}>
              <div className='delete-option-glare'></div>
              Удалить чат
            </button>
            <button className={`delete-option cancel ${styles["auto-width-button"]}`} disabled={isPreviewMode} onClick={() => {
              if (isPreviewMode) return;
              playNavigationSound();
            }}>
              <div className='delete-option-glare'></div>
              Заблокировать
            </button>
        </div>

        <div className={styles["profile-window-scroll"]} style={user.backgroundImageUrl ? { background: "transparent" } : undefined}>
        <div className={styles["profile-section"]}>
          <div className={styles["about-user-section"]} style={{ paddingTop: 0}}>
            <div className={`${styles["about-user"]} ${styles["birth-date"]}`}>
              <div className={styles["about-user-header"]}>Дата рождения ☺</div>
              <div className={styles["about-user-text"]}>{formattedBirthDateText}</div>
            </div>
            <div className={styles["about-user"]}>
              <div className={styles["about-user-header"]}>Обо мне:</div>
              <div className={styles["about-user-text"]}>{bioText}</div>
            </div>
            <div className={styles["about-user"]}>
              <div className={styles["about-user-header"]}>Вещи, которые я люблю:</div>
                  <div className={styles["about-user-text"]}>{likeStuffText}</div>
            </div>
            <div className={styles["about-user"]}>
              <div className={styles["about-user-header"]}>Вещи, которые я не люблю:</div>
                <div className={styles["about-user-text"]}>{dislikeStuffText}</div>
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className="resize-left" onMouseDown={(e) => handleResize(e as any, "left")}/>
      <div className="resize-right" onMouseDown={(e) => handleResize(e as any, "right")}/>
      <div className="resize-top" onMouseDown={(e) => handleResize(e as any, "top")}/>
      <div className="resize-bottom" onMouseDown={(e) => handleResize(e as any, "bottom")}/>
      <div className="resize-tl" onMouseDown={(e) => handleResize(e as any, "top left")}/>
      <div className="resize-tr" onMouseDown={(e) => handleResize(e as any, "top right")}/>
      <div className="resize-bl" onMouseDown={(e) => handleResize(e as any, "bottom left")}/>
      <div className="resize-br" onMouseDown={(e) => handleResize(e as any, "bottom right")}/>
      {deleteChatDialog && (
        <DeleteChatDialog
          chatId={deleteChatDialog.chatId}
          otherUserId={deleteChatDialog.otherUserId}
          onClose={() => setDeleteChatDialog(null)}
          onDeleted={(scope: DeleteChatScope) => {
            if (scope === "other") return;
            setActiveUser((current) => (current?.id === user.id ? null : current));
          }}
        />
      )}
    </div>
  );
}
