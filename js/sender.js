// 段階3：Google Apps Script へ記録を送る（GAS_ENDPOINT が空なら無効）
import { GAS_ENDPOINT } from './config.js';

export const senderEnabled = () => !!GAS_ENDPOINT;

/**
 * CORS のプリフライトを避けるため Content-Type: text/plain で JSON を送る。
 * GAS 側は JSON.parse(e.postData.contents) で受け取る。
 */
export async function sendRecord(record) {
  if (!GAS_ENDPOINT) throw new Error('送信先が設定されていません');
  const body = JSON.stringify({ app: 'kedrill', ...record });
  try {
    const res = await fetch(GAS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    });
    const json = await res.json().catch(() => ({ ok: res.ok }));
    if (!json.ok) throw new Error(json.error || '送信に失敗しました');
    return true;
  } catch (err) {
    // 応答が読めない環境向けの予備（送信はされるが結果は確認できない）
    if (err instanceof TypeError) {
      await fetch(GAS_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
      return true;
    }
    throw err;
  }
}
