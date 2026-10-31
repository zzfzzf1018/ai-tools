import { lessons } from '../data/lessons';
import { stars, type KeyStats } from './typing';

export const STORAGE_KEY = 'typing-island-v2';
export const LEGACY_STORAGE_KEY = 'typing-island-v1';
export interface Progress {
  version: 2;
  lessons: Record<string, { accuracy: number; stars: number }>;
  settings: { sound: boolean; reducedMotion: boolean };
  rounds: number;
  games: number;
  seconds: number;
  days: Record<string, number>;
  recent: string[];
  keyStats: KeyStats;
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const defaultProgress = (): Progress => ({
  version: 2,
  lessons: {},
  settings: { sound: false, reducedMotion: false },
  rounds: 0,
  games: 0,
  seconds: 0,
  days: {},
  recent: [],
  keyStats: {},
});
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const completionCount = (value: unknown): value is number =>
  count(value) && Number.isSafeInteger(value);

function validKeyStats(value: unknown): value is KeyStats {
  return (
    record(value) &&
    Object.entries(value).every(
      ([key, counts]) =>
        /^[\x20-\x7e]$/.test(key) &&
        record(counts) &&
        completionCount(counts.attempts) &&
        counts.attempts > 0 &&
        completionCount(counts.correct) &&
        counts.correct <= counts.attempts,
    )
  );
}

export function parseProgress(value: unknown): Progress {
  if (
    !record(value) ||
    (value.version !== 1 && value.version !== 2) ||
    !record(value.lessons) ||
    !record(value.settings) ||
    typeof value.settings.sound !== 'boolean' ||
    typeof value.settings.reducedMotion !== 'boolean' ||
    !completionCount(value.rounds) ||
    !completionCount(value.games) ||
    !count(value.seconds) ||
    !record(value.days) ||
    !Array.isArray(value.recent) ||
    value.recent.length > 100 ||
    !value.recent.every(
      (id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 128,
    ) ||
    !Object.entries(value.days).every(
      ([day, rounds]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(day) &&
        completionCount(rounds) &&
        Number.isFinite(Date.parse(`${day}T12:00:00Z`)) &&
        new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day,
    ) ||
    (value.version === 2 && !validKeyStats(value.keyStats))
  )
    throw new Error('Invalid progress');
  if (
    value.games > value.rounds ||
    value.recent.length > value.rounds ||
    Object.keys(value.lessons).length > value.rounds ||
    Object.values(value.days).reduce<number>(
      (sum, rounds) => sum + (typeof rounds === 'number' ? rounds : 0),
      0,
    ) > value.rounds ||
    (value.version === 2 &&
      value.rounds === 0 &&
      Object.keys(value.keyStats as KeyStats).length > 0)
  )
    throw new Error('Inconsistent progress');
  const lessonResults: Progress['lessons'] = {};
  for (const [id, result] of Object.entries(value.lessons)) {
    if (
      !lessons.some((lesson) => String(lesson.id) === id) ||
      !record(result) ||
      !count(result.accuracy) ||
      result.accuracy > 100 ||
      result.stars !== stars(result.accuracy)
    )
      throw new Error('Invalid lesson');
    lessonResults[id] = { accuracy: result.accuracy, stars: stars(result.accuracy) };
  }
  const days: Progress['days'] = {};
  for (const [day, rounds] of Object.entries(value.days)) {
    if (completionCount(rounds)) days[day] = rounds;
  }
  const keyStats: KeyStats = {};
  if (value.version === 2 && validKeyStats(value.keyStats)) {
    for (const [key, counts] of Object.entries(value.keyStats))
      keyStats[key] = { attempts: counts.attempts, correct: counts.correct };
  }
  const data: Progress = {
    version: 2,
    lessons: lessonResults,
    settings: { sound: value.settings.sound, reducedMotion: value.settings.reducedMotion },
    rounds: value.rounds,
    games: value.games,
    seconds: value.seconds,
    days,
    recent: value.recent.filter((id: unknown): id is string => typeof id === 'string'),
    keyStats,
  };
  if (Object.keys(data.lessons).some((id) => Number(id) > passedCount(data) + 1))
    throw new Error('Invalid lesson prerequisites');
  return data;
}

export function loadProgress(storage: StorageLike): { data: Progress; warning: string } {
  try {
    const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_STORAGE_KEY);
    return { data: raw === null ? defaultProgress() : parseProgress(JSON.parse(raw)), warning: '' };
  } catch {
    return { data: defaultProgress(), warning: '学习记录暂时无法读取，本次仍可正常练习。' };
  }
}

export function saveProgress(storage: StorageLike, data: Progress): string {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(parseProgress(data)));
    return '';
  } catch {
    return '无法保存学习记录，请检查浏览器存储权限。本次仍可练习。';
  }
}

export function passedCount(progress: Progress): number {
  let passed = 0;
  for (const lesson of lessons) {
    if ((progress.lessons[lesson.id]?.stars ?? 0) < 1) break;
    passed++;
  }
  return passed;
}

export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function award(
  progress: Progress,
  result: {
    id: string;
    accuracy: number;
    seconds: number;
    lessonId?: number;
    game?: boolean;
    keyStats?: KeyStats;
  },
  day = localDay(),
): Progress {
  if (
    progress.recent.includes(result.id) ||
    !count(result.accuracy) ||
    result.accuracy > 100 ||
    !count(result.seconds) ||
    (result.keyStats !== undefined && !validKeyStats(result.keyStats))
  )
    return progress;
  const canIncrement = progress.rounds < Number.MAX_SAFE_INTEGER;
  const next = {
    ...progress,
    lessons: { ...progress.lessons },
    rounds: Math.min(Number.MAX_SAFE_INTEGER, progress.rounds + 1),
    games: Math.min(
      Number.MAX_SAFE_INTEGER,
      progress.games + Number(!!result.game && canIncrement),
    ),
    seconds: Math.min(Number.MAX_VALUE, progress.seconds + result.seconds),
    days: canIncrement
      ? { ...progress.days, [day]: (progress.days[day] ?? 0) + 1 }
      : { ...progress.days },
    recent: [...progress.recent.slice(-99), result.id],
    keyStats: { ...progress.keyStats },
  };
  for (const [key, counts] of Object.entries(result.keyStats ?? {})) {
    const previous = next.keyStats[key] ?? { attempts: 0, correct: 0 };
    next.keyStats[key] = {
      attempts: Math.min(Number.MAX_SAFE_INTEGER, previous.attempts + counts.attempts),
      correct: Math.min(Number.MAX_SAFE_INTEGER, previous.correct + counts.correct),
    };
  }
  if (
    result.lessonId &&
    result.lessonId <= passedCount(progress) + 1 &&
    lessons.some((lesson) => lesson.id === result.lessonId)
  ) {
    const best = Math.max(progress.lessons[result.lessonId]?.accuracy ?? 0, result.accuracy);
    next.lessons[result.lessonId] = { accuracy: best, stars: stars(best) };
  }
  return next;
}

export const BACKUP_MAX_BYTES = 1024 * 1024;

export function exportBackup(data: Progress, date = new Date()): string {
  const text = JSON.stringify(
    {
      format: 'typing-island-backup',
      version: 1,
      createdAt: date.toISOString(),
      data: parseProgress(data),
    },
    null,
    2,
  );
  if (new TextEncoder().encode(text).byteLength > BACKUP_MAX_BYTES)
    throw new Error('备份超过 1 MiB，暂时无法导出。');
  return text;
}

export function readBackup(text: string): { data: Progress; createdAt: string | null } {
  if (new TextEncoder().encode(text).byteLength > BACKUP_MAX_BYTES)
    throw new Error('备份文件不能超过 1 MiB。');
  try {
    const value: unknown = JSON.parse(text);
    if (record(value) && 'format' in value) {
      if (
        value.format !== 'typing-island-backup' ||
        value.version !== 1 ||
        typeof value.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(value.createdAt))
      )
        throw new Error('Invalid backup');
      return { data: parseProgress(value.data), createdAt: value.createdAt };
    }
    return { data: parseProgress(value), createdAt: null };
  } catch {
    throw new Error('这不是有效的打字小岛备份，或记录版本暂不支持。现有记录没有改变。');
  }
}
