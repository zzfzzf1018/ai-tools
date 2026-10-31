import { describe, expect, it, vi } from 'vitest';
import {
  accuracy,
  activeTime,
  createSession,
  createSessionId,
  expire,
  finish,
  pause,
  resume,
  speed,
  stars,
  typeKey,
} from './typing';

describe('shared typing engine', () => {
  it('keeps key aggregates equal to session totals across ignored keys, pause and backspace', () => {
    let session = typeKey(createSession('fjf'), { key: 'f' }, 0);
    for (const input of [
      { key: 'j', repeat: true },
      { key: 'j', isComposing: true },
      { key: 'j', ctrlKey: true },
      { key: 'j', metaKey: true },
      { key: 'j', altKey: true },
    ])
      expect(typeKey(session, input, 50)).toBe(session);
    session = typeKey(session, { key: 'x' }, 100);
    session = pause(session, 200);
    expect(typeKey(session, { key: 'j' }, 500)).toBe(session);
    session = typeKey(resume(session, 1000), { key: 'j' }, 1100);
    const beforeBackspace = session.keyStats;
    session = typeKey(session, { key: 'Backspace' }, 1200);
    expect(session.keyStats).toBe(beforeBackspace);
    session = typeKey(session, { key: 'j' }, 1300);
    session = typeKey(session, { key: 'f' }, 1400);
    expect(session.keyStats).toEqual({
      f: { attempts: 2, correct: 2 },
      j: { attempts: 3, correct: 2 },
    });
    expect(Object.values(session.keyStats).reduce((sum, counts) => sum + counts.attempts, 0)).toBe(
      session.attempts,
    );
    expect(Object.values(session.keyStats).reduce((sum, counts) => sum + counts.correct, 0)).toBe(
      session.correct,
    );
    expect(accuracy(session)).toBe(80);
  });
  it('aggregates attempts by target key without saving wrong input or forgiving backspace', () => {
    const initial = createSession('fj');
    let session = typeKey(initial, { key: 'x' }, 0);
    session = typeKey(session, { key: 'f' }, 100);
    session = typeKey(session, { key: 'Backspace' }, 200);
    session = typeKey(session, { key: 'f' }, 300);
    session = typeKey(session, { key: 'j' }, 400);
    expect(session.keyStats).toEqual({
      f: { attempts: 3, correct: 2 },
      j: { attempts: 1, correct: 1 },
    });
    expect(initial.keyStats).toEqual({});
    expect(accuracy(session)).toBe(75);
    expect(typeKey(session, { key: 'j' }, 500)).toBe(session);
  });
  it('uses cryptographic random values when randomUUID is unavailable', () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal('crypto', { getRandomValues });
    try {
      const first = createSessionId();
      expect(first).toMatch(/^[a-f0-9]{32}$/);
      expect(createSession('fj').id).not.toBe(first);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('does not advance on mistakes, never forgives errors on backspace', () => {
    let session = createSession('fj');
    session = typeKey(session, { key: 'x' }, 1000);
    expect(session.cursor).toBe(0);
    session = typeKey(session, { key: 'f' }, 2000);
    session = typeKey(session, { key: 'Backspace' }, 2100);
    session = typeKey(session, { key: 'f' }, 2200);
    session = typeKey(session, { key: 'j' }, 3000);
    expect(session.status).toBe('done');
    expect(accuracy(session)).toBe(75);
    expect(session.attempts).toBe(4);
  });
  it.each([
    { key: 'f', repeat: true },
    { key: 'f', isComposing: true },
    { key: 'f', ctrlKey: true },
    { key: 'f', metaKey: true },
    { key: 'f', altKey: true },
    { key: 'Shift' },
    { key: '你' },
  ])('ignores %j', (input) => {
    const session = createSession('fj');
    expect(typeKey(session, input, 0)).toBe(session);
  });
  it('excludes pause time and waits for first printable attempt', () => {
    let session = createSession('fj');
    expect(activeTime(session, 100000)).toBe(0);
    session = typeKey(session, { key: 'f' }, 1000);
    session = pause(session, 2000);
    expect(typeKey(session, { key: 'j' }, 5000)).toBe(session);
    session = resume(session, 10000);
    session = typeKey(session, { key: 'j' }, 11000);
    expect(session.elapsed).toBe(2000);
    expect(activeTime(session, 100000)).toBe(2000);
  });
  it('is terminal and handles empty/zero-time sessions safely', () => {
    const empty = createSession('');
    expect(empty.status).toBe('done');
    expect(accuracy(empty)).toBeNull();
    expect(speed(empty, 0)).toBe(0);
    const done = typeKey(createSession('f'), { key: 'f' }, 100);
    expect(typeKey(done, { key: 'f' }, 200)).toBe(done);
    expect(finish(done, 200)).toBe(done);
  });
  it('ends at the exact active-time limit, rejects keys after deadline, and excludes breaks', () => {
    let session = typeKey(createSession('fjfj'), { key: 'f' }, 1000);
    expect(expire(session, 60999, 60).status).toBe('active');
    session = pause(session, 2000);
    expect(expire(session, 999999, 60).status).toBe('paused');
    session = resume(session, 100000);
    session = expire(session, 160000, 60);
    expect(session.status).toBe('done');
    expect(session.elapsed).toBe(60000);
    expect(typeKey(session, { key: 'j' }, 160000)).toBe(session);
  });
  it('finishes at the deadline when pause arrives before the timer refresh', () => {
    const active = typeKey(createSession('fjfj'), { key: 'f' }, 1000);
    const expired = pause(active, 61001, 60);
    expect(expired.status).toBe('done');
    expect(expired.elapsed).toBe(60000);
    expect(resume(expired, 90000)).toBe(expired);
  });
  it.each([
    [84.99, 0],
    [85, 1],
    [94.99, 1],
    [95, 2],
    [99.99, 2],
    [100, 3],
  ])('awards %s%% -> %s stars', (percent, expected) => {
    expect(stars(percent)).toBe(expected);
  });
});
