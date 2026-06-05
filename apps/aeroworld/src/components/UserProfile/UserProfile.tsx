"use client";

import { useProfileModal } from "@/app/_providers/ProfileModalContext";
import styles from "./UserProfile.module.scss";
import PersonalInfoHeader from "../PersonalInfoHeader/PersonalInfoHeader";
import { useEffect, useState } from "react";
import { useActiveChat } from "@/app/_providers/ActiveChatContext";

export default function UserProfile() {

  const [size, setSize] = useState({ width: 30, height: 80 });

  const [position, setPosition] = useState({ x: 80, y: 110 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const { isOpen, user, closeProfile } = useProfileModal();
  const { setActiveUser } = useActiveChat();

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    setPosition({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  });

  if (!isOpen || !user) return null;

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
    <div className="aero-frame more-transparent" 
          style={{
            zIndex: `343`,
            top: `${position.y}px`,
            left: `${position.x}px`,
            width: `${size.width}vw`,
            height: `${size.height}vh`,
            position: `absolute`
          }}>

      <div className={styles["aero-frame-header"]} onMouseDown={handleMouseDown}>
        <span className="aero-title">@{ user.username }</span>
        <div className="header-control-buttons">
          <button className="aero-buttons-blue aero-button-minimize"  onClick={closeProfile}/>
          <button className="aero-buttons-blue aero-button-maximize"/>
          <button className="aero-button-close"  onClick={closeProfile}/>
        </div>
      </div>
      <div
        className={styles["profile-window"]}
        onClick={(e) => e.stopPropagation()}
      >

        <div className={styles["profile-header"]}>
          <PersonalInfoHeader user={user} />
        </div>


        <div className={styles["profile-section"]}>
          <div className={styles["interaction-buttons"]}>
            <button>Заблокировать</button>
            <button onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();  
              setActiveUser(user);
            }}>В чат</button>
          </div>

          <div className={styles["about-user-section"]}>
            <div className={styles["about-user"]}>
              <div className={styles["about-user-header"]}>Обо мне:</div>
              <div className={styles["about-user-text"]}>dfsdlkfjdklfj dksfjslkdfj sdfjskdfjlskdf sdlfkjsdkflj sdkfjsdkfjs s ksjdfhjsdhfj</div>
            </div>
            <div className={styles["about-user"]}>
              <div className={styles["about-user-header"]}>Вещи, которые я люблю:</div>
                  <div className={styles["about-user-text"]}>dfsdlkfjdklfj dksfjslkdfj sdfjskdfjlskdf sdlfkjsdkflj sdkfjsdkfjs s ksjdfhjsdhfj</div>
            </div>
            <div className={styles["about-user"]}>
              <div className={styles["about-user-header"]}>Вещи, которые я не люблю:</div>
                <div className={styles["about-user-text"]}>dfsdlkfjdklfj dksfjslkdfj sdfjskdfjlskdf sdlfkjsdkflj sdkfjsdkfjs s ksjdfhjsdhfj</div>
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
    </div>
  );
}
