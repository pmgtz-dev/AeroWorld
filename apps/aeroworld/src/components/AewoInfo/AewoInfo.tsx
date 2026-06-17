"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./AewoInfo.module.scss";

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

const MARQUEE_SPEED_PX_PER_SEC = 20;
const MARQUEE_PAUSE_MS = 3000;

export default function AewoInfo() {
  const musicPlayerRef = useRef<HTMLAudioElement | null>(null);
  const navigationStartRef = useRef<HTMLAudioElement | null>(null);
  const musicTitleRef = useRef<HTMLDivElement | null>(null);
  const musicTitleTrackRef = useRef<HTMLDivElement | null>(null);
  const pendingRadioSnapshotRef = useRef<RadioSnapshot | null>(null);
  const radioPausedByUserRef = useRef(false);
  const isMusicPausedRef = useRef(true);
  const shouldStartRadioOnLoadRef = useRef(false);
  const [radioSnapshot, setRadioSnapshot] = useState<RadioSnapshot | null>(null);
  const [isMusicPaused, setIsMusicPaused] = useState(true);
  const [isMusicTogglePressed, setIsMusicTogglePressed] = useState(false);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const player = musicPlayerRef.current;
    if (!player) return;
    player.volume = volume;
  }, [volume]);

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

  useEffect(() => {
    const titleNode = musicTitleRef.current;
    const trackNode = musicTitleTrackRef.current;
    if (!titleNode || !trackNode) return;
    if (!radioSnapshot) {
      trackNode.style.transform = "translateY(-50%)";
      return;
    }
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

      const duration = Number.isFinite(player.duration)
        ? player.duration
        : nextSnapshot.track.durationSec;
      const safeTime = Math.max(
        0,
        Math.min(nextSnapshot.offsetSec, Math.max(0, duration - 0.25))
      );

      if (Math.abs(player.currentTime - safeTime) > 1.5) {
        player.currentTime = safeTime;
      }

    } catch {}
  };

  useEffect(() => {
    void syncRadioPlayback();
  }, []);

  useEffect(() => {
    const player = musicPlayerRef.current;
    const snapshot = pendingRadioSnapshotRef.current;
    if (!player || !snapshot || !radioSnapshot || radioSnapshot.track.id !== snapshot.track.id) return;

    const applyRadioSnapshot = async () => {
      const duration = Number.isFinite(player.duration)
        ? player.duration
        : snapshot.track.durationSec;
      const safeTime = Math.max(
        0,
        Math.min(snapshot.offsetSec, Math.max(0, duration - 0.25))
      );
      player.currentTime = safeTime;

      if (radioPausedByUserRef.current) {
        player.pause();
        setIsMusicPaused(true);
        return;
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

  const handleMusicToggle = async () => {
    const player = musicPlayerRef.current;
    const navigationStart = navigationStartRef.current;
    if (!player) return;
    if (navigationStart) {
      navigationStart.currentTime = 0;
      void navigationStart.play().catch(() => {});
    }

    if (player.paused) {
      radioPausedByUserRef.current = false;
      shouldStartRadioOnLoadRef.current = true;
      await syncRadioPlayback();
      if (musicPlayerRef.current?.readyState) {
        const started = await tryStartRadio();
        if (started) {
          shouldStartRadioOnLoadRef.current = false;
          setIsMusicPaused(false);
        }
      }
      return;
    }

    radioPausedByUserRef.current = true;
    shouldStartRadioOnLoadRef.current = false;
    player.pause();
    setIsMusicPaused(true);
  };

  return (
    <div className={styles["aewo-info-border"]}>
      <div className={styles["aewo-info"]}>
        <div className={styles["top"]}>
          <Link href="/" className={styles["logo-link"]} style={{ display: "inline-flex", alignSelf: "stretch", flex: "0 0 auto", height: "100%", maxHeight: "100%", lineHeight: 0 }}>
            <img className={styles["logo"]} src="/images/logo.png" alt="Logo" />
          </Link>
          <div className={styles["music-player-wrapper"]}>
            <div className={styles["music-player"]}>
              <audio
                ref={musicPlayerRef}
                src={radioSnapshot?.track.src}
                preload="auto"
                playsInline
                onPlay={() => setIsMusicPaused(false)}
                onPause={() => setIsMusicPaused(true)}
                onLoadedData={() => {
                  if (shouldStartRadioOnLoadRef.current) {
                    shouldStartRadioOnLoadRef.current = false;
                    void tryStartRadio();
                  }
                }}
                onEnded={() => {
                  void syncRadioPlayback();
                }}
              />
              <audio ref={navigationStartRef} src="/audio/navigation_start.wav" preload="auto" />
              <div className={styles["music-player-title"]} ref={musicTitleRef}>
                <div
                  className={styles["music-player-title-track"]}
                  ref={musicTitleTrackRef}
                >
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
                type="button"
                className={styles["music-player-toggle"]}
                onClick={() => void handleMusicToggle()}
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
            <div className={styles["music-player-volume-row"]}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className={styles["music-player-volume"]}
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
        <div className={styles["bottom"]}>
          <div className={styles["rights-reserved"]}>© 2026 AeroWorld. All rights reserved.</div>
        </div>
      </div>
    </div>
  );
}
