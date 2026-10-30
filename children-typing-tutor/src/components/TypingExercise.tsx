import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Pause, Play, RotateCcw, Star } from 'lucide-react';
import {
  accuracy,
  activeTime,
  createSession,
  expire,
  isTypingKey,
  pause,
  resume,
  speed,
  stars,
  typeKey,
  type Session,
} from '../lib/typing';
import { Keyboard } from './Keyboard';

export interface Activity {
  id: string;
  title: string;
  text: string;
  lessonId?: number;
  phase?: 'guided' | 'checkpoint';
  game?: 'trail' | 'balloons';
  limit?: number;
}

export function TypingExercise({
  activity,
  onComplete,
  onNext,
  onRetry,
  sound,
}: {
  activity: Activity;
  onComplete: (session: Session) => void;
  onNext: () => void;
  onRetry: () => void;
  sound: boolean;
}) {
  const [session, setSession] = useState(() => createSession(activity.text, activity.id));
  const [now, setNow] = useState(() => performance.now());
  const [caps, setCaps] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const awarded = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const percent = accuracy(session);
  const elapsed = activeTime(session, now);
  const done = session.status === 'done';
  const guided = activity.phase === 'guided';
  const unlocked = !activity.lessonId || guided || (percent ?? 0) >= 85;

  useEffect(() => {
    area.current?.focus();
    return () => {
      void audio.current?.close();
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = performance.now();
      setNow(current);
      if (activity.limit) setSession((previous) => expire(previous, current, activity.limit));
    }, 200);
    const suspend = () =>
      setSession((previous) => pause(previous, performance.now(), activity.limit));
    const visibility = () => {
      if (document.hidden) suspend();
    };
    window.addEventListener('blur', suspend);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('blur', suspend);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [activity.limit]);
  useEffect(() => {
    area.current
      ?.querySelector('.current')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [session.cursor]);
  useEffect(() => {
    if (done && !awarded.current) {
      awarded.current = true;
      onComplete(session);
    }
  }, [done, session, onComplete]);

  function chime() {
    if (!sound) return;
    try {
      const context = audio.current ?? new AudioContext();
      audio.current = context;
      void context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 620;
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.1);
    } catch {
      return;
    }
  }

  const progress = session.cursor / session.text.length;
  return (
    <div className="exercise">
      <div className="exercise-heading">
        <div>
          <span className="eyebrow">
            {guided
              ? 'STEP 01 · 跟着练'
              : activity.phase === 'checkpoint'
                ? 'STEP 02 · 自己试试'
                : activity.game
                  ? 'PLAY TIME'
                  : 'PRACTICE TIME'}
          </span>
          <h2>{activity.title}</h2>
        </div>
        <div className="exercise-tools" onMouseDown={(event) => event.preventDefault()}>
          <button className="icon-button" title="重新开始" aria-label="重新开始" onClick={onRetry}>
            <RotateCcw size={19} />
          </button>
          <button
            className="icon-button"
            title={session.status === 'paused' ? '继续练习' : '暂停练习'}
            aria-label={session.status === 'paused' ? '继续练习' : '暂停练习'}
            disabled={done}
            onClick={() => {
              setSession((previous) =>
                previous.status === 'paused'
                  ? resume(previous, performance.now())
                  : pause(previous, performance.now(), activity.limit),
              );
              area.current?.focus();
            }}
          >
            {session.status === 'paused' ? <Play size={19} /> : <Pause size={19} />}
          </button>
        </div>
      </div>
      <div className="session-stats">
        <span>
          准确率 <strong>{percent === null ? '—' : `${Math.floor(percent)}%`}</strong>
        </span>
        <span>
          打字速度{' '}
          <strong>
            {speed(session, now)} <small>WPM</small>
          </strong>
        </span>
        <span>
          {activity.limit ? '剩余时间' : '练习时间'}{' '}
          <strong>
            {Math.ceil(
              activity.limit ? Math.max(0, activity.limit - elapsed / 1000) : elapsed / 1000,
            )}{' '}
            <small>秒</small>
          </strong>
        </span>
        <span>
          已完成{' '}
          <strong>
            {session.cursor}/{session.text.length}
          </strong>
        </span>
      </div>
      {activity.game && (
        <div
          className={`game-stage ${activity.game}`}
          aria-label={activity.game === 'trail' ? '小岛探险场景' : '单词气球场景'}
        >
          {activity.game === 'trail' ? (
            <>
              <div className="trail-track" />
              <img
                src="./assets/bunny.svg"
                alt="探险兔兔"
                style={{ left: `${5 + progress * 77}%` }}
              />
              <span className="finish-flag">终点</span>
            </>
          ) : (
            <>
              <div
                className="balloon balloon-one"
                style={{ transform: `translateY(${-progress * 90}px)` }}
              >
                <span>
                  {session.text.slice(session.cursor).split(' ')[0]?.slice(0, 9) ||
                    (done ? '完成' : '空格')}
                </span>
              </div>
              <div
                className="balloon balloon-two"
                style={{ transform: `translateY(${-progress * 110}px)` }}
              />
              <div
                className="balloon balloon-three"
                style={{ transform: `translateY(${-progress * 70}px)` }}
              />
              <img src="./assets/bunny.svg" alt="放飞气球的兔兔" />
            </>
          )}
        </div>
      )}
      {!done ? (
        <>
          <div
            className={`typing-area ${session.lastWrong ? 'has-error' : ''}`}
            ref={area}
            tabIndex={0}
            role="group"
            aria-label="打字练习区"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                setSession((previous) => pause(previous, performance.now(), activity.limit));
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              setCaps(event.getModifierState('CapsLock'));
              if (isTypingKey(event.nativeEvent)) {
                event.preventDefault();
                const current = performance.now();
                if (session.status !== 'paused' && event.key === session.text[session.cursor])
                  chime();
                setNow(current);
                setSession((previous) =>
                  typeKey(expire(previous, current, activity.limit), event.nativeEvent, current),
                );
              }
            }}
          >
            <div className="target-text" aria-label={`目标文本：${session.text}`}>
              {[...session.text].map((letter, index) => (
                <span
                  key={index}
                  className={
                    index < session.cursor ? 'typed' : index === session.cursor ? 'current' : ''
                  }
                >
                  {letter === ' ' ? '\u2423' : letter}
                </span>
              ))}
            </div>
            <div className="input-message" aria-live="polite">
              {session.status === 'paused'
                ? '休息一下，准备好了再继续。'
                : session.lastWrong
                  ? `再试一次，目标是 ${session.text[session.cursor] === ' ' ? '空格' : session.text[session.cursor]}。`
                  : '准备好就轻轻敲下第一个字母。'}
            </div>
            {session.status === 'paused' && (
              <button
                className="primary"
                onClick={() => {
                  setSession((previous) => resume(previous, performance.now()));
                  area.current?.focus();
                }}
              >
                <Play size={17} />
                继续练习
              </button>
            )}
          </div>
          {caps && (
            <p className="notice" role="status">
              Caps Lock 已开启，留意字母的大小写。
            </p>
          )}
          <Keyboard target={session.text[session.cursor]} />
        </>
      ) : (
        <section className="result" aria-label="练习结果">
          <img src="./assets/bunny.svg" alt="开心的兔兔" />
          <div className="result-stars" aria-label={`${guided ? 0 : stars(percent ?? 0)}颗星`}>
            {[1, 2, 3].map((star) => (
              <Star
                key={star}
                fill={!guided && star <= stars(percent ?? 0) ? 'currentColor' : 'none'}
              />
            ))}
          </div>
          <h2>
            {guided ? '手指热身完成！' : unlocked ? '又前进了一小步！' : '再练一遍，会更稳！'}
          </h2>
          <p>
            {guided
              ? '接下来自己试试，不着急。'
              : activity.lessonId && !unlocked
                ? '小测达到 85% 准确率，就能探索下一课。'
                : '每一次认真练习，都值得一颗小星星。'}
          </p>
          <div className="button-row">
            <button className="secondary" onClick={onRetry}>
              <RotateCcw size={17} />
              再练一次
            </button>
            <button className="primary" onClick={unlocked ? onNext : onRetry}>
              {unlocked ? (guided ? '开始小测' : '继续探索') : '再试一次'}
              {unlocked ? <ArrowRight size={17} /> : <Check size={17} />}
            </button>
          </div>
        </section>
      )}
      <div
        className="session-progress"
        role="progressbar"
        aria-label="练习进度"
        aria-valuenow={session.cursor}
        aria-valuemin={0}
        aria-valuemax={session.text.length}
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
