import { useRef, useEffect, useState } from "react";
import styles from "./ChatList.module.scss";
import InactiveChat from "./InactiveChat";
import { useProfileModal } from "@/app/_providers/ProfileModalContext";
import { User } from "@/types/User"
import { formatTime } from "@/lib/utils";
import { useActiveChat } from "@/app/_providers/ActiveChatContext";
import { getSocket } from "@/lib/socket/socket";
import { WS_EVENTS } from "@/lib/socket/events";

const testChats = Array.from({ length: 8 }, (_, index) => ({
  chat: { id: 100000 + index },
  otherUser: {
    id: 200000 + index,
    username: `test_chat_${index + 1}`,
    nickname: `Тестовый чат ${index + 1}`,
    avatarUrl: null,
    lastSeen: null,
  },
  lastMessage: {
    id: 300000 + index,
    content: index % 2 === 0
      ? "Это тестовый чат для проверки скролла."
      : "Здесь просто много фейковых чатов, чтобы был длинный список.",
    createdAt: new Date(Date.now() - index * 60000).toISOString(),
    senderId: index % 3 === 0 ? 200000 + index : 1,
  },
  unreadCount: index % 3 === 0 ? index + 1 : 0,
}));

const ChatList: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const [hasVerticalScroll, setHasVerticalScroll] = useState(false);
  const [searchInputValue, setSearchInputValue] = useState("");
  const { openProfile } = useProfileModal();
  const { setActiveUser } = useActiveChat();

  const searchfunc = (value: string) => {
    setSearch(value)
  }

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

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/chats/search-users/?username=${search}`);
      const data = await res.json();
      setResults(data || []);
    }, 300);  

    return () => clearTimeout(timeout);
  }, [search]);


  const [chats, setChats] = useState<any[]>([]);

  useEffect(() => {
    if (view !== 'chatlist') return;

    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => el.removeEventListener("scroll", handleScroll);
  }, [view, chats.length]);

  useEffect(() => {
    const loadChats = async () => {
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
      }
    };
    loadChats();
  }, []);

  const [onlineByUserId, setOnlineByUserId] = useState<Record<number, boolean>>({});
  const [typingByUserId, setTypingByUserId] = useState<Record<number, boolean>>({});
  const visibleChats = [...(chats ?? []), ...testChats];

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

    s.on(WS_EVENTS.PRESENCE_ONLINE, onPresenceOnline);
    s.on(WS_EVENTS.PRESENCE_OFFLINE, onPresenceOffline);
    s.on(WS_EVENTS.CHAT_TYPING_START, onTypingStart);
    s.on(WS_EVENTS.CHAT_TYPING_STOP, onTypingStop);
    return () => {
      s.off(WS_EVENTS.PRESENCE_ONLINE, onPresenceOnline);
      s.off(WS_EVENTS.PRESENCE_OFFLINE, onPresenceOffline);
      s.off(WS_EVENTS.CHAT_TYPING_START, onTypingStart);
      s.off(WS_EVENTS.CHAT_TYPING_STOP, onTypingStop);
    };
  }, []);

  return (
    <>
      {view === 'chatlist' && (
        <div className={styles["inactive-chats-wrapper"]}>
          <div className={styles["inactive-chats"]} ref={scrollRef}>
            {visibleChats.map((c: any) => {
              const otherUser = c.otherUser;
              const otherId = otherUser?.id;

              const isOnline = otherId ? !!onlineByUserId[otherId] : false;
              const isTyping = otherId ? !!typingByUserId[otherId] : false;

              return (
                <InactiveChat key={c.chat?.id ?? otherId} onClick={() => otherUser && setActiveUser(otherUser)}>
                  <div
                    className={"userpic-wrapper in-inactive-chat"}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (otherUser) openProfile(otherUser);
                    }}
                  >
                      <img src={otherUser?.avatarUrl ?? "/images/defaultpfp_1.jpg"} alt="User" className="userpic"/>
                      <span
                        className={`online-status-circle inactive-chat-status ${ isOnline ? "online" : ""}`}
                        style={{ display: `${ isOnline ? "block" : "none"}` }}
                      ></span>
                    </div>

                    <div className={styles["inactive-chat-general-info"]}>
                      <div className={styles["inactive-chat-username"]}>
                        {otherUser?.nickname || otherUser?.username || "Чат"}
                      </div>

                      <div className={styles["inactive-chat-last-message"]}>
                        <div className={styles["inactive-chat-last-message-text"]}>
                          {isTyping
                            ? (<>Печатает<span className="typing-dots"></span></>)
                            : c.lastMessage?.content
                              ? c.lastMessage.senderId === otherId
                                ? c.lastMessage.content
                                : <><b style={{ fontStyle: "italic" }}>Вы:</b> {c.lastMessage.content}</>
                              : ""}
                        </div>

                        <div className={styles["inactive-chat-last-message-sent"]}>
                          {c.lastMessage?.createdAt
                            ? formatTime(c.lastMessage.createdAt)
                            : ""}
                        </div>
                      </div>
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
          <span
            className={`${styles["add-new-chat"]} ` + (showTopFade ? styles["hidden"] : "")}
            style={{ bottom: hasVerticalScroll ? "15px" : "10px" }}
            onClick={() => setView('browse-users')}
          ></span>
        </div>
      )}
      {view === 'browse-users' && (
        <div className="aero-frame">
          <div className="header-control-buttons">
            <button className="aero-buttons-blue aero-button-minimize" onClick={() => setView('chatlist')} />
            <button className="aero-buttons-blue aero-button-maximize inactive"/>
            <button className="aero-button-close" onClick={() => setView('chatlist')} />
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
              {results.map((u) => (
                <button key={u.id} type="button" className={styles["search-result"]} onClick={() => openProfile(u)}>
                  <div className={styles["inactive-chat-glare"]}></div>
                  <div className={`${styles["inactive-chat-content-wrapper"]} ${styles["search-res"]}`}>
                    <div className={"userpic-wrapper in-inactive-chat"}>
                    <img src={u.avatarUrl || "/images/defaultpfp_1.jpg"} alt="User" className="userpic"/>
                    <span className="online-status-circle inactive-chat-status"></span>
                  </div>
                  <div className={`${styles["inactive-chat-general-info"]} ${styles["search-res"]}`}>
                    <div className={styles["search-result-name"]}>{u.nickname || "user123455"}</div>
                    <div className={styles["search-result-username"]}>@{u.username}</div>
                    <div className={`${styles["search-result-online-status"]} ${styles.active}`}>
                      "Онлайн"
                    </div>
                  </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatList;
