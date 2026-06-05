import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import Image from 'next/image';
import styles from './ActiveChat.module.scss';
import { User } from '@/types/User';
import { Message } from '@/types/Message';
import { getSocket } from '@/lib/socket/socket';
import { WS_EVENTS } from '@/lib/socket/events';
import { formatLastSeen, formatTime } from '@/lib/utils';
import { useProfileModal } from '@/app/_providers/ProfileModalContext';

type Props = { user: User | null; };

type MessageActionMenu = {
  messageId: number;
  type: Message['type'];
  x: number;
  y: number;
} | null;

type DeleteMessageDialog = {
  messageIds: number[];
  type: Message['type'];
} | null;

const SELECTED_BAR_ANIMATION_MS = 500;

type DeleteMessagesScope = 'self' | 'other' | 'all';

type MessageActionKey =
  | 'reply'
  | 'edit'
  | 'copy'
  | 'forward'
  | 'pin'
  | 'select'
  | 'delete';

type DynamicMessageAction = {
  key: MessageActionKey;
  label: string;
};

const getMessageActions = (type: Message['type']): DynamicMessageAction[] => {
  const actions: DynamicMessageAction[] = [
    { key: 'reply', label: 'Ответить' },
    { key: 'copy', label: 'Копировать' },
    { key: 'forward', label: 'Переслать' },
    { key: 'pin', label: 'Закрепить' },
    { key: 'select', label: 'Выбрать' },
    { key: 'delete', label: 'Удалить' },
  ];

  if (type === 'sent') {
    actions.splice(1, 0, { key: 'edit', label: 'Редактировать' });
  }

  return actions;
};

const recalculateMessageLastFlags = (items: Message[]) =>
  items.map((message, index, arr) => ({
    ...message,
    last: index === arr.length - 1 || arr[index + 1]?.type !== message.type,
  }));

const isEditableElement = (element: Element | null) => {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;

  const tagName = element.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  );
};

const hasSelectedPageText = () => {
  const selection = window.getSelection();
  if (!selection) return false;

  return !selection.isCollapsed && selection.toString().trim().length > 0;
};

const buildSelectedMessagesText = (items: Message[], messageIds: Set<number>) => {
  const selectedMessages = items.filter((message) => messageIds.has(message.id));
  if (!selectedMessages.length) return '';

  return selectedMessages.reduce((result, message, index) => {
    const separator =
      index === 0
        ? ''
        : selectedMessages[index - 1].type === message.type
        ? '\n'
        : '\n\n';

    return `${result}${separator}${message.content}`;
  }, '');
};

const getDeleteDialogActions = (type: Message['type']) =>
  type === 'sent'
    ? [
        { label: 'Удалить у себя', scope: 'self' as const },
        { label: 'Удалить у собеседника', scope: 'other' as const },
        { label: 'Удалить у всех', scope: 'all' as const },
      ]
    : [
        { label: 'Удалить у себя', scope: 'self' as const },
        { label: 'Удалить у всех', scope: 'all' as const },
      ];

export default function ActiveChat({ user }: Props) {
  const { openProfile } = useProfileModal();
  const [footerHeight, setFooterHeight] = useState(5);
  const [isSelectedBarVisible, setIsSelectedBarVisible] = useState(false);
  const [isSelectedBarClosing, setIsSelectedBarClosing] = useState(false);
  const [selectedBarCount, setSelectedBarCount] = useState(0);
  const [isCopyNoticeVisible, setIsCopyNoticeVisible] = useState(false);
  const [replyPreview, setReplyPreview] = useState<Message['replyToMessageId']>(null);

  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const chatFooterRef = useRef<HTMLDivElement | null>(null);
  const messageActionMenuRef = useRef<HTMLDivElement | null>(null);
  const isResizing = useRef(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const el = chatBodyRef.current;
    if (!el) return;

    el.scrollTo({
      top: el.scrollHeight, behavior,
    });
  };

  const isAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [messageActionMenu, setMessageActionMenu] = useState<MessageActionMenu>(null);
  const [deleteMessageDialog, setDeleteMessageDialog] = useState<DeleteMessageDialog>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(
    () => new Set()
  );
  const selectedMessageIdsRef = useRef<Set<number>>(new Set());
  const isSelectingMessagesRef = useRef(false);
  const messageClickTimerRef = useRef<number | null>(null);

  const onScroll = () => {
    const el = chatBodyRef.current;
    if (!el) return;
    setMessageActionMenu(null);
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isAtBottomRef.current = isNearBottom;
    setIsAtBottom(isNearBottom);

    if (el.scrollTop < 80) {
      const prevHeight = el.scrollHeight;
      const prevScrollTop = el.scrollTop;

      loadMessages().then((didLoadMessages) => {
        if (!didLoadMessages) return;

        requestAnimationFrame(() => {
          const newHeight = el.scrollHeight;
          const addedHeight = newHeight - prevHeight;

          if (addedHeight > 0) {
            el.scrollTop = prevScrollTop + addedHeight;
          }
        });
      });
    }
  };
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'ns-resize';
    document.addEventListener('mousemove', resizeChat);
    document.addEventListener('mouseup', stopResizing);
  };

  const resizeChat = (event: MouseEvent) => {
    if (!isResizing.current || !chatBodyRef.current || !chatFooterRef.current)
      return;

    const pageHeight = window.innerHeight;
    const newHeight = ((pageHeight - event.clientY) / pageHeight) * 100 - 3;

    if (newHeight > 5 && newHeight < 70) {
      setFooterHeight(newHeight);
    }
  };

  const stopResizing = () => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('mousemove', resizeChat);
    document.removeEventListener('mouseup', stopResizing);
  };

  const openMessageActionMenu = (msg: Message, x: number, y: number) => {
    setMessageActionMenu((current) =>
      current?.messageId === msg.id
        ? null
        : {messageId: msg.id, type: msg.type, x, y}
    );
  };

  const handleMessageActionMenuClick = (
    event: React.MouseEvent<HTMLElement>,
    msg: Message
  ) => {
    event.preventDefault();
    event.stopPropagation();
    openMessageActionMenu(msg, event.clientX, event.clientY);
  };

  const clearSelectedMessages = useCallback(() => {
    setSelectedMessageIds((current) =>
      current.size ? new Set<number>() : current
    );
  }, []);

  useEffect(() => {
    selectedMessageIdsRef.current = selectedMessageIds;
  }, [selectedMessageIds]);

  useEffect(() => {
    if (selectedMessageIds.size > 0) {
      setSelectedBarCount(selectedMessageIds.size);
      setIsSelectedBarVisible(true);
      setIsSelectedBarClosing(false);
      return;
    }

    if (!isSelectedBarVisible) return;

    setIsSelectedBarClosing(true);

    const timer = window.setTimeout(() => {
      setIsSelectedBarVisible(false);
      setIsSelectedBarClosing(false);
    }, SELECTED_BAR_ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [selectedMessageIds, isSelectedBarVisible]);

  const addSelectedMessage = useCallback((messageId: number) => {
    setSelectedMessageIds((current) => {
      if (current.has(messageId)) return current;

      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  }, []);

  const selectMessage = useCallback(
    (msg: Message, event: React.MouseEvent<HTMLDivElement>) => {
      setSelectedMessageIds((current) => {
        if (current.has(msg.id)) {
          const next = new Set(current);
          next.delete(msg.id);
          return next;
        }
        if (event.ctrlKey || event.metaKey) {
          const next = new Set(current);
          next.add(msg.id);
          return next;
        }
        if (current.size > 1) {
          const next = new Set(current);
          next.add(msg.id);
          return next;
        }

        return new Set([msg.id]);
      });
    },
    []
  );

  const openReplyPreview = useCallback((message: Message) => {
    setReplyPreview({
      id: message.id,
      content: message.content,
      senderId: message.type === 'received' ? (user?.id ?? 0) : 0,
      senderUsername:
        message.type === 'received'
          ? (user?.nickname ?? user?.username ?? null)
          : null,
    });
  }, [user?.id, user?.nickname, user?.username]);

  const handleMessageMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    msg: Message
  ) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;

    if (target.closest(`.${styles['vertical-ellipsis']}`)) {
      if (messageClickTimerRef.current) {
        window.clearTimeout(messageClickTimerRef.current);
        messageClickTimerRef.current = null;
      }
      return;
    }

    if (messageClickTimerRef.current) {
      window.clearTimeout(messageClickTimerRef.current);
    }
    const selectedIds = selectedMessageIdsRef.current;

    if (event.detail == 2){
      if (messageClickTimerRef.current) {
        window.clearTimeout(messageClickTimerRef.current);
        messageClickTimerRef.current = null;
      }
      if (selectedIds.size === 1 && selectedIds.has(msg.id)) {
        clearSelectedMessages();
      }
      openReplyPreview(msg);
      return;
    }
    if (selectedIds.size === 0){
      messageClickTimerRef.current = window.setTimeout(() => {
        selectMessage(msg, event);
        messageClickTimerRef.current = null;
      }, 300);
    }
    else selectMessage(msg, event);

    event.preventDefault();
    setMessageActionMenu(null);
    isSelectingMessagesRef.current = true;
  };

  const handleMessageMouseEnter = (
    event: React.MouseEvent<HTMLDivElement>,
    msg: Message
  ) => {
    if (event.buttons !== 1) return;
    if (!isSelectingMessagesRef.current) return;
    addSelectedMessage(msg.id);
  };

  const handleChatBodyMouseDown = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest(`.${styles['message']}`)) return;
    if (target.closest(`.${styles['selected-messages-bar']}`)) return;

    clearSelectedMessages();
  };

  useEffect(() => {
    const stopSelectingMessages = () => {
      isSelectingMessagesRef.current = false;
    };

    const handleSelectionEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        isSelectingMessagesRef.current = false;
        clearSelectedMessages();
        setMessageActionMenu(null);
      }
    };

    document.addEventListener('mouseup', stopSelectingMessages);
    document.addEventListener('keydown', handleSelectionEscape);

    return () => {
      if (messageClickTimerRef.current) {
        window.clearTimeout(messageClickTimerRef.current);
        messageClickTimerRef.current = null;
      }
      document.removeEventListener('mouseup', stopSelectingMessages);
      document.removeEventListener('keydown', handleSelectionEscape);
    };
  }, [clearSelectedMessages]);

  useEffect(() => {
    if (!messageActionMenu) return;

    const closeMenu = () => setMessageActionMenu(null);
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', closeMenuOnEscape);

    return () => {
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('keydown', closeMenuOnEscape);
    };
  }, [messageActionMenu]);

  useLayoutEffect(() => {
    const menu = messageActionMenuRef.current;
    const footer = chatFooterRef.current;
    if (!messageActionMenu || !menu || !footer) return;

    const footerTop = footer.getBoundingClientRect().top;
    const menuBottom = menu.getBoundingClientRect().bottom;
    const overlap = menuBottom - footerTop;

    if (overlap <= 0) return;

    setMessageActionMenu((current) =>
      current
        ? {
            ...current,
            y: Math.max(4, current.y - overlap - 4),
          }
        : current
    );
  }, [messageActionMenu]);

  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const [chatId, setChatId] = useState<number | null>(null);
  const chatIdRef = useRef<number | null>(null);
  const prevChatIdRef = useRef<number | null>(null);
  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    const chatBody = chatBodyRef.current;
    if (chatBody) {
      const isAtBottom =
        chatBody.scrollHeight - chatBody.scrollTop - chatBody.clientHeight <=
        30;

      if (isAtBottom) {
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    }
  }, [footerHeight]);

  const [messages, setMessages] = useState<Message[]>([]);
  const lastMessageIdRef = useRef<number | null>(null);
  const isLoadingMessagesRef = useRef(false);
  const hasMoreMessagesRef = useRef(true);
  const loadGenerationRef = useRef(0);

  const copyMessagesToClipboard = useCallback(async (messageIds: Set<number>) => {
    const text = buildSelectedMessagesText(messages, messageIds);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setIsCopyNoticeVisible(true);
    } catch (error) {
      console.error('Failed to copy messages', error);
    }
  }, [messages]);

  useEffect(() => {
    if (!isCopyNoticeVisible) return;

    const timer = window.setTimeout(() => {
      setIsCopyNoticeVisible(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [isCopyNoticeVisible]);

  useEffect(() => {
    const handleCopySelectedMessages = (event: ClipboardEvent) => {
      if (!selectedMessageIdsRef.current.size) return;
      if (isEditableElement(document.activeElement)) return;
      if (hasSelectedPageText()) return;

      const text = buildSelectedMessagesText(
        messages,
        new Set(selectedMessageIdsRef.current)
      );
      if (!text) return;

      event.preventDefault();
      event.clipboardData?.setData('text/plain', text);
      setIsCopyNoticeVisible(true);
    };

    document.addEventListener('copy', handleCopySelectedMessages);

    return () => {
      document.removeEventListener('copy', handleCopySelectedMessages);
    };
  }, [messages]);

  const removeMessagesFromState = useCallback((messageIds: number[]) => {
    const deletedIds = new Set(messageIds);

    setMessages((current) => {
      const next = recalculateMessageLastFlags(
        current.filter((message) => !deletedIds.has(message.id))
      );

      lastMessageIdRef.current = next.length ? next[0].id : null;
      return next;
    });

    setSelectedMessageIds((current) => {
      if (!current.size) return current;

      const next = new Set(
        Array.from(current).filter((messageId) => !deletedIds.has(messageId))
      );

      return next.size === current.size ? current : next;
    });

    setReplyPreview((current) =>
      current && deletedIds.has(current.id) ? null : current
    );
    setMessageActionMenu((current) =>
      current && deletedIds.has(current.messageId) ? null : current
    );
  }, []);

  const deleteMessages = useCallback(
    async (messageIds: number[], scope: DeleteMessagesScope) => {
      const s = socketRef.current ?? getSocket();
      socketRef.current = s;

      if (!s.connected) {
        s.connect();
      }

      const activeChatId = chatIdRef.current;
      if (!activeChatId) return false;

      const ids = Array.from(
        new Set(messageIds.map((messageId) => Number(messageId)))
      ).filter(Number.isFinite);

      if (!ids.length) return false;

      try {
        const response = await s.emitWithAck(WS_EVENTS.CHAT_MESSAGE_DELETE, {
          chatId: activeChatId,
          messageIds: ids,
          scope,
        });

        if (!response?.ok) {
          console.error('Failed to delete messages', response);
          return false;
        }

        return true;
      } catch (error) {
        console.error('Failed to delete messages', error);
        return false;
      }
    },
    []
  );

  const handleSelectedMessagesDelete = useCallback(() => {
    const selectedIds = Array.from(selectedMessageIdsRef.current);
    if (!selectedIds.length) return;

    const selectedMessages = messages.filter((message) =>
      selectedMessageIdsRef.current.has(message.id)
    );
    const dialogType = selectedMessages.some((message) => message.type !== 'sent')
      ? 'received'
      : 'sent';

    setDeleteMessageDialog({
      messageIds: selectedIds,
      type: dialogType
    });
  }, [messages]);

  const handleDeleteDialogAction = useCallback(
    async (scope: DeleteMessagesScope) => {
      if (!deleteMessageDialog) return;

      await deleteMessages(deleteMessageDialog.messageIds, scope);
      setDeleteMessageDialog(null);
    },
    [deleteMessageDialog, deleteMessages]
  );

  const loadMessages = async () => {
    if (!user || isLoadingMessagesRef.current || !hasMoreMessagesRef.current)
      return false;

    isLoadingMessagesRef.current = true;
    const loadGeneration = loadGenerationRef.current;
    const otherUserId = user.id;

    try {
      const res = await fetch('/api/chats/get-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          otherUserId,
          take: 30,
          lastMessageId: lastMessageIdRef.current,
        }),
      });

      const data = await res.json();
      if (loadGeneration !== loadGenerationRef.current) return false;

      if (!res.ok) {
        console.error(data);
        return false;
      }
      const msgs = data.messages ?? [];
      console.log('Loaded messages:', msgs);
      const mapped = msgs.map((m: any, i: number, arr: any[]) => ({
        id: m.id,
        content: m?.content ?? '',
        type: m?.senderId === user?.id ? 'received' : 'sent',
        last: i === arr.length - 1 || arr[i + 1]?.senderId !== m.senderId,
        isViewed: m.isViewed ?? false,
        isEdited: m.isEdited ?? false,
        isPinned: m.isPinned ?? false,
        viewedAt: m.viewedAt ?? null,
        editedAt: m.editedAt ?? null,
        createdAt: m.createdAt
          ? formatTime(m.createdAt)
          : formatTime(new Date().toISOString()),
        replyToMessageId: m.replyToMessageId
          ? {
              id: m.replyToMessageId.id,
              content: m.replyToMessageId.content ?? '',
              senderId: m.replyToMessageId.senderId,
              senderUsername: m.replyToMessageId.senderUsername ?? null,
            }
          : null,
        forwardedFromMessage: m.forwardedFromMessage
          ? {
              id: m.forwardedFromMessage.id,
              userId: m.forwardedFromMessage.userId,
              username: m.forwardedFromMessage.username ?? null,
              avatarUrl: m.forwardedFromMessage.avatarUrl ?? null,
              content: m.forwardedFromMessage.content ?? '',
              createdAt: m.forwardedFromMessage.createdAt ?? '',
            }
          : null,
      }));
      setMessages((prev) => {
        const existingIds = new Set(prev.map((message) => message.id));
        const nextMessages = mapped.filter(
          (message: Message) => !existingIds.has(message.id)
        );
        return recalculateMessageLastFlags([...nextMessages, ...prev]);
      });

      let cnt = 0;
      const userId = user.id;
      for (const m of msgs) {
        if (m.senderId !== userId) continue;
        if (m.isViewed) continue;
        cnt++;
      }
      setUnreadCount(cnt);
      setChatId(Number(data.chatId) || null);

      if (msgs.length) {
        const oldest = msgs[0];
        lastMessageIdRef.current = oldest.id;
      }

      if (msgs.length < 30) {
        hasMoreMessagesRef.current = false;
      }

      return msgs.length > 0;
    } catch (e) {
      console.error('Failed to load messages', e);
      return false;
    } finally {
      if (loadGeneration === loadGenerationRef.current) {
        isLoadingMessagesRef.current = false;
      }
    }
  };

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setChatId(null);
      prevChatIdRef.current = null;
      loadGenerationRef.current += 1;
      isLoadingMessagesRef.current = false;
      lastMessageIdRef.current = null;
    hasMoreMessagesRef.current = true;
    lastSeenInitializedRef.current = false;
    clearSelectedMessages();
    setReplyPreview(null);
    return;
  }

    setMessages([]);
    setChatId(null);
    loadGenerationRef.current += 1;
    isLoadingMessagesRef.current = false;
    lastMessageIdRef.current = null;
    hasMoreMessagesRef.current = true;
    clearSelectedMessages();
    setReplyPreview(null);

    setLastSeen(user.lastSeen ?? null);
    lastSeenInitializedRef.current = true;
    loadMessages();
  }, [user, clearSelectedMessages]);

  useEffect(() => {
    if (!messages.length) return;
    scrollToBottom('auto');
  }, [messages.length === 0]);

  useEffect(() => {
    if (!user || !chatId) return;

    const s = getSocket();
    socketRef.current = s;
    const join = () => ensureWsJoin();

    if (s.connected) join();
    else s.on('connect', join);

    s.emit(WS_EVENTS.PRESENCE_GET, { userId: user.id }, (res: any) => {
      if (res?.ok) {
        setIsOtherUserOnline(res.online);
      }
    });
    return () => {
      s.off('connect', join);
    };
  }, [user?.id, chatId]);

  const typingTimerRef = useRef<any>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const isTypingRef = useRef(false);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const lastSeenInitializedRef = useRef(false);
  const [, forceMinuteTick] = useState(0);

  useEffect(() => {
    if (isOtherUserOnline) return;
    if (!lastSeen) return;

    const id = setInterval(() => {
      forceMinuteTick((v) => v + 1);
    }, 60_000);

    return () => clearInterval(id);
  }, [isOtherUserOnline, lastSeen]);

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const s = socketRef.current ?? getSocket();

    if (!s.connected) s.connect();

    const onNewMessage = (payload: any) => {
      const chatId = chatIdRef.current;
      if (!chatId) return;
      if (+payload.chatId !== chatId) return;

      const m = payload.message;
      const atBottom = isAtBottomRef.current;
      const isIncoming = m.senderId === user?.id;
      const shouldScroll = atBottom;

      if (isIncoming && !atBottom && !(m.isViewed ?? false)) {
        setUnreadCount((c) => c + 1);
      }

      setMessages((prev) => {
        const updated = [...prev];
        if (updated.length) updated[updated.length - 1].last = false;
        updated.push({
          id: m.id,
          content: m?.content ?? '',
          type: m?.senderId === user?.id ? 'received' : 'sent',
          last: true,
          isViewed: m.isViewed ?? false,
          isEdited: m.isEdited ?? false,
          isPinned: m.isPinned ?? false,
          viewedAt: m.viewedAt ?? null,
          editedAt: m.editedAt ?? null,
          createdAt: m.createdAt
            ? formatTime(m.createdAt)
            : formatTime(new Date().toISOString()),
          replyToMessageId: m.replyToMessageId
            ? {
                id: m.replyToMessageId.id,
                content: m.replyToMessageId.content ?? '',
                senderId: m.replyToMessageId.senderId,
                senderUsername: m.replyToMessageId.senderUsername ?? null,
              }
            : null,
          forwardedFromMessage: m.forwardedFromMessage
            ? {
                id: m.forwardedFromMessage.id,
                userId: m.forwardedFromMessage.userId,
                username: m.forwardedFromMessage.username ?? null,
                avatarUrl: m.forwardedFromMessage.avatarUrl ?? null,
                content: m.forwardedFromMessage.content ?? '',
                createdAt: m.forwardedFromMessage.createdAt ?? '',
            }
          : null,
        });
        return recalculateMessageLastFlags(updated);
      });
      setOtherUserTyping(false);

      if (shouldScroll) {
        requestAnimationFrame(() => {
          scrollToBottom('smooth');
        });
      }
    };

    const onTypingStart = (payload: any) => {
      const chatId = chatIdRef.current;
      if (!chatId) return;
      if (+payload.chatId !== chatId) return;
      if (+payload.userId !== user?.id) return;

      setOtherUserTyping(true);
    };

    const onTypingStop = (payload: any) => {
      const chatId = chatIdRef.current;
      if (!chatId) return;
      if (+payload.chatId !== chatId) return;
      if (+payload.userId !== user?.id) return;

      setOtherUserTyping(false);
    };

    const onPresenceOnline = (payload: any) => {
      if (+payload.userId !== user?.id) return;
      setIsOtherUserOnline(true);
    };

    const onPresenceOffline = (payload: any) => {
      if (+payload.userId !== user?.id) return;
      setIsOtherUserOnline(false);
      setLastSeen(new Date());
    };

    const onMessageViewed = (payload: any) => {
      const ids = new Set<number>(
        (payload?.messageIds ?? []).map((x: any) => +x).filter(Number.isFinite)
      );
      if (!ids.size) return;

      setMessages((prev) =>
        prev.map((m) => (ids.has(m.id) ? { ...m, isViewed: true } : m))
      );
    };

    const onMessagesDeleted = (payload: any) => {
      const activeChatId = chatIdRef.current;
      if (!activeChatId) return;
      if (+payload?.chatId !== activeChatId) return;

      const deletedIds = (payload?.messageIds ?? [])
        .map((value: any) => Number(value))
        .filter(Number.isFinite);

      if (!deletedIds.length) return;
      removeMessagesFromState(deletedIds);
    };

    s.on(WS_EVENTS.MESSAGE_VIEWED, onMessageViewed);
    s.on(WS_EVENTS.CHAT_MESSAGE_NEW, onNewMessage);
    s.on(WS_EVENTS.CHAT_MESSAGE_DELETED, onMessagesDeleted);
    s.on(WS_EVENTS.CHAT_TYPING_START, onTypingStart);
    s.on(WS_EVENTS.CHAT_TYPING_STOP, onTypingStop);
    s.on(WS_EVENTS.PRESENCE_ONLINE, onPresenceOnline);
    s.on(WS_EVENTS.PRESENCE_OFFLINE, onPresenceOffline);

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      s.off(WS_EVENTS.MESSAGE_VIEWED, onMessageViewed);
      s.off(WS_EVENTS.CHAT_MESSAGE_NEW, onNewMessage);
      s.off(WS_EVENTS.CHAT_MESSAGE_DELETED, onMessagesDeleted);
      s.off(WS_EVENTS.CHAT_TYPING_START, onTypingStart);
      s.off(WS_EVENTS.CHAT_TYPING_STOP, onTypingStop);
      s.off(WS_EVENTS.PRESENCE_ONLINE, onPresenceOnline);
      s.off(WS_EVENTS.PRESENCE_OFFLINE, onPresenceOffline);
    };
  }, [removeMessagesFromState, user]);

  const emitTyping = (text: string) => {
    const s = socketRef.current ?? getSocket();
    socketRef.current = s;
    if (!s.connected) {
      s.connect();
    }

    const chatId = chatIdRef.current;

    if (!chatId) {
      return;
    }

    if (!text.trim()) {
      if (isTypingRef.current) {
        s.emit(WS_EVENTS.CHAT_TYPING_STOP, { chatId });
        isTypingRef.current = false;
      }
      clearTimeout(typingTimerRef.current);
      return;
    }

    if (!isTypingRef.current) {
      s.emit(WS_EVENTS.CHAT_TYPING_START, { chatId });
      isTypingRef.current = true;
    }
    clearTimeout(typingTimerRef.current);

    typingTimerRef.current = setTimeout(() => {
      s.emit(WS_EVENTS.CHAT_TYPING_STOP, { chatId });
      isTypingRef.current = false;
    }, 900);
  };

  const ensureWsJoin = async () => {
    const s = socketRef.current ?? getSocket();
    socketRef.current = s;

    if (!s.connected) s.connect();

    const id = chatIdRef.current;
    if (!id) return;

    const prev = prevChatIdRef.current;

    try {
      if (prev && prev !== id) {
        const ackLeave = await s.emitWithAck(WS_EVENTS.CHAT_LEAVE, {
          chatId: prev,
        });
        if (!ackLeave?.ok) console.warn('leave failed', ackLeave);
      }
      const ackJoin = await s.emitWithAck(WS_EVENTS.CHAT_JOIN, { chatId: id });

      if (!ackJoin?.ok) console.warn('join failed', ackJoin);
      prevChatIdRef.current = id;
    } catch (e) {
      console.error('ensureWsJoin error', e);
    }
  };

  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const isSendingMessageRef = useRef(false);
  const sendMessage = async () => {
    if (!user || isSendingMessageRef.current) return;

    const text = messageInputRef.current?.value.trim();
    if (!text) return;

    isSendingMessageRef.current = true;
    setIsSendingMessage(true);

    try {
      const res = await fetch('/api/chats/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          otherUserId: user.id,
          content: text,
          replyToMessageId: replyPreview?.id ?? null,
          forwardedFromMessageId: null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error(data);
        return;
      }

      if (messageInputRef.current) messageInputRef.current.value = '';
      setReplyPreview(null);
    } catch (e) {
      console.error('Failed to send message', e);
    } finally {
      isSendingMessageRef.current = false;
      setIsSendingMessage(false);
    }
  };
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  const pendingViewIdsRef = useRef<Set<number>>(new Set());
  const flushTimerRef = useRef<any>(null);
  const seenOnceRef = useRef<Set<number>>(new Set());
  const ioRef = useRef<IntersectionObserver | null>(null);
  const elementToMsgIdRef = useRef(new Map<Element, number>());

  const flushViews = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;

    const ids = Array.from(pendingViewIdsRef.current);
    if (!ids.length) return;

    pendingViewIdsRef.current.clear();
    s.emit(WS_EVENTS.MESSAGE_VIEW, { messageIds: ids });
  }, []);

  const queueView = useCallback(
    (messageId: number) => {
      pendingViewIdsRef.current.add(messageId);

      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flushViews();
      }, 200);
    },
    [flushViews]
  );

  useEffect(() => {
    ioRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = elementToMsgIdRef.current.get(e.target);
          if (!id) continue;

          if (seenOnceRef.current.has(id)) {
            ioRef.current?.unobserve(e.target);
            elementToMsgIdRef.current.delete(e.target);
            continue;
          }
          seenOnceRef.current.add(id);

          setUnreadCount((prev) => {
            const next = Math.max(0, prev - 1);
            return next;
          });
          queueView(id);

          ioRef.current?.unobserve(e.target);
          elementToMsgIdRef.current.delete(e.target);
        }
      },
      { threshold: 0.8 }
    );

    return () => {
      ioRef.current?.disconnect();
      ioRef.current = null;
      elementToMsgIdRef.current.clear();
    };
  }, [queueView]);

  const observeIncomingMessage = useCallback(
    (el: HTMLElement | null, msg: any) => {
      if (!el) return;
      if (msg.type !== 'received') return;
      if (msg.isViewed) return;
      if (seenOnceRef.current.has(msg.id)) return;

      const io = ioRef.current;
      if (!io) return;
      if (elementToMsgIdRef.current.get(el) === msg.id) return;

      elementToMsgIdRef.current.set(el, msg.id);
      io.observe(el);
    },
    []
  );

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (isSendingMessageRef.current) return;
      sendMessage();
      emitTyping('');
    }
  };

  if (!user) {
    return (
      <div className={styles['active-chat-empty']}>
        <p style={{ color: '#ccc', textAlign: 'center', marginTop: '20%' }}>
          Выберите пользователя, чтобы начать чат
        </p>
      </div>
    );
  }
  return (
    <>
      {/* HEADER */}
      <div className={styles['active-chat-header']}>
        <div className={styles['header-info-part']}>
          <Image
            src="/images/defaultpfp_1.jpg"
            alt="User"
            width={40}
            height={40}
            className={styles['active-chat-userpic']}
            onClick={() => user && openProfile(user)}
          />
          <div style={{ display: 'flex', flexDirection: 'column'}}>
            <span className="aero-title in-active-chat" onClick={() => user && openProfile(user)}>
              <span className="username">{user.nickname}</span>
            </span>
            <span
              className="aero-title in-active-chat"
              style={{
                marginTop: '3px',
                fontSize: '10px',
                color: otherUserTyping
                  ? 'var(--window-border-color)'
                  : isOtherUserOnline
                  ? '#009416ff'
                  : '#727f93ff',
              }}
            >
              {otherUserTyping ? (
                <>Печатает<span className="typing-dots"></span></>
              ) : isOtherUserOnline ? (
                'В сети'
              ) : (
                `Был(а) ${lastSeen ? formatLastSeen(lastSeen) : ''}`
              )}
            </span>
          </div>
        </div>

        <div className={styles['header-control-buttons']}>
          <button
            className={`${styles['aero-buttons-blue']} ${styles['aero-button-minimize']}`}
          />
          <button
            className={`${styles['aero-buttons-blue']} ${styles['aero-button-maximize']}`}
          />
          <button className={styles['aero-button-close']} />
        </div>
      </div>

      {/* CHAT BODY */}
      <div
        className={styles['active-chat-body']}
        ref={chatBodyRef}
        onScroll={onScroll}
        onMouseDown={handleChatBodyMouseDown}
      >
        <div className={styles['active-chat-messages']}>
          {messages.map((msg, index) => (
            <div key={index} className={`${styles['each-message-container']} ${ msg.type === 'sent' ? styles['sent-c'] : styles['received-c']}`}>
            {selectedMessageIds.has(msg.id) && (
              <div
                className={styles['selected-message-sign']}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedMessageIds((current) => {
                    const next = new Set(current);
                    next.delete(msg.id);
                    return next;
                  });
                }}
              ></div>
            )}
              <div
                className={`${styles['message']} ${styles[msg.type]} ${
                  msg.last ? styles['last'] : ''
                } ${
                  selectedMessageIds.has(msg.id) ? styles['selected'] : ''
                }`}
                ref={(el) => observeIncomingMessage(el, msg)}
                aria-selected={selectedMessageIds.has(msg.id)}
                onMouseDown={(event) => handleMessageMouseDown(event, msg)}
                onMouseEnter={(event) => handleMessageMouseEnter(event, msg)}
                onContextMenu={(event) => handleMessageActionMenuClick(event, msg)}
              >
                <div className={styles['message-glare']}></div>
                {msg.replyToMessageId && (
                  <div className={styles['message-reply-preview']}>
                    <span className={styles['message-reply-line']}></span>
                    <div className={styles['message-reply-body']}>
                      <span className={styles['message-reply-author']}>
                        {msg.replyToMessageId.senderUsername ?? 'Reply'}
                      </span>
                      <span className={styles['message-reply-content']}>
                        {msg.replyToMessageId.content}
                      </span>
                    </div>
                  </div>
                )}
                <p className={`${styles['message-text']} ${
                    msg.replyToMessageId ? styles['with-reply'] : ''
                  }`}>
                  {msg.content}
                </p>
                <div className={`${styles['message-info']} ${styles[msg.type]}`}>
                  <span
                    className={styles['vertical-ellipsis']}
                    role="button"
                    tabIndex={0}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => handleMessageActionMenuClick(event, msg)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      event.stopPropagation();

                      const rect = event.currentTarget.getBoundingClientRect();
                      const x = msg.type === 'sent' ? rect.left : rect.right;
                      openMessageActionMenu(msg, x, rect.top);
                    }}
                  >
                    &#8942;
                  </span>
                  <div className={`${styles['message-info-main']} ${styles[msg.type]}`}>
                    <span className={(msg.isViewed || msg.type === 'received') ? '' : styles['message-unseen']}/>
                    <div className={styles['message-info-side-part']}>
                      <span className={`${styles['message-time-sent']} ${styles[msg.type]}`}>
                        {msg.createdAt}
                      </span>
                      <span className={`${styles['message-time-sent']}`}>
                        (Изм.)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!isAtBottom && unreadCount > 0 && (
            <span className={styles['unseen-messages']}>
              <span>{unreadCount > 99 ? '99+' : unreadCount}</span>
            </span>
          )}
        </div>
        {isSelectedBarVisible && (
          <div
            className={`${styles['selected-messages-bar']} ${
              isSelectedBarClosing
                ? styles['selected-messages-bar-closing']
                : styles['selected-messages-bar-opening']
            }`}
          >
            <span className={styles['selected-messages-count']}>
              {selectedBarCount}
            </span>
            <div className={styles['selected-messages-actions']}>
              <span
                className={`${styles['selected-messages-bar-btn']} ${styles['delete']}`}
                onClick={() => void handleSelectedMessagesDelete()}
                title='Удалить'
              ></span>
              <span className={`${styles['selected-messages-bar-btn']} ${styles['forward']}`} title='Переслать'></span>
              <span
                className={`${styles['selected-messages-bar-btn']} ${styles['copy']}`}
                onClick={() => copyMessagesToClipboard(selectedMessageIds)}
                title='Копировать'
              ></span>
            </div>
            <span className={`${styles['selected-messages-bar-btn']} ${styles['cancel']}`} onClick={clearSelectedMessages} title='Закрыть'></span>
            <span className={styles['aero-text']}>Выбрано</span>
          </div>
        )}
        {isCopyNoticeVisible && (
          <div className={styles['copy-notice']}>
            <span
              className={styles['copy-notice-sign']}
            ></span>
            <span className={styles['copy-notice-text']}>Скопировано!</span>
          </div>
        )}
        {replyPreview && (
          <div className={styles['reply-preview']}>
            <div className={styles['reply-preview-accent']}>
              <span className={styles['reply-preview-icon']}></span>
            </div>
            <div className={styles['reply-preview-content']}>
              <span className={styles['reply-preview-label']}>
                В ответ {replyPreview.senderUsername ? `пользователю ${replyPreview.senderUsername}:` : 'на свое сообщение:'}
              </span>
              <span className={styles['reply-preview-text']}>
                {replyPreview.content}
              </span>
            </div>
            <button type="button" className={styles['reply-preview-close']} onClick={() => setReplyPreview(null)}/>
          </div>
        )}
      </div>

      {messageActionMenu && (
        <div
          ref={messageActionMenuRef}
          className={`${styles['message-action-menu']} ${
            styles[messageActionMenu.type]
          }`}
          style={{
            left: messageActionMenu.x,
            top: messageActionMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {getMessageActions(messageActionMenu.type).map(
            ({ key, label }) => (
              <button
                key={key}
                type="button"
                className={styles['message-action-menu-item']}
                onClick={async () => {
                  const targetMessage = messages.find(
                    (message) => message.id === messageActionMenu.messageId
                  );

                  if (key === 'reply' && targetMessage) openReplyPreview(targetMessage);
                  if (key === 'copy') await copyMessagesToClipboard(new Set([messageActionMenu.messageId]));
                  if (key === 'select') {
                    setSelectedMessageIds((current) => {
                      const next = new Set(current);
                      if (next.has(messageActionMenu.messageId)) {
                        next.delete(messageActionMenu.messageId);
                        return next;
                      }
                      next.add(messageActionMenu.messageId);
                      return next;
                    });
                  }
                  if (key === 'delete') {
                    setDeleteMessageDialog({
                      messageIds: [messageActionMenu.messageId],
                      type: messageActionMenu.type
                    });
                  }
                  setMessageActionMenu(null);
                }}
              >
                {key === 'select'
                  ? selectedMessageIds.has(messageActionMenu.messageId)
                    ? 'Снять выбор'
                    : 'Выбрать'
                  : label}
              </button>
            )
          )}
        </div>
      )}

      {deleteMessageDialog && (
        <div
          className={styles['delete-message-dialog-backdrop']}
          onClick={() => setDeleteMessageDialog(null)}
        >
          <div
            className={styles['delete-message-dialog']}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles['delete-message-dialog-actions']}>
              {getDeleteDialogActions(deleteMessageDialog.type).map(
                ({ label, scope }) => (
                <button
                  key={label}
                  type="button"
                  className={styles['delete-message-option']}
                  onClick={() => void handleDeleteDialogAction(scope)}
                >
                  <span className={styles['delete-message-option-glare']}></span>
                  <span className={styles['delete-message-option-content']}>
                    <span className={styles['delete-message-option-label']}>
                      {label}
                    </span>
                    </span>
                </button>
                )
              )}
            </div>
            <button
              type="button"
              className={`${styles['delete-message-option']} ${styles['delete-message-option-cancel']}`}
              onClick={() => setDeleteMessageDialog(null)}
            >
              <span className={styles['delete-message-option-glare']}></span>
              <span className={styles['delete-message-option-content']}>
                <span className={styles['delete-message-option-label']}>
                  Отмена
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* RESIZER */}
      <div
        className={styles['resizer-horizontal']}
        onMouseDown={handleMouseDown}
        style={{
          marginTop: `calc(${100 - footerHeight}vh - 30px)`,
        }}
      ></div>

      {/* FOOTER */}
      <div
        className={styles['active-chat-footer']}
        ref={chatFooterRef}
        style={{ height: `${footerHeight}%` }}
      >
        <div className={styles['footer-glare']}></div>

        <textarea
          className="retro-input"
          placeholder="Введите сообщение..."
          rows={2}
          ref={messageInputRef}
          onKeyDown={handleKeyPress}
          onChange={(e) => {
            emitTyping(e.target.value);
          }}
          style={{ width: `40%` }}
        ></textarea>

        <button
          id="send-message-btn"
          disabled={isSendingMessage}
          style={{
            background: `url(/images/AeroCircle01.png) no-repeat center/contain`,
            width: '37px',
            height: '37px',
            opacity: isSendingMessage ? 0.6 : 1,
            cursor: isSendingMessage ? 'default' : 'pointer',
          }}
          onClick={() => {
            sendMessage();
            emitTyping('');
          }}
        ></button>
      </div>
    </>
  );
}
