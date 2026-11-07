/**
 * 出题引擎
 * ------------------------------------------------------------
 * 三种题型：
 *   en2zh  看英文选中文
 *   zh2en  看中文选英文
 *   spell  看中文/音标拼写
 *
 * 干扰项从同频段随机抽取，并保证释义互不相同，
 * 避免出现"两个选项都对"的歧义。
 */

import { shuffled } from './util.js';

export const QUESTION_TYPE = Object.freeze({
  EN2ZH: 'en2zh',
  ZH2EN: 'zh2en',
  SPELL: 'spell',
});

/** 太短或含特殊字符的词不适合拼写题 */
function spellable(word) {
  return word.length >= 3 && word.length <= 24 && /^[a-zA-Z][a-zA-Z'-]*$/.test(word);
}

/**
 * 功能词（冠词/介词/连词/代词/助动词/数词）不适合考释义或拼写：
 * 它们的中文解释是一串语法说明，作为题干既啰嗦又没有区分度。
 * 这类词只考"看英文选中文"。
 */
function isFunctionWord(meaning) {
  return /^(?:art|prep|conj|pron|aux|num|int|ad)\./.test(String(meaning || '').trim());
}

function pickDistractors(wordbook, target, count, rand) {
  const sameLevel = wordbook.byLevel(target.level);
  const pool = sameLevel.length >= count * 6 ? sameLevel : wordbook.allIndices();
  const picked = [];
  const used = new Set([target.meaning, target.word.toLowerCase()]);
  let guard = 0;
  const limit = Math.min(2000, pool.length * 4);

  while (picked.length < count && guard < limit) {
    guard += 1;
    const idx = pool[Math.floor(rand() * pool.length)];
    if (idx === undefined || idx === target.index) continue;
    const candidate = wordbook.wordAt(idx);
    if (!candidate || !candidate.meaning) continue;
    const key = candidate.meaning;
    if (used.has(key) || used.has(candidate.word.toLowerCase())) continue;
    used.add(key);
    picked.push(candidate);
  }

  // 极端情况下（词库过小）允许放宽去重条件
  if (picked.length < count) {
    for (const idx of pool) {
      if (picked.length >= count) break;
      if (idx === target.index) continue;
      const candidate = wordbook.wordAt(idx);
      if (candidate && candidate.meaning) picked.push(candidate);
    }
  }
  return picked;
}

/**
 * 生成一道题
 * @param {object} params
 * @param {object} params.wordbook
 * @param {number} params.index 目标词索引
 * @param {string} params.mode choice | spell | mixed
 * @param {() => number} params.rand 随机源
 */
export function buildQuestion({ wordbook, index, mode = 'mixed', rand = Math.random }) {
  const target = wordbook.wordAt(index);
  if (!target) throw new RangeError(`词条索引越界：${index}`);

  const grammarWord = isFunctionWord(target.meaning);
  const allowSpell = spellable(target.word) && !grammarWord;

  let type;
  if (grammarWord) {
    type = QUESTION_TYPE.EN2ZH;
  } else if (mode === 'spell') {
    type = allowSpell ? QUESTION_TYPE.SPELL : QUESTION_TYPE.EN2ZH;
  } else if (mode === 'choice') {
    type = rand() < 0.5 ? QUESTION_TYPE.EN2ZH : QUESTION_TYPE.ZH2EN;
  } else {
    const roll = rand();
    if (roll < 0.28 && allowSpell) type = QUESTION_TYPE.SPELL;
    else type = roll < 0.64 ? QUESTION_TYPE.EN2ZH : QUESTION_TYPE.ZH2EN;
  }

  if (type === QUESTION_TYPE.SPELL) {
    return {
      index,
      type,
      target,
      options: [],
      answer: target.word,
      hint: `${target.word.length} 个字符，首字母 ${target.word[0].toUpperCase()}`,
    };
  }

  const distractors = pickDistractors(wordbook, target, 3, rand);
  const items = shuffled([target, ...distractors], rand);
  const isEn2Zh = type === QUESTION_TYPE.EN2ZH;

  return {
    index,
    type,
    target,
    options: items.map((item) => ({
      key: item.word,
      text: isEn2Zh ? item.meaning : item.word,
      // 中文选项不附带英文，避免选项本身泄露答案
      meta: isEn2Zh ? '' : item.phonetic,
      correct: item.word === target.word,
    })),
    answer: isEn2Zh ? target.meaning : target.word,
    hint: '',
  };
}

/** 拼写答案归一化 */
export function normalizeSpelling(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ');
}

/** 判定作答是否正确 */
export function checkAnswer(question, response) {
  if (!question) return false;
  if (question.type === QUESTION_TYPE.SPELL) {
    return normalizeSpelling(response) === normalizeSpelling(question.answer);
  }
  const key = typeof response === 'string' ? response : response?.key;
  const option = question.options.find((o) => o.key === key);
  return !!option && option.correct;
}
