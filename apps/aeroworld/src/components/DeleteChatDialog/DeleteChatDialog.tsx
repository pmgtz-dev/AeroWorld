"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { announceLocalChatDeleted, deleteChatRequest, DeleteChatScope } from "@/lib/chat/deleteChat";

type Props = {
  chatId: number;
  otherUserId: number | null;
  onClose: () => void;
  onDeleted?: (scope: DeleteChatScope) => void;
};

const getDeleteChatActions = () => [
  { label: "Удалить у себя", scope: "self" as const },
  { label: "Удалить у двоих", scope: "all" as const },
  { label: "Удалить только у собеседника", scope: "other" as const },
];

export default function DeleteChatDialog({
  chatId,
  otherUserId,
  onClose,
  onDeleted,
}: Props) {
  const navigationStartRef = useRef<HTMLAudioElement | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    scope: DeleteChatScope;
    label: string;
  } | null>(null);
  const playNavigationSound = () => {
    const navigationStart = navigationStartRef.current;
    if (!navigationStart) return;
    navigationStart.currentTime = 0;
    void navigationStart.play().catch(() => {});
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="delete-dialog-backdrop" onClick={onClose}>
      <div className="delete-dialog-frame" onClick={(event) => event.stopPropagation()}>
        <div className="delete-dialog">
          <audio ref={navigationStartRef} src="/audio/navigation_start.wav" preload="auto" />
          <div className="delete-dialog-actions">
            {confirmAction ? (
              <>
                <div className="delete-dialog-confirm-text">
                  <span className="delete-dialog-confirm-title">Вы уверены?</span>
                  <span className="delete-dialog-confirm-subtitle">
                    {confirmAction.label}
                  </span>
                </div>
                <button type="button" className="delete-option" onClick={() => { playNavigationSound(); onClose(); }}>
                  <span className="delete-option-glare"></span>
                  Отмена
                </button>
                <button type="button" className="delete-option cancel"
                  onClick={async () => {
                    playNavigationSound();
                    try {
                      await deleteChatRequest(chatId, confirmAction.scope);
                      if (confirmAction.scope !== "other") {
                        announceLocalChatDeleted({
                          chatId,
                          scope: confirmAction.scope,
                          otherUserId,
                        });
                      }
                      onDeleted?.(confirmAction.scope);
                      onClose();
                    } catch (error) {
                      console.error("Failed to delete chat", error);
                    }
                  }}
                >
                  <span className="delete-option-glare"></span>
                  Удалить
                </button>
              </>
            ) : (
              <>
              {getDeleteChatActions().map(({ label, scope }) => (
                <button
                  key={label} type="button" className="delete-option"
                  onClick={() => { playNavigationSound(); setConfirmAction({ scope, label }); }}
                >
                  <span className="delete-option-glare"></span>
                  {label}
                </button>
              ))}
              <button type="button" className="delete-option cancel"onClick={() => { playNavigationSound(); onClose(); }}>
                <span className="delete-option-glare"></span>
                Отмена
              </button>
            </>
            )}

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
