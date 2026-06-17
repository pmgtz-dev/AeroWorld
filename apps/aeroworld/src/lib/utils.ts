const months = ["янв.","февр.","март","апр.","мая","июн.","июл.","авг.","сен.","окт.","нояб.","дек."];

export function formatTime (date?: string) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const time = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;

  const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const msgDay = new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const diff = (today.getTime()-msgDay.getTime())/86400000;

  if (diff === 0) return time;
  if (diff === 1) return `Вчера, ${time}`;

  return `${d.getDate()} ${months[d.getMonth()]} ${time}`;
};

type LastSeenInput = Date | string | number | null | undefined;

export function formatLastSeen(input: LastSeenInput): string {
  if (!input) return "";

  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return "только что"; 

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "только что";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {

    const m = diffMin;
    const word =
      m % 10 === 1 && m % 100 !== 11
        ? "минуту"
        : m % 10 >= 2 && m % 10 <= 4 && (m % 100 < 10 || m % 100 >= 20)
        ? "минуты"
        : "минут";
    return `${m} ${word} назад`;
  }

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

  if (d >= startOfToday) {
    return `сегодня в ${hhmm}`;
  }
  if (d >= startOfYesterday && d < startOfToday) {
    return `вчера в ${hhmm}`;
  }

  return `${d.getDate()} ${months[d.getMonth()]} в ${hhmm}`;
}

export function formatPreciseDateTime(input?: string | null): string {
  if (!input) return "";

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const time = `${hh}:${mm}:${ss}`;

  if (today.getTime() === targetDay.getTime()) {
    return `Сегодня, ${time}`;
  }
  if (yesterday.getTime() === targetDay.getTime()) {
    return `Вчера, ${time}`;
  }
  return `${d.getDate()} ${months[d.getMonth()]} ${time}`;
}
