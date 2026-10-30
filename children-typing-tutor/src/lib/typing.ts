export interface Session {
  id: string;
  text: string;
  cursor: number;
  attempts: number;
  correct: number;
  elapsed: number;
  since: number | null;
  status: 'ready' | 'active' | 'paused' | 'done';
  lastWrong: string | null;
}

export interface KeyInput {
  key: string;
  repeat?: boolean;
  isComposing?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export function createSession(text: string, id: string = crypto.randomUUID()): Session {
  return {
    id,
    text,
    cursor: 0,
    attempts: 0,
    correct: 0,
    elapsed: 0,
    since: null,
    status: text ? 'ready' : 'done',
    lastWrong: null,
  };
}

export function activeTime(session: Session, now: number): number {
  return session.elapsed + (session.since === null ? 0 : Math.max(0, now - session.since));
}

export function pause(session: Session, now: number): Session {
  if (session.status === 'done' || session.status === 'paused') return session;
  return { ...session, elapsed: activeTime(session, now), since: null, status: 'paused' };
}

export function resume(session: Session, now: number): Session {
  if (session.status !== 'paused') return session;
  return {
    ...session,
    status: session.attempts ? 'active' : 'ready',
    since: session.attempts ? now : null,
  };
}

export function finish(session: Session, now: number): Session {
  if (session.status === 'done') return session;
  return { ...session, status: 'done', elapsed: activeTime(session, now), since: null };
}

export function expire(session: Session, now: number, seconds = 0): Session {
  if (!seconds || session.status !== 'active' || activeTime(session, now) < seconds * 1000)
    return session;
  return finish(session, now - (activeTime(session, now) - seconds * 1000));
}

export function isTypingKey(input: KeyInput): boolean {
  return (
    !input.repeat &&
    !input.isComposing &&
    !input.ctrlKey &&
    !input.metaKey &&
    !input.altKey &&
    (input.key === 'Backspace' || (input.key.length === 1 && /^[\x20-\x7e]$/.test(input.key)))
  );
}

export function typeKey(session: Session, input: KeyInput, now: number): Session {
  if (session.status === 'paused' || session.status === 'done' || !isTypingKey(input))
    return session;
  if (input.key === 'Backspace')
    return { ...session, cursor: Math.max(0, session.cursor - 1), lastWrong: null };
  const correct = input.key === session.text[session.cursor];
  const next: Session = {
    ...session,
    status: 'active',
    since: session.since ?? now,
    attempts: session.attempts + 1,
    correct: session.correct + Number(correct),
    cursor: session.cursor + Number(correct),
    lastWrong: correct ? null : input.key,
  };
  return next.cursor === next.text.length ? finish(next, now) : next;
}

export function accuracy(session: Session): number | null {
  return session.attempts ? (session.correct / session.attempts) * 100 : null;
}

export function speed(session: Session, now: number): number {
  const minutes = activeTime(session, now) / 60000;
  return minutes > 0 ? Math.round(session.cursor / 5 / minutes) : 0;
}

export function stars(percent: number): number {
  return percent >= 100 ? 3 : percent >= 95 ? 2 : percent >= 85 ? 1 : 0;
}
