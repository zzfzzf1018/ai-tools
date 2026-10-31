import { describe, expect, it } from 'vitest';
import { fingerFor, knownKeys, lessons, practiceText } from '../data/lessons';
import { award, defaultProgress, loadProgress, passedCount, saveProgress } from './progress';

describe('curriculum and persistence', () => {
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
