// 図テンプレート（assets/diagrams/<ID>.svg）の読み込みと描画
const cache = new Map();
let serial = 0;

const escapeXml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function loadDiagrams(ids, base = 'assets/diagrams/') {
  await Promise.all(ids.map(async id => {
    const res = await fetch(`${base}${id}.svg`);
    if (!res.ok) throw new Error(`図 ${id}.svg を読み込めません`);
    cache.set(id, await res.text());
  }));
}

/** 物体ラベルを差し込んだSVG文字列。同じ図を同一画面に複数置けるよう内部IDを一意化 */
export function renderDiagram(id, label = '') {
  const src = cache.get(id);
  if (!src) return `<div class="dg-missing">図 ${escapeXml(id)} がありません</div>`;
  const n = ++serial;
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{obj\}\}/g, escapeXml(label))
    .replace(new RegExp(`\\b${id}-(hatch|vel|dim)\\b`, 'g'), `${id}-${n}-$1`);
}
