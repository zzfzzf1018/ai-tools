import { useState } from 'react';
import { ArrowRight, Keyboard } from 'lucide-react';
import type { KeyStats } from '../lib/typing';

export function KeyProgress({ stats, onReview }: { stats: KeyStats; onReview: () => void }) {
  const [mode, setMode] = useState<'lowercase' | 'uppercase' | 'symbols'>('lowercase');
  const keys =
    mode === 'lowercase'
      ? 'abcdefghijklmnopqrstuvwxyz'
      : mode === 'uppercase'
        ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        : "1234567890 ;',.!/";
  return (
    <section className="key-progress" aria-label="按键足迹">
      <div className="section-title">
        <h2>
          <Keyboard size={19} />
          按键足迹
        </h2>
        <button className="text-button" onClick={onReview}>
          开始专项复习
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="segmented" aria-label="按键类型">
        {(['lowercase', 'uppercase', 'symbols'] as const).map((value) => (
          <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>
            {value === 'lowercase' ? '小写' : value === 'uppercase' ? '大写' : '数字与标点'}
          </button>
        ))}
      </div>
      <div className="mastery-grid" role="list" aria-label="按键熟练度">
        {[...keys].map((key) => {
          const counts = stats[key];
          const percent = counts ? Math.floor((counts.correct / counts.attempts) * 100) : null;
          const state = !counts
            ? 'untouched'
            : counts.attempts < 5
              ? 'starting'
              : (percent ?? 0) >= 95
                ? 'steady'
                : 'growing';
          const label =
            state === 'untouched'
              ? '未练习'
              : state === 'starting'
                ? '刚开始'
                : state === 'steady'
                  ? '很稳'
                  : '继续巩固';
          const name = key === ' ' ? '空格' : key;
          const detail = `${name}：${label}，${counts ? `正确 ${counts.correct} 次 / 尝试 ${counts.attempts} 次` : '尚无记录'}`;
          return (
            <div
              className={`mastery-key ${state}`}
              data-key={key}
              role="listitem"
              aria-label={detail}
              title={detail}
              key={key}
            >
              <strong>{name}</strong>
              <small>{percent === null ? '—' : `${percent}%`}</small>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
