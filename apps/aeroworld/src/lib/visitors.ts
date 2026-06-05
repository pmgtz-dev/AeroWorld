import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type VisitorsStats = {
  recentUniqueVisitors: number;
  totalVisitors: number;
  updatedAt: string;
};

const VISITOR_WINDOW_MS = 12 * 60 * 60 * 1000;
const visitorIdsSeenInLastWindow = new Map<string, number>();
const visitorsStatsFileCandidates = [
  path.join(process.cwd(), "apps", "aeroworld", "public", "data", "visitiors_stats.json"),
  path.join(process.cwd(), "public", "data", "visitiors_stats.json"),
];

const getDefaultVisitorsStats = (): VisitorsStats => ({
  recentUniqueVisitors: 0,
  totalVisitors: 0,
  updatedAt: new Date().toISOString(),
});

const resolveVisitorsStatsFilePath = async () => {
  for (const candidate of visitorsStatsFileCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }

  return visitorsStatsFileCandidates[0];
};

const pruneRecentVisitors = (now: number) => {
  for (const [visitorId, lastSeenAt] of visitorIdsSeenInLastWindow) {
    if (now - lastSeenAt > VISITOR_WINDOW_MS) {
      visitorIdsSeenInLastWindow.delete(visitorId);
    }
  }
};

export const readVisitorsStats = async () => {
  try {
    const visitorsStatsFilePath = await resolveVisitorsStatsFilePath();
    const raw = await readFile(visitorsStatsFilePath, "utf-8");

    if (!raw.trim()) {
      return getDefaultVisitorsStats();
    }

    const parsed = JSON.parse(raw) as Partial<VisitorsStats>;
    return {
      recentUniqueVisitors: typeof parsed.recentUniqueVisitors === "number" ? parsed.recentUniqueVisitors : 0,
      totalVisitors: typeof parsed.totalVisitors === "number" ? parsed.totalVisitors : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return getDefaultVisitorsStats();
  }
};

export const registerVisitor = async (visitorId: string, isFirstTimeVisitor: boolean) => {
  const now = Date.now();
  pruneRecentVisitors(now);

  const isNewInRecentWindow = !visitorIdsSeenInLastWindow.has(visitorId);
  visitorIdsSeenInLastWindow.set(visitorId, now);

  const currentStats = await readVisitorsStats();
  const nextStats: VisitorsStats = {
    totalVisitors: isFirstTimeVisitor ? currentStats.totalVisitors + 1 : currentStats.totalVisitors,
    recentUniqueVisitors: visitorIdsSeenInLastWindow.size,
    updatedAt: new Date(now).toISOString(),
  };

  const visitorsStatsFilePath = await resolveVisitorsStatsFilePath();
  if (isFirstTimeVisitor || isNewInRecentWindow || currentStats.recentUniqueVisitors !== nextStats.recentUniqueVisitors) {
    await writeFile(visitorsStatsFilePath, `${JSON.stringify(nextStats, null, 2)}\n`, "utf-8");
  }

  return nextStats;
};
