"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ChatList.module.scss";

interface InactiveChatProps{
  children:React.ReactNode;
  onClick?:()=>void;
  onContextMenu?:(event: React.MouseEvent<HTMLButtonElement>) => void;
  contentClassName?: string;
}

export default function InactiveChat({ children, onClick, onContextMenu, contentClassName }: InactiveChatProps) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const chat = ref.current;
      const container = chat?.parentElement;
      if (!chat || !container) return;

      const chatRect = chat.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const chatHeight = chatRect.height;

      const topOverflow = Math.max(containerRect.top - chatRect.top, 0);
      const bottomOverflow = Math.max(chatRect.bottom - containerRect.bottom, 0);

      const overflowPercent = Math.min(
        Math.max(topOverflow, bottomOverflow) / chatHeight,
        1
      );

      const scaleWidth = 1 - 0.2 * overflowPercent;
      setScale(scaleWidth);
    };

    const container = ref.current?.parentElement;
    container?.addEventListener("scroll", update);
    window.addEventListener("resize", update);

    update();

    return () => {
      container?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      className={styles["inactive-chat"]}
      style={{ ["--scale-width" as any]: scale }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className={styles["inactive-chat-glare"]}></div>
      <div className={`${styles["inactive-chat-content-wrapper"]} ${contentClassName ? ` ${contentClassName}` : ""}`}>{children}</div>
    </button>
  );
}
