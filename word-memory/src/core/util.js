/**
 * 通用工具函数：时间、数值、随机数、格式化
 * 纯函数，无副作用，可在浏览器与 Node 中通用。
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** 两位补零 */
export function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

/** 本地日期键：YYYY-MM-DD */
export function dateKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 当天 00:00:00.000 的时间戳（本地时区） */
export function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 两个时间戳相差的整天数（忽略时分秒） */
export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

/** 把日期键解析回时间戳（当天 0 点） */
export function parseDateKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return NaN;
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  return date.getTime();
}

/** 数值夹取 */
export function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** 可复现的伪随机数生成器（mulberry32） */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 洗牌（不改原数组） */
export function shuffled(list, rand = Math.random) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 从数组中随机取一个 */
export function sample(list, rand = Math.random) {
  if (!list.length) return undefined;
  return list[Math.floor(rand() * list.length)];
}

/** 防抖 */
export function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
}

/** 毫秒 → 人类可读的间隔描述 */
export function humanizeDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '现在';
  const minutes = ms / MINUTE;
  if (minutes < 1) return '不到 1 分钟';
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const hours = ms / HOUR;
  if (hours < 24) return `${Math.round(hours)} 小时`;
  const days = ms / DAY;
  if (days < 30) return `${Math.round(days)} 天`;
  const months = days / 30;
  if (months < 12) return `${months.toFixed(1).replace(/\.0$/, '')} 个月`;
  const years = days / 365;
  return `${years.toFixed(1).replace(/\.0$/, '')} 年`;
}

/** 毫秒 → mm:ss 或 h:mm:ss */
export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** 百分比 */
export function percent(part, total, digits = 0) {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(digits)}%`;
}

/** 安全整数解析 */
export function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}
