"use client";

import Link from "next/link";
import React, { FC, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "@/styles/welcome.module.scss";

const blinkies = [
  "/images/pouring-ragnarok.gif",
  "/images/blinkiesCafe-X7.gif",
  "/images/blinkiesCafe-hK.gif",
  "/images/blinkiesCafe-fW.gif",
  "/images/blinkiesCafe-HV.gif",
  "/images/blinkiesCafe-Mn.gif",
  "/images/blinkiesCafe-1l.gif",
  "/images/pouring-ragnarok.gif",
];

type DiscussionMessage = {
  name: string;
  text: string;
};

type RadioSnapshot = {
  cycleDurationSec: number;
  offsetSec: number;
  serverTimeMs: number;
  stationStartedAtMs: number;
  track: {
    durationSec: number;
    id: string;
    src: string;
    title: string;
  };
  trackEndsAtMs: number;
  trackIndex: number;
  trackStartedAtMs: number;
};

type VisitorsStats = {
  recentUniqueVisitors: number;
  totalVisitors: number;
  updatedAt: string;
};

const MARQUEE_SPEED_PX_PER_SEC = 20;
const MARQUEE_PAUSE_MS = 3000;

const Welcome: FC = () => {
  const whiteTextStripRef = useRef<HTMLDivElement | null>(null);
  const discussionMessagesRef = useRef<HTMLDivElement | null>(null);
  const discussionNameInputRef = useRef<HTMLTextAreaElement | null>(null);
  const discussionMessageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const musicPlayerRef = useRef<HTMLAudioElement | null>(null);
  const musicToggleRef = useRef<HTMLButtonElement | null>(null);
  const musicTitleRef = useRef<HTMLDivElement | null>(null);
  const musicTitleTrackRef = useRef<HTMLDivElement | null>(null);
  const navigationStartRef = useRef<HTMLAudioElement | null>(null);
  const discussionSendRef = useRef<HTMLAudioElement | null>(null);
  const discussionErrorRef = useRef<HTMLAudioElement | null>(null);
  const pendingRadioSnapshotRef = useRef<RadioSnapshot | null>(null);
  const radioPausedByUserRef = useRef(false);
  const didInitialUserRadioStartRef = useRef(false);
  const isMusicPausedRef = useRef(true);
  const [whiteTextSmileCount, setWhiteTextSmileCount] = useState(0);
  const [discussionMessages, setDiscussionMessages] = useState<DiscussionMessage[]>([]);
  const [discussionName, setDiscussionName] = useState("");
  const [discussionMessage, setDiscussionMessage] = useState("");
  const [isMusicTogglePressed, setIsMusicTogglePressed] = useState(false);
  const [radioSnapshot, setRadioSnapshot] = useState<RadioSnapshot | null>(null);
  const [isMusicPaused, setIsMusicPaused] = useState(true);
  const [isDiscussionLoading, setIsDiscussionLoading] = useState(true);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [showEnterPopup, setShowEnterPopup] = useState(false);
  const [hideEnterPopupState, setHideEnterPopupState] = useState(false);

  const hideEnterPopup = () => {
    setHideEnterPopupState(true);
    window.setTimeout(() => {
      setShowEnterPopup(false);
    }, 700);
  };

  useEffect(() => {
    isMusicPausedRef.current = isMusicPaused;
  }, [isMusicPaused]);

  const tryStartRadio = async () => {
    const player = musicPlayerRef.current;
    if (!player || radioPausedByUserRef.current) return false;

    try {
      await player.play();
      return true;
    } catch {
      return false;
    }
  };

  const tryStartRadioWithFadeIn = async () => {
    const player = musicPlayerRef.current;
    if (!player || radioPausedByUserRef.current) return false;
    player.volume = 0;
    try {
      await player.play();
    } catch {
      player.volume = 1;
      return false;
    }
    const fadeDurationMs = 4000;
    const fadeStartedAt = performance.now();

    const step = (time: number) => {
      const progress = Math.max(0, Math.min((time - fadeStartedAt) / fadeDurationMs, 1));
      player.volume = progress;
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
    return true;
  };

  useLayoutEffect(() => {
    const node = whiteTextStripRef.current;
    if (!node) return;

    const updateSmileCount = () => {
      const nodeStyles = window.getComputedStyle(node);
      const smileSize = parseFloat(nodeStyles.getPropertyValue("--white-text-smile-size")) || 19;
      const nextCount = Math.max(1, Math.floor(node.clientWidth / smileSize));

      setWhiteTextSmileCount(nextCount);
    };
    updateSmileCount();

    const resizeObserver = new ResizeObserver(updateSmileCount);
    resizeObserver.observe(node);
    window.addEventListener("resize", updateSmileCount);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSmileCount);
    };
  }, []);

  useEffect(() => {
    const node = discussionMessagesRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [discussionMessages]);

  useEffect(() => {
    const loadDiscussionMessages = async () => {
      try {
        const res = await fetch("/api/discussion", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch discussion");
        }

        const nextMessages = await res.json() as DiscussionMessage[];
        setDiscussionMessages(Array.isArray(nextMessages) ? nextMessages : []);
      } catch {
        setDiscussionMessages([]);
      } finally {
        setIsDiscussionLoading(false);
      }
    };
    void loadDiscussionMessages();
  }, []);

  useEffect(() => {
    const loadVisitorsStats = async () => {
      const visitorNumberCookie = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("aewo_unique_visitor_number="))
        ?.split("=")[1];

      if (visitorNumberCookie) {
        const parsedVisitorNumber = Number(visitorNumberCookie);
        if (Number.isFinite(parsedVisitorNumber)) {
          setVisitorCount(parsedVisitorNumber);
          return;
        }
      }

      try {
        const res = await fetch("/api/visitors", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to fetch visitors");
        }

        const stats = await res.json() as VisitorsStats;
        if (typeof stats.totalVisitors === "number") {
          setVisitorCount(stats.totalVisitors);
        }
      } catch {}
    };

    void loadVisitorsStats();
  }, []);

  useEffect(() => {
    const titleNode = musicTitleRef.current;
    const trackNode = musicTitleTrackRef.current;

    if (!titleNode || !trackNode) return;
    let rafId = 0;
    let lastTime = 0;
    let elapsedMs = 0;
    let waitRemainingMs = 0;
    let isWaiting = false;
    const titleWidth = titleNode.clientWidth;
    const trackWidth = trackNode.scrollWidth;
    const totalDistance = titleWidth + trackWidth;
    const travelDurationMs = (totalDistance / MARQUEE_SPEED_PX_PER_SEC) * 1000;

    const setTrackPosition = (x: number) => {
      trackNode.style.transform = `translateY(-50%) translateX(${x}px)`;
    };

    const step = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      if (isMusicPausedRef.current) {
        rafId = requestAnimationFrame(step);
        return;
      }

      if (isWaiting) {
        waitRemainingMs -= delta;
        if (waitRemainingMs > 0) {
          rafId = requestAnimationFrame(step);
          return;
        }
        isWaiting = false;
        elapsedMs = 0;
        setTrackPosition(titleWidth);
      }

      elapsedMs += delta;
      const progress = Math.min(elapsedMs / travelDurationMs, 1);
      const x = titleWidth - totalDistance * progress;

      setTrackPosition(x);

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
        return;
      }

      isWaiting = true;
      waitRemainingMs = MARQUEE_PAUSE_MS;
      rafId = requestAnimationFrame(step);
    };

    setTrackPosition(titleWidth);
    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [radioSnapshot?.track.title]);

  const syncRadioPlayback = async () => {
    const player = musicPlayerRef.current;
    try {
      const res = await fetch("/api/radio/current", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to fetch radio state");
      }
      const nextSnapshot: RadioSnapshot = await res.json();
      pendingRadioSnapshotRef.current = nextSnapshot;

      if (!player) {
        setRadioSnapshot(nextSnapshot);
        return;
      }
      if (radioSnapshot?.track.id !== nextSnapshot.track.id) {
        setRadioSnapshot(nextSnapshot);
        return;
      }
      const duration = Number.isFinite(player.duration) ? player.duration : nextSnapshot.track.durationSec;
      const safeTime = Math.max(0, Math.min(nextSnapshot.offsetSec, Math.max(0, duration - 0.25)));

      if (Math.abs(player.currentTime - safeTime) > 1.5) {
        player.currentTime = safeTime;
      }

      if (!radioPausedByUserRef.current && player.paused) {
        const started = await tryStartRadio();
        if (started) {
          setIsMusicPaused(false);
        } else {
          setShowEnterPopup(true);
        }
      }
    } catch { throw new Error("Failed to set radio"); }
  };

  useEffect(() => {
    void syncRadioPlayback();
  }, []);

  useEffect(() => {
    const player = musicPlayerRef.current;
    const snapshot = pendingRadioSnapshotRef.current;
    if (!player || !snapshot || !radioSnapshot || radioSnapshot.track.id !== snapshot.track.id) return;

    const applyRadioSnapshot = async () => {
      const duration = Number.isFinite(player.duration) ? player.duration : snapshot.track.durationSec;
      const safeTime = Math.max(0, Math.min(snapshot.offsetSec, Math.max(0, duration - 0.25)));
      player.currentTime = safeTime;

      if (radioPausedByUserRef.current) {
        player.pause();
        setIsMusicPaused(true);
        return;
      }
      const started = await tryStartRadio();
      if (started) {
        setIsMusicPaused(false);
      } else {
        setShowEnterPopup(true);
      }
    };
    if (player.readyState >= 1) {
      void applyRadioSnapshot();
      return;
    }
    const handleLoadedMetadata = () => {
      void applyRadioSnapshot();
    };
    player.addEventListener("loadedmetadata", handleLoadedMetadata, { once: true });

    return () => {
      player.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [radioSnapshot]);

  useEffect(() => {
    const retryAutoplay = async (event?: Event) => {
      const target = event?.target;

      if (
        target instanceof Node &&
        musicToggleRef.current &&
        musicToggleRef.current.contains(target)
      ) {
        return;
      }

      const started = !showEnterPopup || didInitialUserRadioStartRef.current
        ? await tryStartRadio()
        : await tryStartRadioWithFadeIn();

      if (started) {
        didInitialUserRadioStartRef.current = true;
        setIsMusicPaused(false)
        hideEnterPopup()
        window.removeEventListener("pointerdown", retryAutoplay);
        window.removeEventListener("keydown", retryAutoplay);
      }
    };
    window.addEventListener("pointerdown", retryAutoplay, { passive: true });
    window.addEventListener("keydown", retryAutoplay, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", retryAutoplay);
      window.removeEventListener("keydown", retryAutoplay);
    };
  }, [showEnterPopup]);

  const triggerDiscussionShake = (element: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (!element) return;

    element.classList.remove(styles["discussion-shake"]);
    void element.offsetWidth;
    element.classList.add(styles["discussion-shake"]);

    const handleAnimationEnd = () => {
      element.classList.remove(styles["discussion-shake"]);
      element.removeEventListener("animationend", handleAnimationEnd);
    };
    element.addEventListener("animationend", handleAnimationEnd);
  };

  const handleDiscussionSubmit = async () => {
    const trimmedName = discussionName.trim();
    const trimmedMessage = discussionMessage.trim();
    const discussionSend = discussionSendRef.current;
    if (discussionSend) {
      discussionSend.currentTime = 0;
      void discussionSend.play().catch(() => {});
    }

    if (!trimmedName || !trimmedMessage) {
      const discussionError = discussionErrorRef.current;

      if (discussionError) {
        discussionError.currentTime = 0;
        setTimeout(() => {
          void discussionError.play().catch(() => {});
        }, 70);
      }
    }
    if (!trimmedName && trimmedMessage) triggerDiscussionShake(discussionNameInputRef.current);
    if (!trimmedMessage) triggerDiscussionShake(discussionMessageInputRef.current);
    if (!trimmedName || !trimmedMessage) return;

    try {
      const res = await fetch("/api/discussion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          text: trimmedMessage,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save discussion message");
      }

      const nextMessages = await res.json() as DiscussionMessage[];
      setDiscussionMessages(Array.isArray(nextMessages) ? nextMessages : []);
      setDiscussionMessage("");
    } catch {}
  };

  const handleDiscussionMessageKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    void handleDiscussionSubmit();
  };

  const handleMusicToggle = async () => {
    const player = musicPlayerRef.current;
    const navigationStart = navigationStartRef.current;
    if (!player) return;
    hideEnterPopup();
    if (navigationStart) {
      navigationStart.currentTime = 0;
      void navigationStart.play().catch(() => {});
    }

    if (player.paused) {
      radioPausedByUserRef.current = false;
      setIsMusicPaused(false);
      await syncRadioPlayback();
      return;
    }
    radioPausedByUserRef.current = true;
    setIsMusicPaused(true);
    player.pause();
  };

  const handleBottomTextIconRightClick = () => {
    const navigationStart = navigationStartRef.current;
    if (!navigationStart) return;

    navigationStart.currentTime = 0;
    void navigationStart.play().catch(() => {});
  };

  const visitorCountDigits = visitorCount === null
    ? []
    : String(visitorCount).padStart(5, "0").split("");

  return (
      <div className={styles["bg"]}>
      {showEnterPopup && (
        <div className={`${styles["enter-popup"]} ${hideEnterPopupState ? styles["hidden"] : ""}`}>
          <p>нажмите любую клавишу</p>
          <button type="button" onClick={hideEnterPopup}>ok</button>
        </div>
      )}
      <div className={styles["content"]}>
        <div className={styles["content-scroll"]}>
          <div className={styles["block1"]}>
            <Link href="/home" title="На главную">
              <img src="/images/logo.png" alt="Logo" className={styles["logo"]} />
            </Link>
            <div className={styles["blinkies-border"]}/>
            <div className={styles["blinkies-window"]}>
              <div className={styles["blinkies-track"]}>
                {blinkies.map((src, index) => (
                  <img key={`${src}-${index}`} src={src} alt="" className={styles["blinkie"]}/>
                ))}
              </div>
            </div>
          </div>
          <div className={styles["main-content"]}>
            <div className={styles["block2"]}>
              <div className={styles["to-do-block"]}>
                <div className={`${styles['info-header']} ${styles['to-do']}`}>To-Do List</div>
                <div className={styles["to-do-list"]}>
                  <div className={`${styles["task"]} ${styles["done"]}`}>
                    <img src="/images/WMP020.ico" alt="" className={styles["to-do-star"]} />
                    <span>доделать приветственную страницу</span>
                  </div>
                  <div className={styles["task"]}>
                    <img src="/images/WMP020.ico" alt="" className={styles["to-do-star"]} />
                    <span>полная кастомизация профиля</span>
                  </div>
                  <div className={`${styles["task"]} ${styles["done"]}`}>
                    <img src="/images/WMP020.ico" alt="" className={styles["to-do-star"]} />
                    <span>сообщения в реальном времени</span>
                  </div>
                  <div className={`${styles["task"]} ${styles["done"]}`}>
                    <img src="/images/WMP020.ico" alt="" className={styles["to-do-star"]} />
                    <span>возможность пересылать сообщения</span>
                  </div>
                  <div className={styles["task"]}>
                    <img src="/images/WMP020.ico" alt="" className={styles["to-do-star"]} />
                    <span>добавить групповые чаты</span>
                  </div>
                  <div className={styles["task"]}>
                    <img src="/images/WMP020.ico" alt="" className={`${styles["to-do-star"]} ${styles["no-margin"]}`} />
                    <span>список друзей</span>
                  </div>
                </div>
              </div>
              <div className={styles["pretty-panel"]}>
                <div className={styles["pretty-panel-images"]}>
                  <img src="/images/meadow.jpg" alt="" className={styles["pretty-panel-image"]} />
                  <div className={styles["music-player"]}>
                    <audio
                      ref={musicPlayerRef}
                      src={radioSnapshot?.track.src}
                      autoPlay
                      preload="auto"
                      playsInline
                      onPlay={() => setIsMusicPaused(false)}
                      onPause={() => setIsMusicPaused(true)}
                      onLoadedData={() => {
                        if (!radioPausedByUserRef.current) {
                          void tryStartRadio();
                        }
                      }}
                      onEnded={() => { void syncRadioPlayback(); }}
                    />
                    <audio ref={navigationStartRef} src="/audio/navigation_start.wav" preload="auto" />
                    <div className={styles["music-player-title"]} ref={musicTitleRef}>
                      <div className={styles["music-player-title-track"]} ref={musicTitleTrackRef}>
                        {radioSnapshot ? (
                          <span>{radioSnapshot.track.title}</span>
                        ) : (
                          <span className={styles["loading-indicator"]}>
                            <img src="/images/loading.gif" alt="" />
                            <span>loading radio...</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      ref={musicToggleRef}
                      type="button"
                      className={styles["music-player-toggle"]}
                      onClick={handleMusicToggle}
                      onMouseDown={() => setIsMusicTogglePressed(true)}
                      onMouseUp={() => setIsMusicTogglePressed(false)}
                      onMouseLeave={() => setIsMusicTogglePressed(false)}
                    >
                      <img
                        src={
                          !isMusicPaused
                            ? isMusicTogglePressed
                              ? "/images/pause_pressed.png"
                              : "/images/pause.png"
                            : isMusicTogglePressed
                              ? "/images/unpause_pressed.png"
                              : "/images/unpause.png"
                        }
                        alt={isMusicPaused ? "Play" : "Pause"}
                        className={styles["music-player-toggle-image"]}
                      />
                    </button>
                  </div>
                  <img src="/images/windowsXP_girl.jpg" alt="" className={styles["pretty-panel-image"]} />
                </div>
              </div>
            </div>
            <div className={styles["block3"]}>
              <div className={styles["info-block"]}>
                <div className={styles["info-card"]}>
                  <div className={styles["shape"]}></div>
                  <p className={styles["welcome-text"]}>
                    AeroWorld, или AeWo, — это анонимная социальная платформа для тех, кому близка атмосфера 
                    раннего интернета. Здесь вы можете общаться, делиться идеями и мыслями, находить новые 
                    связи и заниматься самовыражением. Ваши сообщения надежно зашифрованы, 
                  </p>
                  <div className={styles["welcome-text-2"]}>
                    <div className={styles["shape-2"]}></div>
                    <p>
                      а сам проект задуман как независимый уголок сети, 
                      где можно отдохнуть от алгоритмов.
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles["bottom-text-block"]}>
                <p style={{color: '#016caf', fontWeight: 'bold', fontStyle: "normal", fontSize: '16px'}}>Как и почему появилась AeWo?</p>
                <div className={styles["bottom-text-row"]}>
                  <img src="/images/426.png" alt="" className={styles["bottom-text-icon"]} />
                  <p>Весь сервис написан одним человеком (мной)</p>
                  <p>если в мире не было чего-то идеально подходящего под мои идеалы,
                    я делала это сама, иногда тратя на это месяцы :)
                  </p>
                  <img src="/images/miscellaneous_91.png" alt="" className={styles["bottom-text-icon-right"]} onClick={handleBottomTextIconRightClick}/>
                  <p>
                    Обнаружив огромную любовь к разработке еще будучи подростком,
                    у меня не могло быть альтернатив в самовыражении, кроме как создавать свое в сети.
                    Результатом этого конечно же стала AeWo!
                  </p>
                </div>
                <div className={styles["bottom-text-row"]}>
                  <img src="/images/397.png" alt="" className={styles["bottom-text-icon"]} />
                  <p>на этот проект у меня ушло уже около года, и он продолжает развиваться</p>
                  <p>По сути, все это - воплощение моего духа и творческого начала,
                    а также просто личный уголок в бескрайних просторах сети!!
                  </p>
                </div>
              </div>
              <div className={styles["white-text-block"]}>
                <div className={styles["info-header"]}>
                  Информация
                </div>
                <div className={styles["white-text-content"]}>
                  <p style={{ fontStyle: "italic", color: '#016caf', fontWeight: 'bold' }}>веб-сервис запущен 10-го июня 2026</p>
                  <p>Вы можете связаться со мной через <a href="mailto:example@email.com">почту</a>. Смело пишите, если у вас есть какие-либо предложения или вопросы!!</p>
                </div>
                <div className={styles["emojis"]} ref={whiteTextStripRef}>
                  {Array.from({ length: whiteTextSmileCount }).map((_, index) => (
                    <img key={index} src="/images/005.gif" alt=""className={styles["emoji"]}/>
                  ))}
                </div>
              </div>
              <div className={styles["visitor-count-block"]}>
                <div className={styles["visitor-count-title"]}>
                  вы посетитель под номером:
                </div>
                <div className={styles["visitor-count-row"]}>
                  {visitorCountDigits.map((digit, index) => (
                    <div key={`${digit}-${index}`} className={styles["visitor-count-bubble"]}>
                      <span>{digit}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles["rights-reserved"]}>© 2026 AeroWorld. All rights reserved.</div>
            </div>
            <div className={styles["block4"]}>
              <div className={styles["nav"]}>
                <div className={styles["nav-title"]}>Навигация</div>
                <div className={styles["nav-bottom"]}>
                  <div className={styles["nav-links"]}>
                    <a href="#">Главная</a>
                    <a href="/auth/signup">Зарегистрироваться</a>
                    <a href="https://t.me/AeroWorldlove">Телеграм канал</a>
                  </div>

                  <div className={styles["nav-note"]}>
                    веб-сервис на данный момент<br />
                    находится в разработке<br />
                    наберитесь терпения!
                  </div>
                </div>
              </div>
              <div className={styles["nav"]} style={{ marginTop: '12px', marginBottom: '12px', alignSelf: 'stretch', flex: '1 1 auto' }}>
                <div className={styles["nav-title"]} >
                  Обсуждение
                </div>
                <div className={styles["discussion-body"]}>
                  <div className={styles["discussion-messages"]} ref={discussionMessagesRef}>
                    {isDiscussionLoading ? (
                      <div className={styles["loading-indicator"]}>
                        <img src="/images/loading.gif" alt="" style={{ width: '30px', height: '30px'}}/>
                      </div>
                    ) : (
                      discussionMessages.map((message, index) => (
                        <p key={`${message.name}-${index}`}>
                          <span>{message.name}</span>: {message.text}
                        </p>
                      ))
                    )}
                  </div>
                  <div className={styles["discussion-form"]}>
                    <audio ref={discussionSendRef} src="/audio/navigation_start.wav" preload="auto" />
                    <audio ref={discussionErrorRef} src="/audio/chord.wav" preload="auto" />
                    <textarea
                      ref={discussionNameInputRef}
                      className={styles["discussion-name-input"]}
                      rows={1}
                      spellCheck={false}
                      placeholder="от имени…"
                      value={discussionName}
                      onChange={(event) => setDiscussionName(event.target.value)}
                      onKeyDown={handleDiscussionMessageKeyDown}
                    />
                    <div className={styles["discussion-send-box"]}>
                      <textarea
                        ref={discussionMessageInputRef}
                        className='retro-input'
                        rows={1}
                        placeholder="сообщение"
                        value={discussionMessage}
                        onChange={(event) => setDiscussionMessage(event.target.value)}
                        onKeyDown={handleDiscussionMessageKeyDown}
                        style={{
                          padding: '6px', fontSize: '13px', minHeight: '0', boxShadow: '2px 2px 2px rgba(68, 68, 68, 0.5)', flex: 1
                        }}
                      />
                      <button type="button" className={styles["discussion-send"]} title="Отправить сообщение" onClick={handleDiscussionSubmit}>
                        <img src="/images/AeroCircle01.png" alt="" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["update-log"]}>
                
                <div className={styles["update-log-list"]}>
                  <div className={styles["info-header"]}>
                    Обновления
                  </div>
                  <p><span className={styles["update-log-date"]}>2026-05-21</span>: доработана приветственная страница</p>
                  <p><span className={styles["update-log-date"]}>2026-05-17</span>: настроена прокрутка журнала обновлений</p>
                </div>
              </div>
            </div>      
          </div>
          <div className={styles["block5"]}>
            <div className={styles["link-my-site-border"]}>
              <div className={styles["link-my-site"]}>
                <div className={styles["link-my-site-content"]}>
                  <p>
                    Я очень стараюсь сделать AeroWorld таким местом, где можно самовыражаться и быть собой. Если вам понравился сайт, можете добавить ссылку на мой сайт к себе. Свяжитесь со мной,{" "} 
                    <img src="/images/oldweb-friendship.gif" alt="" className={styles["link-my-site-gif"]} />
                    чтобы я также указала ссылку на ваш сайт. Я буду рада {"<3"}
                  </p>
                  <textarea
                    className={styles["link-my-site-code"]}
                    rows={1}
                    readOnly
                    spellCheck={false}
                    value={'<a href="https://aeroworld.example">AeroWorld</a>'}
                  />
                </div>
              </div>
            </div>
            <div className={styles["blue-panel"]}>
              <div className={styles["blue-panel__top"]}>
                <div className={styles["blue-panel__top-accent"]}/>
              </div>
              <div className={styles["blue-panel__body"]}>
                <div/>
                <img src="/images/snail.png" alt="" className={styles["snail"]} />
                <img src="/images/hello_bubble.png" alt="" className={styles["hello"]} />
                <div className={styles["footer-wrap"]}>
                  <div className={styles["footer-content"]}>
                    <a href="mailto:example@email.com">Поддержка</a>
                    <a href="/faq">FAQ</a>
                    <a href="https://t.me/AeroWorldlove">Телеграм</a>
                    <a href="/links">Ссылки</a>
                    
                    <a href="/archive">Архив</a>
                    <a href="/music">Музыка</a>
                    <a href="/gallery">Галерея</a>
                    <a href="/donate" style={{ gridColumn: 3, gridRow: "2 / 4", alignSelf: "center", lineHeight: 1 }}>Поддержать<br />проект</a>
                  </div>
                  <div className={styles["footer-icons"]}>
                    <div className={styles["vista-frame"]}>
                      <img src="/images/icon1.png" alt="" className={styles["footer-frutiger-icon"]} />
                    </div>
                    <div className={styles["vista-frame"]}>
                      <img src="/images/icon2.png" alt="" className={styles["footer-frutiger-icon"]} />
                    </div>
                    <div className={styles["vista-frame"]}>
                      <img src="/images/icon3.png" alt="" className={styles["footer-frutiger-icon"]} />
                    </div>
                    <div className={styles["vista-frame"]}>
                      <img src="/images/icon4.png" alt="" className={styles["footer-frutiger-icon"]} />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles["blue-panel__bottom"]}>
                <div className={styles["blue-accent"]}/>
                <div className={styles["white-accent"]}/>
                <div className={styles["white-accent-end"]}/>
              </div>
              <div className={styles["blue-panel-glow"]} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;


