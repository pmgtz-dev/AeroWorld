import { access, readdir } from "node:fs/promises";
import path from "node:path";

import { parseFile } from "music-metadata";

export type RadioTrack = {
  durationSec: number;
  fileName: string;
  id: string;
  src: string;
  title: string;
};

export type RadioSnapshot = {
  cycleDurationSec: number;
  offsetSec: number;
  serverTimeMs: number;
  stationStartedAtMs: number;
  track: RadioTrack;
  trackEndsAtMs: number;
  trackIndex: number;
  trackStartedAtMs: number;
};

const RADIO_STATION_STARTED_AT_MS = Date.UTC(2026, 4, 20, 0, 0, 0);

let radioTracksPromise: Promise<RadioTrack[]> | null = null;
let radioFolderPathPromise: Promise<string> | null = null;

const normalizeRadioTitle = (fileName: string) =>
  decodeURIComponent(fileName)
    .replace(/\.mp3$/i, "")
    .replace(/\[colon\]/gi, ":")
    .trim();

const getRadioFolderPath = async () => {
  if (!radioFolderPathPromise) {
    radioFolderPathPromise = (async () => {
      const candidates = [
        path.join(process.cwd(), "apps", "aeroworld", "public", "audio", "radio"),
        path.join(process.cwd(), "public", "audio", "radio"),
      ];

      for (const candidate of candidates) {
        try {
          await access(candidate);
          return candidate;
        } catch {
          continue;
        }
      }

      throw new Error("Could not resolve radio folder path");
    })();
  }

  return radioFolderPathPromise;
};

const createRadioTrack = async (fileName: string, index: number): Promise<RadioTrack> => {
  const absolutePath = path.join(await getRadioFolderPath(), fileName);
  const metadata = await parseFile(absolutePath);
  const durationSec = metadata.format.duration;
  const metadataTitle = metadata.common.title?.trim();

  if (!durationSec || !Number.isFinite(durationSec)) {
    throw new Error(`Could not read duration for radio track "${fileName}"`);
  }

  return {
    durationSec,
    fileName,
    id: `radio-track-${index}`,
    src: `/audio/radio/${encodeURIComponent(fileName)}`,
    title: metadataTitle ? normalizeRadioTitle(metadataTitle) : normalizeRadioTitle(fileName),
  };
};

export const getRadioTracks = async (): Promise<RadioTrack[]> => {
  if (!radioTracksPromise) {
    radioTracksPromise = (async () => {
      const radioFolderPath = await getRadioFolderPath();
      const entries = await readdir(radioFolderPath, { withFileTypes: true });
      const fileNames = entries
        .filter((entry) => entry.isFile() && /\.mp3$/i.test(entry.name))
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));

      return Promise.all(fileNames.map((fileName, index) => createRadioTrack(fileName, index)));
    })();
  }

  return radioTracksPromise;
};

export const getRadioSnapshot = async (serverTimeMs = Date.now()): Promise<RadioSnapshot> => {
  const radioTracks = await getRadioTracks();

  if (radioTracks.length === 0) {
    throw new Error("Radio folder is empty");
  }

  const radioCycleDurationSec = radioTracks.reduce((total, track) => total + track.durationSec, 0);
  const elapsedSec = Math.max(0, (serverTimeMs - RADIO_STATION_STARTED_AT_MS) / 1000);
  const cyclePositionSec = ((elapsedSec % radioCycleDurationSec) + radioCycleDurationSec) % radioCycleDurationSec;

  let accumulatedDurationSec = 0;

  for (let index = 0; index < radioTracks.length; index += 1) {
    const track = radioTracks[index];
    const trackEndSec = accumulatedDurationSec + track.durationSec;

    if (cyclePositionSec < trackEndSec) {
      const offsetSec = cyclePositionSec - accumulatedDurationSec;
      const trackStartedAtMs = serverTimeMs - offsetSec * 1000;

      return {
        cycleDurationSec: radioCycleDurationSec,
        offsetSec,
        serverTimeMs,
        stationStartedAtMs: RADIO_STATION_STARTED_AT_MS,
        track,
        trackEndsAtMs: trackStartedAtMs + track.durationSec * 1000,
        trackIndex: index,
        trackStartedAtMs,
      };
    }

    accumulatedDurationSec = trackEndSec;
  }

  const fallbackTrack = radioTracks[0];

  return {
    cycleDurationSec: radioCycleDurationSec,
    offsetSec: 0,
    serverTimeMs,
    stationStartedAtMs: RADIO_STATION_STARTED_AT_MS,
    track: fallbackTrack,
    trackEndsAtMs: serverTimeMs + fallbackTrack.durationSec * 1000,
    trackIndex: 0,
    trackStartedAtMs: serverTimeMs,
  };
};
