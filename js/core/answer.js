// 解答（はじめ／あと の2ボックス）の操作と判定。DOMに依存しない純粋関数のみ。
// 項トークン: 'K' | 'U' | '-U' | 'E'

export const TERMS = ['K', 'U', 'E'];
export const TERM_ORDER = { K: 0, U: 1, '-U': 1, E: 2 };

export const TERM_INFO = {
  K: { name: '運動エネルギー', formula: '½mv²' },
  U: { name: '重力による位置エネルギー', formula: 'mgh' },
  E: { name: '弾性力による位置エネルギー', formula: '½kx²' },
};

export function emptyAnswer() {
  return { start: [], end: [], notApplicable: false };
}

/** 並びを K, U, E の順に整える（表示・比較用） */
export function sortTerms(terms) {
  return [...terms].sort((a, b) => TERM_ORDER[a] - TERM_ORDER[b]);
}

/**
 * タイル（K/U/E）をボックスに対して押したときの遷移。
 * - 未配置 → 配置（U は +U）
 * - K/E 配置済み → 取り消し
 * - +U → −U → 取り消し（チップ再タップと同じ3段トグル）
 */
export function pressTerm(box, term) {
  const list = [...box];
  if (term === 'U') {
    if (list.includes('U')) return sortTerms(list.map(t => (t === 'U' ? '-U' : t)));
    if (list.includes('-U')) return list.filter(t => t !== '-U');
    return sortTerms([...list, 'U']);
  }
  if (list.includes(term)) return list.filter(t => t !== term);
  return sortTerms([...list, term]);
}

/** 配置済みチップをタップしたとき（+U→−U→削除、K/Eは削除） */
export function tapChip(box, token) {
  return pressTerm(box, token === '-U' ? 'U' : token);
}

/** 集合として一致するか（順序は問わない、U は符号込み） */
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  if (sa.size !== a.length) return false;
  return b.every(t => sa.has(t));
}

/** 判定。question は patterns をマージ済みのもの */
export function judge(question, answer) {
  if (question.applicable === false) return answer.notApplicable === true;
  if (answer.notApplicable) return false;
  return sameSet(question.start, answer.start) && sameSet(question.end, answer.end);
}

/** 表示用文字列 例: "K + U = K + (−U)" */
export function formatSide(terms) {
  if (!terms || terms.length === 0) return '0';
  return sortTerms(terms).map(t => (t === '-U' ? '(−U)' : t)).join(' + ');
}

export function formatEquation(q) {
  if (q.applicable === false) return '保存則は使えない';
  return `${formatSide(q.start)} = ${formatSide(q.end)}`;
}

export function formatAnswer(a) {
  if (a.notApplicable) return '保存則は使えない';
  return `${formatSide(a.start)} = ${formatSide(a.end)}`;
}

/**
 * 1回目の誤答で出すヒントを選ぶ（仕様書 v2 6.2・10.1）
 * @returns {string[]} 表示するヒント文（違っている行ごと）
 */
export function hintsFor(question, answer, commonHints = {}) {
  if (question.applicable === false) return [question.hint?.equation].filter(Boolean);
  if (answer.notApplicable) return [commonHints.notApplicable].filter(Boolean);
  const out = [];
  if (!sameSet(question.start, answer.start)) out.push({ side: 'はじめ', text: question.hint?.start });
  if (!sameSet(question.end, answer.end)) out.push({ side: 'あと', text: question.hint?.end });
  return out.filter(h => h.text).map(h => `【${h.side}】${h.text}`);
}
