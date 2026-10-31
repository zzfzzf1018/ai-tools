import type { KeyStats } from '../lib/typing';

export interface Lesson {
  id: number;
  title: string;
  chapter: number;
  keys: string;
  instruction: string;
  tip: string;
  guided: string;
  checkpoint: string;
}

export const chapters = ['启航准备', '基准键小岛', '树梢字母岛', '花园字母岛', '单词与故事岛'];

export const lessons: Lesson[] = [
  {
    id: 1,
    title: '你好，键盘！',
    chapter: 0,
    keys: '',
    instruction: '坐稳小椅子，双脚放平，肩膀放松。让手腕轻轻抬起，不要压在桌边。',
    tip: '看一看键盘：字母在中间，长长的空格键在下面。先找到它们，不用着急敲。',
    guided: '',
    checkpoint: '',
  },
  {
    id: 2,
    title: '找到 F 和 J',
    chapter: 1,
    keys: 'fj',
    instruction: '用左手食指找到 F，右手食指找到 J。摸摸键上的小凸点，这就是手指的家。',
    tip: '每敲一个键，手指都回到小凸点上。轻轻按，不用用力。',
    guided: 'fffjjjfjfj',
    checkpoint: 'fjfjffjjfjfj',
  },
  {
    id: 3,
    title: '左手的小伙伴',
    chapter: 1,
    keys: 'dsa',
    instruction: '左手中指放 D，无名指放 S，小指放 A，食指留在 F。',
    tip: '四根手指各有自己的家：A S D F。',
    guided: 'asdfasdf',
    checkpoint: 'fdsasdfaafds',
  },
  {
    id: 4,
    title: '右手也归位',
    chapter: 1,
    keys: 'kl;',
    instruction: '右手食指 J，中指 K，无名指 L，小指分号键。',
    tip: '分号键就在 L 的右边。双手轻轻弯曲，像抱着小球。',
    guided: 'jkl;jkl;',
    checkpoint: 'jkl;lkjjk;l;',
  },
  {
    id: 5,
    title: '基准行集合',
    chapter: 1,
    keys: '',
    instruction: '双手一起出发！左手 A S D F，右手 J K L 和分号。',
    tip: '先看清目标键，再用它的小主人去按。准确比快更重要。',
    guided: 'asdfjkl;',
    checkpoint: 'asdfjkl;fdsa;lkj',
  },
  {
    id: 6,
    title: '食指与空格',
    chapter: 1,
    keys: 'gh ',
    instruction: '左食指从 F 伸到 G，右食指从 J 伸到 H，再回家。大拇指负责空格。',
    tip: '空格会显示成小横线，按一次就够啦。',
    guided: 'fg jh fg jh',
    checkpoint: 'fg hj gh fj gh',
  },
  {
    id: 7,
    title: '第一座小桥',
    chapter: 1,
    keys: '',
    instruction: '用学会的按键搭起小桥，试试这些短短的组合。',
    tip: '换手时也不用紧张，敲完就回基准行。',
    guided: 'dad sad lad',
    checkpoint: 'a lad asks dad',
  },
  {
    id: 8,
    title: '食指向上探险',
    chapter: 2,
    keys: 'rtyu',
    instruction: '左食指向上找 R、T，右食指向上找 Y、U。',
    tip: '手掌留在原位，让食指伸出去再回来。',
    guided: 'fr ft jy ju',
    checkpoint: 'try dry jug rug',
  },
  {
    id: 9,
    title: '中指的树叶',
    chapter: 2,
    keys: 'ei',
    instruction: '左中指从 D 向上找 E，右中指从 K 向上找 I。',
    tip: 'D 和 E 是一组，K 和 I 是一组。',
    guided: 'de ki de ki',
    checkpoint: 'ride kite red like',
  },
  {
    id: 10,
    title: '无名指的礼物',
    chapter: 2,
    keys: 'wo',
    instruction: '左无名指从 S 向上找 W，右无名指从 L 向上找 O。',
    tip: '慢一点，让无名指也练得稳稳的。',
    guided: 'sw lo sw lo',
    checkpoint: 'wood yellow flower',
  },
  {
    id: 11,
    title: '小指摘星星',
    chapter: 2,
    keys: 'qp',
    instruction: '左小指从 A 向上找 Q，右小指从分号键向上找 P。',
    tip: '小指力气小，轻轻按下就可以。',
    guided: 'aq ;p aq ;p',
    checkpoint: 'quiet happy puppy',
  },
  {
    id: 12,
    title: '树梢岛的约定',
    chapter: 2,
    keys: '',
    instruction: '树梢上的字母都认识啦！用双手写几个单词。',
    tip: '记得用拇指轻按空格，把单词分开。',
    guided: 'play with joy',
    checkpoint: 'a little star is happy',
  },
  {
    id: 13,
    title: '食指去花园',
    chapter: 3,
    keys: 'vbnm',
    instruction: '左食指向下找 V、B，右食指向下找 N、M。B 在这套课程里由左食指负责。',
    tip: '低头看一眼没关系，慢慢熟悉位置就好。',
    guided: 'fv fb jn jm',
    checkpoint: 'moon bunny brave',
  },
  {
    id: 14,
    title: '中指的小花',
    chapter: 3,
    keys: 'c,',
    instruction: '左中指从 D 向下找 C，右中指从 K 向下找逗号。',
    tip: '逗号让句子歇一小会儿。',
    guided: 'dc k, dc k,',
    checkpoint: 'cat, cake, cloud',
  },
  {
    id: 15,
    title: '无名指的种子',
    chapter: 3,
    keys: 'x.',
    instruction: '左无名指向下找 X，右无名指向下找句号。',
    tip: '按完 X 回到 S，按完句号回到 L。',
    guided: 'sx l. sx l.',
    checkpoint: 'six foxes. a box.',
  },
  {
    id: 16,
    title: '小指的秘密',
    chapter: 3,
    keys: 'z/',
    instruction: '左小指向下找 Z，右小指向下找斜杠。所有字母都学会了！',
    tip: '这是英文键盘上的斜杠，不需要按 Shift。',
    guided: 'az ;/ az ;/',
    checkpoint: 'zebra/fox lazy/quick',
  },
  {
    id: 17,
    title: '我的单词花园',
    chapter: 4,
    keys: '',
    instruction: '让认识的字母变成单词，把它们种进花园。',
    tip: '先读一个词，再慢慢敲。不认识词义也可以练习。',
    guided: 'sun moon star',
    checkpoint: 'happy little bunny loves music',
  },
  {
    id: 18,
    title: '大写的魔法',
    chapter: 4,
    keys: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    instruction: '按住 Shift，再按字母，就能写大写。尽量用另一只手按 Shift。',
    tip: '例如大写 F：右手按住 Shift，左食指按 F。放开 Shift 再写小写。',
    guided: 'F J Hi Hello',
    checkpoint: 'Hello Lily Happy Day',
  },
  {
    id: 19,
    title: '标点小派对',
    chapter: 4,
    keys: "'!",
    instruction: '右小指找到分号右边的单引号键。感叹号用左小指按 1、右手按住 Shift。',
    tip: '句号、逗号、空格和大小写都要看仔细。',
    guided: "Hi! It's fun.",
    checkpoint: "Hello, friend! Let's play.",
  },
  {
    id: 20,
    title: '写下小小故事',
    chapter: 4,
    keys: '',
    instruction: '最后一次小冒险：用双手写下自己的第一段英文小故事。',
    tip: '不必赶时间。每一个认真敲出的字母，都是你的进步。',
    guided: 'The sun is warm.',
    checkpoint: 'A little fox sees a star. It is a happy day!',
  },
];

export const fingerNames = [
  '左小指',
  '左无名指',
  '左中指',
  '左食指',
  '右食指',
  '右中指',
  '右无名指',
  '右小指',
  '大拇指',
];
const fingerGroups = [
  'qaz1',
  'wsx2',
  'edc3',
  'rfvtgb45',
  'yhnujm67',
  'ik,8',
  'ol.9',
  "p;/['0-]=",
  ' ',
];
export function fingerFor(key: string): number {
  if (key === '!') return 0;
  return Math.max(
    0,
    fingerGroups.findIndex((group) => group.includes(key.toLowerCase())),
  );
}

export function knownKeys(passed: number): string {
  return lessons
    .slice(0, Math.max(2, passed + 1))
    .map((lesson) => lesson.keys)
    .join('');
}

export function practiceText(kind: 'letters' | 'words' | 'sentences', allowed?: string): string {
  if (kind === 'letters') {
    const keys = allowed
      ? [...new Set(allowed.toLowerCase())].filter((key) => /[a-z]/.test(key)).join('') || 'fj'
      : 'asdfjklfghj';
    return keys.repeat(6);
  }
  const words = [
    'a',
    'dad',
    'sad',
    'lad',
    'flag',
    'star',
    'red',
    'kite',
    'play',
    'happy',
    'sun',
    'moon',
    'cat',
    'fox',
    'zebra',
  ];
  if (allowed) {
    const available = words.filter((word) => [...word].every((key) => allowed.includes(key)));
    return available.length && allowed.includes(' ')
      ? [...available, ...available].join(' ')
      : practiceText('letters', allowed);
  }
  return kind === 'words'
    ? words.join(' ')
    : 'The little fox has a kite. We play in the sun. Hello, happy world!';
}

export function reviewText(
  stats: KeyStats,
  allowed: string,
): { text: string; keys: string[]; focused: boolean } {
  const weak = Object.entries(stats)
    .filter(([key, counts]) => allowed.includes(key) && counts.attempts > counts.correct)
    .sort(
      ([firstKey, first], [secondKey, second]) =>
        (second.attempts - second.correct) / second.attempts -
          (first.attempts - first.correct) / first.attempts ||
        second.attempts - second.correct - (first.attempts - first.correct) ||
        firstKey.localeCompare(secondKey),
    )
    .slice(0, 6)
    .map(([key]) => key);
  const keys = weak.length
    ? weak
    : [...new Set(allowed)].filter((key) => /[a-z]/.test(key)).slice(0, 6);
  if (!keys.length) keys.push('f', 'j');
  const text = Array.from({ length: 6 }, () => keys.join('')).join(
    allowed.includes(' ') ? ' ' : '',
  );
  return { text, keys, focused: weak.length > 0 };
}
