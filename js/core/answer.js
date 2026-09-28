// 解答（はじめ／あと の2ボックス）の操作と判定。DOMに依存しない純粋関数のみ。
// 項トークン（内部表現）: 'K'=運動 | 'U'=重力による位置 | '-U'=その負 | 'E'=弾性力による位置
// 画面・印刷では式の形で表示する。はじめ＝添字0、あと＝添字なし（例：½mv₀² + mgh₀ = ½mv² + mgh）

export const TERMS = ['K', 'U', 'E'];
export const TERM_ORDER = { K: 0, U: 1, '-U': 1, E: 2 };

export const TERM_INFO = {
  K: { name: '運動エネルギー', short: '運動', formula: '½mv²', start: '½mv₀²' },
  U: { name: '重力による位置エネルギー', short: '重力', formula: 'mgh', start: 'mgh₀' },
  E: { name: '弾性力による位置エネルギー', short: '弾性', formula: '½kx²', start: '½kx₀²' },
};

/** 項の式（side: 'start'＝はじめ（添字0）／'end'＝あと（添字なし））。−U は「−mgh」 */
export function termFormula(token, side = 'end') {
  const base = TERM_INFO[token === '-U' ? 'U' : token][side === 'start' ? 'start' : 'formula'];
  return token === '-U' ? `−${base}` : base;
}

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

/** 片側の式 例: formatSide(['K','-U'], 'end') → "½mv² − mgh" */
export function formatSide(terms, side = 'end') {
  if (!terms || terms.length === 0) return '0';
  return sortTerms(terms).map((t, i) => {
    const f = termFormula(t === '-U' ? 'U' : t, side);
    if (t === '-U') return i === 0 ? `−${f}` : ` − ${f}`;
    return i === 0 ? f : ` + ${f}`;
  }).join('');
}

/** 例: "mgh₀ = ½mv² − mgh" */
export function formatEquation(q) {
  if (q.applicable === false) return '保存則は使えない';
  return `${formatSide(q.start, 'start')} = ${formatSide(q.end, 'end')}`;
}

export function formatAnswer(a) {
  if (a.notApplicable) return '保存則は使えない';
  return `${formatSide(a.start, 'start')} = ${formatSide(a.end, 'end')}`;
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
