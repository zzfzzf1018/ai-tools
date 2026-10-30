import { describe, expect, it } from 'vitest';
import {
  accuracy,
  activeTime,
  createSession,
  expire,
  finish,
  pause,
  resume,
  speed,
  stars,
  typeKey,
} from './typing';

describe('shared typing engine', () => {
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
