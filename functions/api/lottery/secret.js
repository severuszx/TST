// The Slow Tide 神秘潮汐 —— 一次性密钥核销端点（独立于抽奖码池）
// 密钥 8952870 -> 兑换码 YBTYNGXDJJM（神秘礼包）；仅一人可领取
const SECRET_KEY = '8952870';
const SECRET_CODE = 'YBTYNGXDJJM';
const L_START = new Date('2026-10-01T00:30:00+08:00');
const L_END = new Date('2026-10-08T23:59:59+08:00');
const CLAIMED = new Set(); // isolate 内存：已领取标记

function cnDate(d) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
function json(obj, status, req) {
  const origin = req.headers.get('Origin') || '';
  const ok = ['https://theslowtide.pages.dev', 'https://theslowtidefk.pages.dev', 'http://localhost', 'http://127.0.0.1', 'null'];
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ok.includes(origin) ? origin : 'https://theslowtide.pages.dev',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

export async function onRequestPost(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') return json({}, 204, request);
  const now = new Date();
  const sdate = cnDate(now);
  if (now < L_START || now > L_END) {
    return json({ sv: 'secret-file', ok: false, error: 'not_in_window', serverDate: sdate }, 200, request);
  }
  if (CLAIMED.has(SECRET_KEY)) {
    return json({ sv: 'secret-file', ok: false, error: 'used_up', serverDate: sdate }, 200, request);
  }
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  const key = String(body.key || '').trim().slice(0, 40);
  if (key !== SECRET_KEY) {
    return json({ sv: 'secret-file', ok: false, error: 'invalid', serverDate: sdate }, 200, request);
  }
  CLAIMED.add(SECRET_KEY);
  return json({ sv: 'secret-file', ok: true, code: SECRET_CODE, serverDate: sdate }, 200, request);
}
