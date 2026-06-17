import { useRef, useEffect, useState, useCallback } from "react";
import styles from "./ChatList.module.scss";
import InactiveChat from "./InactiveChat";
import DeleteChatDialog from "../DeleteChatDialog/DeleteChatDialog";
import { useProfileModal } from "@/app/_providers/ProfileModalContext";
import { User } from "@/types/User"
import { formatTime } from "@/lib/utils";
import { useActiveChat } from "@/app/_providers/ActiveChatContext";
import { getSocket } from "@/lib/socket/socket";
import { WS_EVENTS } from "@/lib/socket/events";
import {
  LOCAL_CHAT_DELETED_EVENT,
  LocalChatDeletedDetail,
} from "@/lib/chat/deleteChat";

const LATEST_USERS_TRACK_COPIES = 15;
const PINNED_CHATS_STORAGE_KEY = "aeroworld-pinned-chat-ids";

type ChatActionMenu = {
  chatId: number;
  x: number;
  y: number;
  isPositioned: boolean;
  otherUser: User | null;
} | null;

type DeleteChatDialog = {
  chatId: number;
  otherUser: User | null;
} | null;

type ChatLastMessageProps = {
  content: React.ReactNode;
  time: string;
};

const ChatLastMessage = ({ content, time }: ChatLastMessageProps) => {
  const textRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);
  const [allowTimeWrap, setAllowTimeWrap] = useState(false);

  useEffect(() => {
    const textElement = textRef.current;
    const timeElement = timeRef.current;
    if (!textElement || !timeElement) return;

    const updateOverflow = () => {
      timeElement.classList.remove(styles["wrapped"]);
      void timeElement.offsetWidth;

      const oneLineOverflow =
        textElement.scrollHeight > textElement.clientHeight + 1 ||
        textElement.scrollWidth > textElement.clientWidth + 1;

      timeElement.classList.add(styles["wrapped"]);
      void timeElement.offsetWidth;

      const wrappedOverflow =
        textElement.scrollHeight > textElement.clientHeight + 1 ||
        textElement.scrollWidth > textElement.clientWidth + 1;

      setAllowTimeWrap(
        oneLineOverflow && wrappedOverflow
      );

      timeElement.classList.toggle(styles["wrapped"], oneLineOverflow && wrappedOverflow);
    };
    updateOverflow();

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(textElement);
    observer.observe(timeElement);
    window.addEventListener("resize", updateOverflow);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [content]);

  return (
    <div className={styles["inactive-chat-last-message"]}>
      <div ref={textRef} className={styles["inactive-chat-last-message-text"]}>
        {content}
      </div>
      <div
        ref={timeRef}
        className={`${styles["inactive-chat-last-message-sent"]}${allowTimeWrap ? ` ${styles["wrapped"]}` : ""}`}
      >
        {time}
      </div>
    </div>
  );
};

const ChatList: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const chatActionMenuRef = useRef<HTMLDivElement | null>(null);
  const navigationStartRef = useRef<HTMLAudioElement | null>(null);
  const latestUsersRailRef = useRef<HTMLDivElement | null>(null);
  const latestUsersTrackRef = useRef<HTMLDivElement | null>(null);
  const latestUsersRafRef = useRef<number | null>(null);
  const latestUsersDragRef = useRef({
    isDragging: false,
    startX: 0,
    startOffset: 0,
  });
  const latestUsersOffsetRef = useRef(0);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const [hasVerticalScroll, setHasVerticalScroll] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [showChatDeletedNotice, setShowChatDeletedNotice] = useState(false);
  const [chatDeletedNoticeKey, setChatDeletedNoticeKey] = useState(0);
  const [showEmptySearchResult, setShowEmptySearchResult] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState("");
  const [pinnedChatIds, setPinnedChatIds] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const raw = window.localStorage.getItem(PINNED_CHATS_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
    } catch {
      return [];
    }
  });
  const { openProfile } = useProfileModal();
  const { setActiveUser } = useActiveChat();
  const [chatActionMenu, setChatActionMenu] = useState<ChatActionMenu>(null);
  const [deleteChatDialog, setDeleteChatDialog] = useState<DeleteChatDialog>(null);

  const searchfunc = (value: string) => {
    setSearch(value)
  }
  const playNavigationSound = () => {
    const navigationStart = navigationStartRef.current;
    if (!navigationStart) return;
    navigationStart.currentTime = 0;
    void navigationStart.play().catch(() => {});
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    const atTop = el.scrollTop === 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 3;

    setShowTopFade(!atTop);
    setShowBottomFade(!atBottom);
    setHasVerticalScroll(el.scrollHeight > el.clientHeight);
  };

  const [view, setView] = useState('chatlist'); 

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [isLoadingSearchResults, setIsLoadingSearchResults] = useState(false);
  const [latestUsers, setLatestUsers] = useState<User[]>([]);
  const [isLoadingLatestUsers, setIsLoadingLatestUsers] = useState(false);
  const [latestUsersRailWidth, setLatestUsersRailWidth] = useState(0);

  useEffect(() => {
    window.localStorage.setItem(
      PINNED_CHATS_STORAGE_KEY,
      JSON.stringify(pinnedChatIds)
    );
  }, [pinnedChatIds]);

  useEffect(() => {
    if (!showChatDeletedNotice) return;

    const timeout = window.setTimeout(() => {
      setShowChatDeletedNotice(false);
    }, 4700);

    return () => window.clearTimeout(timeout);
  }, [showChatDeletedNotice, chatDeletedNoticeKey]);

  const closeBrowseUsers = () => {
    setView('chatlist');
    setSearchInputValue("");
    setSearch("");
    setResults([]);
    setIsLoadingSearchResults(false);
  };

  useEffect(() => {
    if (!search.trim()) {
      setIsLoadingSearchResults(false);
      setResults([]);
      return;
    }
    setShowEmptySearchResult(false);
    setIsLoadingSearchResults(true);
    setResults([]);

    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/chats/search-users/?username=${search}`);
      const data = await res.json();
      setResults(data || []);
      setIsLoadingSearchResults(false);
      if (!data || data.length === 0) {
        setShowEmptySearchResult(true);
      }
    }, 300);  

    return () => {
      clearTimeout(timeout);
      setIsLoadingSearchResults(false);
    };
  }, [search]);

  useEffect(() => {
    if (!results.length) return;

    const s = getSocket();
    if (!s.connected) s.connect();

    const ids = Array.from(
      new Set(results.map((user) => Number(user.id)).filter((id) => Number.isFinite(id)))
    );

    const initial: Record<number, boolean> = {};
    let isCancelled = false;

    void Promise.all(
      ids.map(
        (userId) =>
          new Promise<void>((resolve) => {
            s.emit(WS_EVENTS.PRESENCE_GET, { userId }, (res: any) => {
              if (!isCancelled && res?.ok) {
                initial[userId] = !!res.online;
              }
              resolve();
            });
            setTimeout(resolve, 5000);
          })
      )
    ).then(() => {
      if (isCancelled || !Object.keys(initial).length) return;
      setOnlineByUserId((prev) => ({ ...prev, ...initial }));
    });

    return () => {
      isCancelled = true;
    };
  }, [results]);

  useEffect(() => {
    if (view !== "browse-users") return;
    if (latestUsers.length) return;

    const loadLatestUsers = async () => {
      setIsLoadingLatestUsers(true);
      try {
        const res = await fetch("/api/chats/latest-users", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          console.error("Failed to load latest users", data);
          return;
        }
        setLatestUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load latest users", error);
      } finally {
        setIsLoadingLatestUsers(false);
      }
    };

    void loadLatestUsers();
  }, [view, latestUsers.length]);

  const [chats, setChats] = useState<any[]>([]);

  useEffect(() => {
    if (view !== 'chatlist') return;

    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => el.removeEventListener("scroll", handleScroll);
  }, [view, chats.length]);

  const loadChats = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setIsLoadingChats(true);
    }
    try {
      const res = await fetch("/api/chats/get-chats", {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        console.error(data);
        return;
      }
      const chatsArr = data.chats ?? [];
      setChats(chatsArr);

      const s = getSocket();
      if (!s.connected) s.connect();

      chatsArr.forEach((c: any) => {
        const chatId = c.chat?.id;
        if (chatId) s.emit(WS_EVENTS.CHAT_JOIN, { chatId });
      });

      const ids = Array.from(
        new Set(
          chatsArr
            .map((c: any) => Number(c.otherUser?.id))
            .filter((id: number) => Number.isFinite(id))
        )
      ) as number[];

      const initial: Record<number, boolean> = {};

      await Promise.all(
        ids.map(
          (userId) =>
            new Promise<void>((resolve) => {
              s.emit(WS_EVENTS.PRESENCE_GET, { userId }, (res: any) => {
                if (res?.ok) initial[userId] = !!res.online;
                resolve();
              });
              setTimeout(resolve, 1500);
            })
        )
      );
      setOnlineByUserId((prev) => ({ ...prev, ...initial }));
    } catch (e) {
      console.error("Failed to load chats", e);
    } finally {
      if (showLoader) {
        setIsLoadingChats(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const [onlineByUserId, setOnlineByUserId] = useState<Record<number, boolean>>({});
  const [typingByUserId, setTypingByUserId] = useState<Record<number, boolean>>({});
  const sortedChats = [...chats].sort((a, b) => {
    const aPinnedIndex = pinnedChatIds.indexOf(Number(a.chat?.id));
    const bPinnedIndex = pinnedChatIds.indexOf(Number(b.chat?.id));
    const aPinned = aPinnedIndex !== -1;
    const bPinned = bPinnedIndex !== -1;

    if (aPinned && bPinned) return aPinnedIndex - bPinnedIndex;
    if (aPinned === bPinned) {
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    }
    return aPinned ? -1 : 1;
  });

  const removeChatFromState = (chatId: number, otherUserId?: number | null) => {
    setChats((current) => current.filter((chat) => chat.chat?.id !== chatId));
    setPinnedChatIds((current) => current.filter((id) => id !== chatId));
    if (otherUserId != null) {
      setActiveUser((current) => (current?.id === otherUserId ? null : current));
    }
  };

  useEffect(() => {
    const s = getSocket();
    if (!s.connected) s.connect();

    const onPresenceOnline = (p: any) => {
      const uid = +p?.userId;
      if (!Number.isFinite(uid)) return;
      setOnlineByUserId(prev => ({ ...prev, [uid]: true }));
    };

    const onPresenceOffline = (p: any) => {
      const uid = +p?.userId;
      if (!Number.isFinite(uid)) return;
      setOnlineByUserId(prev => ({ ...prev, [uid]: false }));
      setTypingByUserId(prev => ({ ...prev, [uid]: false }));
    };

    const onTypingStart = (p: any) => {
      const uid = +p?.userId;
      if (!Number.isFinite(uid)) return;

      setTypingByUserId(prev => ({ ...prev, [uid]: true }));
    };

    const onTypingStop = (p: any) => {
      const uid = +p?.userId;
      if (!Number.isFinite(uid)) return;

      setTypingByUserId(prev => ({ ...prev, [uid]: false }));
    };

    const onChatListRefresh = () => {
      void loadChats(false);
    };

    s.on(WS_EVENTS.PRESENCE_ONLINE, onPresenceOnline);
    s.on(WS_EVENTS.PRESENCE_OFFLINE, onPresenceOffline);
    s.on(WS_EVENTS.CHAT_TYPING_START, onTypingStart);
    s.on(WS_EVENTS.CHAT_TYPING_STOP, onTypingStop);
    s.on(WS_EVENTS.CHAT_LIST_REFRESH, onChatListRefresh);

    return () => {
      s.off(WS_EVENTS.PRESENCE_ONLINE, onPresenceOnline);
      s.off(WS_EVENTS.PRESENCE_OFFLINE, onPresenceOffline);
      s.off(WS_EVENTS.CHAT_TYPING_START, onTypingStart);
      s.off(WS_EVENTS.CHAT_TYPING_STOP, onTypingStop);
      s.off(WS_EVENTS.CHAT_LIST_REFRESH, onChatListRefresh);
    };
  }, [loadChats, setActiveUser]);

  useEffect(() => {
    const handleLocalChatDeleted = (event: Event) => {
      const detail = (event as CustomEvent<LocalChatDeletedDetail>).detail;
      if (!detail || detail.scope === "other") return;

      removeChatFromState(detail.chatId, detail.otherUserId);
      setChatActionMenu((current) =>
        current?.chatId === detail.chatId ? null : current
      );
      setDeleteChatDialog((current) =>
        current?.chatId === detail.chatId ? null : current
      );
    };

    window.addEventListener(LOCAL_CHAT_DELETED_EVENT, handleLocalChatDeleted);

    return () => {
      window.removeEventListener(LOCAL_CHAT_DELETED_EVENT, handleLocalChatDeleted);
    };
  }, [setActiveUser]);

  useEffect(() => {
    if (!chatActionMenu) return;

    const closeMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target?.closest('.menu-item')) return;
      setChatActionMenu(null);
    };

    document.addEventListener("mousedown", closeMenu);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
    };
  }, [chatActionMenu]);

  useEffect(() => {
    if (!chatActionMenu || !chatActionMenuRef.current || !wrapperRef.current) return;

    const menu = chatActionMenuRef.current;
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gap = 6;

    let nextX = chatActionMenu.x;
    let nextY = chatActionMenu.y;

    if (nextX + menuRect.width > wrapperRect.width - gap) {
      nextX = Math.max(gap, chatActionMenu.x - menuRect.width);
    }

    if (nextY + menuRect.height > wrapperRect.height - gap) {
      nextY = Math.max(gap, chatActionMenu.y - menuRect.height);
    }

    if (
      nextX !== chatActionMenu.x ||
      nextY !== chatActionMenu.y ||
      !chatActionMenu.isPositioned
    ) {
      setChatActionMenu((current) =>
        current
          ? {...current, x: nextX, y: nextY, isPositioned: true}
          : current
      );
    }
  }, [chatActionMenu]);

  useEffect(() => {
    if (view !== "browse-users") return;

    const rail = latestUsersRailRef.current;
    const track = latestUsersTrackRef.current;
    if (!rail || !track || !latestUsers.length) return;

    const blockWidth = track.scrollWidth / LATEST_USERS_TRACK_COPIES;
    latestUsersOffsetRef.current = -blockWidth * 6;
    track.style.transform = `translateX(${latestUsersOffsetRef.current}px)`;

    const animate = () => {
      if (!latestUsersDragRef.current.isDragging) {
        latestUsersOffsetRef.current += 0.11;
        if (latestUsersOffsetRef.current >= -blockWidth * 5) {
          latestUsersOffsetRef.current -= blockWidth;
        }
        track.style.transform = `translateX(${latestUsersOffsetRef.current}px)`;
      }
      latestUsersRafRef.current = window.requestAnimationFrame(animate);
    };

    latestUsersRafRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (latestUsersRafRef.current != null) {
        window.cancelAnimationFrame(latestUsersRafRef.current);
        latestUsersRafRef.current = null;
      }
    };
  }, [view, latestUsers, latestUsersRailWidth]);

  useEffect(() => {
    if (view !== "browse-users") return;

    const rail = latestUsersRailRef.current;
    if (!rail) return;

    const observer = new ResizeObserver(() => {
      setLatestUsersRailWidth(rail.clientWidth);
    });

    setLatestUsersRailWidth(rail.clientWidth);
    observer.observe(rail);

    return () => observer.disconnect();
  }, [view]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const track = latestUsersTrackRef.current;
      const dragState = latestUsersDragRef.current;
      if (!track || !dragState.isDragging) return;

      const deltaX = event.clientX - dragState.startX;
      let nextOffset = dragState.startOffset + deltaX;

      const blockWidth = track.scrollWidth / LATEST_USERS_TRACK_COPIES;
      while (nextOffset >= -blockWidth * 5) {
        nextOffset -= blockWidth;
      }
      while (nextOffset <= -blockWidth * 8) {
        nextOffset += blockWidth;
      }

      latestUsersOffsetRef.current = nextOffset;
      track.style.transform = `translateX(${nextOffset}px)`;
    };

    const handleMouseUp = () => {
      latestUsersDragRef.current.isDragging = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <>
      <audio ref={navigationStartRef} src="/audio/navigation_start.wav" preload="auto" />
      {view === 'chatlist' && (
        <div className={styles["inactive-chats-wrapper"]} ref={wrapperRef}>
          {isLoadingChats && (
            <div className={styles["chat-list-loading"]}>
              <img
                src="/images/loading.gif"
                alt="Загрузка"
                className={styles["chat-list-loading-gif"]}
              />
            </div>
          )}
          {!isLoadingChats && chats.length === 0 && (
            <div className={styles["no-chats-bar"]}>У вас пока нет чатов. Напишите кому-нибудь!</div>
          )}
          <div className={styles["inactive-chats"]} ref={scrollRef}>
            {sortedChats.map((c: any) => {
              const otherUser = c.otherUser;
              const otherId = otherUser?.id;
              const isPinned = pinnedChatIds.includes(Number(c.chat?.id));

              const isOnline = otherId ? !!onlineByUserId[otherId] : false;
              const isTyping = otherId ? !!typingByUserId[otherId] : false;

              return (
                <InactiveChat
                  key={c.chat?.id ?? otherId}
                  onClick={() => {
                    if (!otherUser) return;
                    playNavigationSound();
                    setActiveUser(otherUser);
                    setChats((current) =>
                      current.map((chat) =>
                        chat.chat?.id === c.chat?.id
                          ? { ...chat, unreadCount: 0 }
                          : chat
                      )
                    );
                  }}
                  contentClassName={isPinned ? styles["pinned"] : undefined}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (chatActionMenu?.chatId === c.chat?.id) {
                      setChatActionMenu(null);
                      return;
                    }
                    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
                    const x = wrapperRect
                      ? event.clientX - wrapperRect.left
                      : event.clientX;
                    const y = wrapperRect
                      ? event.clientY - wrapperRect.top
                      : event.clientY;
                    setChatActionMenu({chatId: c.chat?.id, x, y, isPositioned: false, otherUser: otherUser ?? null});
                  }}
                >
                  {isPinned && (
                    <img src='/images/red-pin.png' className={styles["inactive-chat-pin"]}/>
                  )}
                    <div
                      className={"userpic-wrapper in-inactive-chat"}
                      onClick={(event) => {
                        event.stopPropagation();
                        playNavigationSound();
                        if (otherUser) openProfile(otherUser);
                      }}
                    >
                      <img src={otherUser?.avatarUrl ?? "/images/defaultpfp_grey.jpg"} alt="User" className="userpic"/>
                      <span
                        className={`online-status-circle inactive-chat-status ${ isOnline ? "online" : ""}`}
                        style={{ display: `${ isOnline ? "block" : "none"}` }}
                      ></span>
                    </div>

                    <div className={styles["inactive-chat-general-info"]}>
                      <div className={styles["inactive-chat-username"]}>
                        {otherUser?.nickname || otherUser?.username || "Чат"}
                      </div>

                      <ChatLastMessage
                        content={
                          isTyping
                            ? (<>Печатает<span className="typing-dots"></span></>)
                            : c.lastMessage?.content
                              ? c.lastMessage.senderId === otherId
                                ? c.lastMessage.content
                                : <><b style={{ fontStyle: "italic" }}>Вы:</b> {c.lastMessage.content}</>
                              : ""
                        }
                        time={
                          c.lastMessage?.createdAt
                            ? formatTime(c.lastMessage.createdAt)
                            : ""
                        }
                      />
                    </div>

                  {c.unreadCount > 0 && (
                    <div className={styles["inactive-chat-unread-messages-count"]}>
                      {c.unreadCount}
                    </div>
                  )}
                </InactiveChat>
              );
            })}


          </div>
          <div className={`${styles["inactive-chats-top-fade"]} ` + (showTopFade ? styles["fade-top"] : "")}></div>
          <div className={`${styles["inactive-chats-bottom-fade"]} ` + (showBottomFade ? styles["fade-bottom"] : "")}></div>
          {showChatDeletedNotice && (
            <div key={chatDeletedNoticeKey} className={styles["chat-deleted-notice"]}>
              <div className={styles["chat-deleted-notice-sign"]}/>
              <div className={styles["chat-deleted-notice-text"]}>
                Чат удален
              </div>
            </div>
          )}
          <span
            className={`${styles["add-new-chat"]} ` + (showTopFade ? styles["hidden"] : "")}
            style={{ bottom: hasVerticalScroll ? "15px" : "6px" }}
            onClick={() => setView('browse-users')}
          ></span>
          {chatActionMenu && (
            <div
              ref={chatActionMenuRef}
              className='menu'
              style={{
                left: chatActionMenu.x,
                top: chatActionMenu.y,
                visibility: chatActionMenu.isPositioned ? "visible" : "hidden",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  if (chatActionMenu.otherUser) {
                    openProfile(chatActionMenu.otherUser);
                  }
                  setChatActionMenu(null);
                }}
              >
                Открыть профиль
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setPinnedChatIds((current) => {
                    const next = current.includes(chatActionMenu.chatId)
                      ? current.filter((id) => id !== chatActionMenu.chatId)
                      : [chatActionMenu.chatId, ...current.filter((id) => id !== chatActionMenu.chatId)];
                    return next;
                  });
                  setChatActionMenu(null);
                }}
              >
                {pinnedChatIds.includes(chatActionMenu.chatId)
                  ? "Открепить"
                  : "Закрепить"}
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setDeleteChatDialog({
                    chatId: chatActionMenu.chatId,
                    otherUser: chatActionMenu.otherUser,
                  });
                  setChatActionMenu(null);
                }}
              >
                Удалить чат
              </button>
            </div>
          )}
        </div>
      )}
      {deleteChatDialog && (
        <DeleteChatDialog
          chatId={deleteChatDialog.chatId}
          otherUserId={deleteChatDialog.otherUser?.id ?? null}
          onDeleted={() => {
            setChatDeletedNoticeKey((current) => current + 1);
            setShowChatDeletedNotice(true);
          }}
          onClose={() => setDeleteChatDialog(null)}
        />
      )}
      {view === 'browse-users' && (
        <div className="aero-frame">
          <div className="header-control-buttons">
            <button className="aero-buttons-blue aero-button-minimize" onClick={() => {
              setResults([]); 
              setShowEmptySearchResult(false)}
            } />
            <button className="aero-buttons-blue aero-button-maximize inactive"/>
            <button className="aero-button-close" onClick={closeBrowseUsers} />
          </div>
          <div className={styles["user-search-wrapper"]}>
            <div className={styles["user-search"]} onClick={() => searchfunc(searchInputValue)}>
              <input 
                className="retro-input" 
                placeholder="Найти по имени..."
                onChange={(e) => setSearchInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchfunc(searchInputValue);
                }}
                style={{height: `auto`, flex: `1 1 auto`, minWidth: `0`}}>
              </input>
              <span className={styles["search"]}></span>
            </div>
            <div className={styles["search-results"]}>
              {isLoadingSearchResults && (
                <div className={styles["search-results-loading"]}>
                  <img src="/images/loading.gif" alt="Loading" className={styles["chat-list-loading-gif"]}/>
                </div>
              )}
              {showEmptySearchResult && results.length === 0 && (
                <div className={styles["search-results-empty"]}>
                  <img src="/images/LM003.ico" alt="No users found" className={styles["search-results-empty-icon"]}/>
                  <span className={styles["search-results-empty-text"]}>
                    Пользователи не найдены
                  </span>
                </div>
              )}
              {results.map((u) => (
                <button key={u.id} type="button" className={styles["search-result"]} onClick={() => openProfile(u)}>
                  <div className={styles["inactive-chat-glare"]}></div>
                  <div className={`${styles["inactive-chat-content-wrapper"]} ${styles["search-res"]}`}>
                    <div className={"userpic-wrapper in-inactive-chat"}>
                    <img src={u.avatarUrl || "/images/defaultpfp_grey.jpg"} alt="User" className="userpic"/>
                    <span
                      className={`online-status-circle inactive-chat-status ${onlineByUserId[u.id] ? "online" : ""}`}
                      style={{ display: onlineByUserId[u.id] ? "block" : "none" }}
                    ></span>
                  </div>
                  <div className={`${styles["inactive-chat-general-info"]} ${styles["search-res"]}`}>
                    <div className={styles["search-result-name"]}>{u.nickname || "user123455"}</div>
                    <div className={styles["search-result-username"]}>@{u.username}</div>
                    <div className={`${styles["search-result-online-status"]} ${onlineByUserId[u.id] ? styles.active : ""}`}>
                      {onlineByUserId[u.id] ? "Онлайн" : "Был(а) недавно"}
                    </div>
                  </div>
                  </div>
                </button>
              ))}
            </div>
            <div className={styles["latest-users-panel"]}>
              <div className={styles["latest-users-title"]}>Последние пользователи</div>
              {isLoadingLatestUsers ? (
                <div className={styles["latest-users-loading"]}>
                  <img src="/images/loading.gif" alt="Loading" className={styles["chat-list-loading-gif"]}/>
                </div>
              ) : (
                <div
                  ref={latestUsersRailRef}
                  className={styles["latest-users-rail"]}
                  onMouseDown={(event) => {
                    const track = latestUsersTrackRef.current;
                    if (!track) return;

                    latestUsersDragRef.current.isDragging = true;
                    latestUsersDragRef.current.startX = event.clientX;
                    latestUsersDragRef.current.startOffset = latestUsersOffsetRef.current;
                    document.body.style.userSelect = "none";
                  }}
                >
                  <div ref={latestUsersTrackRef} className={styles["latest-users-track"]}>
                    {Array.from({ length: LATEST_USERS_TRACK_COPIES }, () => latestUsers).flat().map((latestUser, index) => (
                      <button
                        key={`${latestUser.id}-${index}`}
                        type="button"
                        className={styles["latest-user-card"]}
                      >
                        <div className={"userpic-wrapper in-inactive-chat"}>
                          <img
                            src={latestUser.avatarUrl || "/images/defaultpfp_grey.jpg"}
                            alt="User"
                            className="userpic"
                            onClick={() => {
                              playNavigationSound();
                              openProfile(latestUser);
                            }}
                          />
                        </div>
                        <span className={styles["latest-user-name"]} onClick={() => {
                          playNavigationSound();
                          openProfile(latestUser);
                        }}>
                          {latestUser.nickname || latestUser.username}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatList;


