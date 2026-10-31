import { describe, expect, it } from 'vitest';
import { fingerFor, knownKeys, lessons, practiceText, reviewText } from '../data/lessons';
import {
  award,
  BACKUP_MAX_BYTES,
  defaultProgress,
  exportBackup,
  loadProgress,
  parseProgress,
  passedCount,
  readBackup,
  saveProgress,
} from './progress';

describe('curriculum and persistence', () => {
  it('keeps valid imported records serializable after time overflow or a saturated cross-day award', () => {
    const hugeTime = { ...defaultProgress(), seconds: Number.MAX_VALUE };
    const afterTime = award(
      parseProgress(hugeTime),
      { id: 'huge-time', accuracy: 100, seconds: Number.MAX_VALUE },
      '2026-10-31',
    );
    expect(Number.isFinite(afterTime.seconds)).toBe(true);
    expect(readBackup(exportBackup(afterTime)).data).toEqual(afterTime);
    const saturated = {
      ...defaultProgress(),
      rounds: Number.MAX_SAFE_INTEGER,
      days: { '2026-10-30': Number.MAX_SAFE_INTEGER },
    };
    const afterDay = award(
      parseProgress(saturated),
      { id: 'next-day', accuracy: 100, seconds: 1 },
      '2026-10-31',
    );
    expect(() => parseProgress(afterDay)).not.toThrow();
    expect(readBackup(exportBackup(afterDay)).data).toEqual(afterDay);
  });
  it('isolates new records from old-version writes and preserves the original migration source', () => {
    const original = { ...defaultProgress(), version: 1, keyStats: undefined };
    const latest = award(defaultProgress(), {
      id: 'new-version',
      accuracy: 100,
      seconds: 1,
      keyStats: { f: { attempts: 2, correct: 1 } },
    });
    const values = new Map([
      ['typing-island-v1', JSON.stringify(original)],
      ['typing-island-v2', JSON.stringify(latest)],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(loadProgress(storage).data).toEqual(latest);
    expect(saveProgress(storage, latest)).toBe('');
    expect(values.get('typing-island-v1')).toBe(JSON.stringify(original));
    values.delete('typing-island-v2');
    expect(loadProgress(storage).data).toEqual(defaultProgress());
    values.set('typing-island-v2', '{broken');
    expect(loadProgress(storage).warning).not.toBe('');
  });
  it('prioritizes allowed weak keys without teaching locked characters', () => {
    const stats = {
      f: { attempts: 10, correct: 6 },
      j: { attempts: 4, correct: 3 },
      Z: { attempts: 100, correct: 0 },
    };
    const review = reviewText(stats, 'fj ');
    expect(review.keys).toEqual(['f', 'j']);
    expect(review.focused).toBe(true);
    expect([...review.text].every((key) => 'fj '.includes(key))).toBe(true);
    expect(reviewText({}, 'fj')).toEqual({
      text: 'fj'.repeat(6),
      keys: ['f', 'j'],
      focused: false,
    });
    expect(
      reviewText({ j: { attempts: 2, correct: 1 }, f: { attempts: 4, correct: 2 } }, 'fj').keys,
    ).toEqual(['f', 'j']);
    for (let passed = 0; passed <= 20; passed++) {
      const allowed = knownKeys(Math.max(0, passed - 1));
      expect([...reviewText(stats, allowed).text].every((key) => allowed.includes(key))).toBe(true);
    }
  });
  it('migrates valid 1.0 records without inventing key history', () => {
    const data = award(defaultProgress(), { id: 'old', accuracy: 95, seconds: 1.25, lessonId: 1 });
    const legacy = { ...data, version: 1, keyStats: undefined };
    expect(parseProgress(legacy)).toEqual(data);
    expect(readBackup(JSON.stringify(legacy)).data).toEqual(data);
    expect(legacy.version).toBe(1);
  });
  it('merges completed key statistics once, preserving uppercase and punctuation separately', () => {
    const keyStats = {
      f: { attempts: 3, correct: 2 },
      F: { attempts: 1, correct: 1 },
      '!': { attempts: 2, correct: 1 },
    };
    const first = award(defaultProgress(), { id: 'stats', accuracy: 80, seconds: 1, keyStats });
    expect(first.keyStats).toEqual(keyStats);
    expect(award(first, { id: 'stats', accuracy: 80, seconds: 1, keyStats })).toBe(first);
    const second = award(first, { id: 'new', accuracy: 80, seconds: 1, keyStats });
    expect(second.keyStats.f).toEqual({ attempts: 6, correct: 4 });
    expect(first.keyStats.f).toEqual({ attempts: 3, correct: 2 });
  });
  it('exports canonical data and roundtrips backups without keeping unexpected fields', () => {
    const data = award(defaultProgress(), {
      id: 'a',
      accuracy: 100,
      seconds: 0.5,
      lessonId: 1,
      keyStats: { f: { attempts: 1, correct: 1 } },
    });
    const text = exportBackup(
      { ...data, inputHistory: 'private text' } as typeof data,
      new Date('2026-10-31T00:00:00Z'),
    );
    expect(text).not.toContain('inputHistory');
    expect(text).not.toContain('private text');
    expect(readBackup(text)).toEqual({ data, createdAt: '2026-10-31T00:00:00.000Z' });
    const extraFields = JSON.parse(text);
    extraFields.data.keyStats.f.inputHistory = 'private keystrokes';
    expect(exportBackup(readBackup(JSON.stringify(extraFields)).data)).not.toContain(
      'private keystrokes',
    );
  });
  it('rejects corrupted, oversized, future, malformed date and invalid statistics backups', () => {
    for (const value of [
      { ...defaultProgress(), version: 3 },
      { ...defaultProgress(), games: 1 },
      { ...defaultProgress(), rounds: 1, lessons: { 20: { accuracy: 100, stars: 3 } } },
      { ...defaultProgress(), days: { '2026-10-31': 1 } },
      { ...defaultProgress(), keyStats: { f: { attempts: 1, correct: 1 } } },
      { ...defaultProgress(), days: { '2026-02-30': 1 } },
      { ...defaultProgress(), keyStats: { f: { attempts: 1, correct: 2 } } },
      { ...defaultProgress(), keyStats: { f: { attempts: 0.5, correct: 0 } } },
      { ...defaultProgress(), keyStats: { __proto__x: { attempts: 1, correct: 1 } } },
      { format: 'typing-island-backup', version: 2, data: defaultProgress() },
    ])
      expect(() => readBackup(JSON.stringify(value))).toThrow();
    expect(() => readBackup('{')).toThrow();
    expect(() => readBackup(' '.repeat(BACKUP_MAX_BYTES + 1))).toThrow(/1 MiB/);
  });
  it('never exports an oversized backup or makes a saturated counter invalid', () => {
    const days = Object.fromEntries(
      Array.from({ length: 60000 }, (_, index) => [
        new Date(Date.UTC(2000, 0, 1) + index * 86400000).toISOString().slice(0, 10),
        0,
      ]),
    );
    expect(() => exportBackup({ ...defaultProgress(), days })).toThrow(/1 MiB/);
    const saturated = {
      ...defaultProgress(),
      rounds: Number.MAX_SAFE_INTEGER,
      days: { '2026-10-31': Number.MAX_SAFE_INTEGER },
    };
    expect(
      parseProgress(award(saturated, { id: 'last', accuracy: 100, seconds: 0 }, '2026-10-31'))
        .rounds,
    ).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('maps every letter, taught punctuation and digit to the correct QWERTY finger', () => {
    const groups = ['qaz1', 'wsx2', 'edc3', 'rfvtgb45', 'yhnujm67', 'ik,8', 'ol.9', "p;/'0", ' '];
    groups.forEach((group, finger) => {
      for (const key of group) {
        expect(fingerFor(key)).toBe(finger);
        expect(fingerFor(key.toUpperCase())).toBe(finger);
      }
    });
    expect(fingerFor('!')).toBe(0);
  });
  it('games only generate keys from the unlocked course inventory', () => {
    for (let passed = 0; passed <= 20; passed++) {
      const allowed = knownKeys(passed);
      for (const kind of ['letters', 'words'] as const) {
        const text = practiceText(kind, allowed);
        expect(text.length).toBeGreaterThan(0);
        expect([...text].every((key) => allowed.includes(key))).toBe(true);
      }
    }
  });
  it('never asks for keys before teaching them', () => {
    let known = '';
    expect(lessons).toHaveLength(20);
    for (const lesson of lessons) {
      known += lesson.keys;
      for (const key of lesson.guided + lesson.checkpoint)
        expect(known, `lesson ${lesson.id}: ${key}`).toContain(key);
    }
  });
  it('unlocks only at 85%, preserves best and ignores duplicate rewards', () => {
    let data = award(defaultProgress(), { id: 'a', accuracy: 100, seconds: 0, lessonId: 1 });
    data = award(data, { id: 'b', accuracy: 84.9, seconds: 10, lessonId: 2 });
    expect(passedCount(data)).toBe(1);
    data = award(data, { id: 'c', accuracy: 95, seconds: 10, lessonId: 2 });
    expect(passedCount(data)).toBe(2);
    expect(award(data, { id: 'c', accuracy: 95, seconds: 10, lessonId: 2 })).toBe(data);
    data = award(data, { id: 'd', accuracy: 85, seconds: 10, lessonId: 2 });
    expect(data.lessons[2].stars).toBe(2);
    expect(data.rounds).toBe(4);
  });
  it('cannot award a locked lesson', () => {
    expect(
      award(defaultProgress(), { id: 'x', accuracy: 100, seconds: 1, lessonId: 20 }).lessons,
    ).toEqual({});
  });
  it('rejects fractional and unsafe completion counts without rejecting fractional scores or time', () => {
    const data = award(defaultProgress(), { id: 'a', accuracy: 85.5, seconds: 1.25, lessonId: 1 });
    for (const invalid of [
      { ...data, rounds: 1.5 },
      { ...data, games: 0.5 },
      { ...data, rounds: Number.MAX_SAFE_INTEGER + 1 },
      { ...data, days: { '2026-10-31': 1.5 } },
    ]) {
      expect(
        loadProgress({ getItem: () => JSON.stringify(invalid), setItem() {} }).warning,
      ).not.toBe('');
    }
    expect(loadProgress({ getItem: () => JSON.stringify(data), setItem() {} }).data).toEqual(data);
  });
  it('roundtrips valid progress and tolerates corrupt, invalid or blocked storage', () => {
    const data = award(defaultProgress(), { id: 'a', accuracy: 100, seconds: 1, lessonId: 1 });
    expect(loadProgress({ getItem: () => JSON.stringify(data), setItem() {} }).data).toEqual(data);
    for (const raw of [
      '{',
      '{"version":2}',
      JSON.stringify({ ...data, seconds: -1 }),
      JSON.stringify({ ...data, lessons: { 1: { accuracy: 100, stars: 0 } } }),
    ]) {
      expect(loadProgress({ getItem: () => raw, setItem() {} }).warning).not.toBe('');
    }
    const blocked = {
      getItem(): never {
        throw new Error();
      },
      setItem(): never {
        throw new Error();
      },
    };
    expect(loadProgress(blocked).warning).not.toBe('');
    expect(saveProgress(blocked, data)).not.toBe('');
  });
});
