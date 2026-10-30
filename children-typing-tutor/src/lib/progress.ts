import { lessons } from '../data/lessons';
import { stars } from './typing';

export const STORAGE_KEY = 'typing-island-v1';
export interface Progress {
  version: 1;
  lessons: Record<string, { accuracy: number; stars: number }>;
  settings: { sound: boolean; reducedMotion: boolean };
  rounds: number;
  games: number;
  seconds: number;
  days: Record<string, number>;
  recent: string[];
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const defaultProgress = (): Progress => ({
  version: 1,
  lessons: {},
  settings: { sound: false, reducedMotion: false },
  rounds: 0,
  games: 0,
  seconds: 0,
  days: {},
  recent: [],
});
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function loadProgress(storage: StorageLike): { data: Progress; warning: string } {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { data: defaultProgress(), warning: '' };
    const value: unknown = JSON.parse(raw);
    if (
      !record(value) ||
      value.version !== 1 ||
      !record(value.lessons) ||
      !record(value.settings) ||
      typeof value.settings.sound !== 'boolean' ||
      typeof value.settings.reducedMotion !== 'boolean' ||
      !count(value.rounds) ||
      !count(value.games) ||
      !count(value.seconds) ||
      !record(value.days) ||
      !Array.isArray(value.recent) ||
      !value.recent.every((id) => typeof id === 'string') ||
      !Object.values(value.days).every(count)
    )
      throw new Error('Invalid progress');
    for (const [id, result] of Object.entries(value.lessons)) {
      if (
        !lessons.some((lesson) => String(lesson.id) === id) ||
        !record(result) ||
        !count(result.accuracy) ||
        result.accuracy > 100 ||
        result.stars !== stars(result.accuracy)
      )
        throw new Error('Invalid lesson');
    }
    return { data: value as unknown as Progress, warning: '' };
  } catch {
    return { data: defaultProgress(), warning: '学习记录暂时无法读取，本次仍可正常练习。' };
  }
}

export function saveProgress(storage: StorageLike, data: Progress): string {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  result: { id: string; accuracy: number; seconds: number; lessonId?: number; game?: boolean },
  day = localDay(),
): Progress {
  if (
    progress.recent.includes(result.id) ||
    !count(result.accuracy) ||
    result.accuracy > 100 ||
    !count(result.seconds)
  )
    return progress;
  const next = {
    ...progress,
    lessons: { ...progress.lessons },
    rounds: progress.rounds + 1,
    games: progress.games + Number(!!result.game),
    seconds: progress.seconds + result.seconds,
    days: { ...progress.days, [day]: (progress.days[day] ?? 0) + 1 },
    recent: [...progress.recent.slice(-99), result.id],
  };
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
