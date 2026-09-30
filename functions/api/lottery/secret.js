// The Slow Tide 神秘潮汐 —— 密钥核销端点（密钥与兑换码存 Supabase，不在代码里）
const L_START = new Date('2026-10-01T00:30:00+08:00');
const L_END = new Date('2026-10-08T23:59:59+08:00');
const ADMIN_PWD = (typeof context !== 'undefined' && context.env && context.env.ADMIN_PWD) ? context.env.ADMIN_PWD : 'WYJQQNDYWHM';

function cnDate(d) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
async function adminLottery(action, payload) {
  const r = await fetch('https://theslowtide.pages.dev/api/rest/rpc/admin_lottery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_pwd: ADMIN_PWD, p_action: action, p_payload: payload || {} }),
  });
  const text = await r.text();
  try { return text ? JSON.parse(text) : null; } catch (e) { return { raw: text.slice(0, 160) }; }
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
function extractCode(prize) {
  const m = String(prize || '').match(/[A-Z0-9]{8,}/);
  return m ? m[0] : '';
}

export async function onRequestPost(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') return json({}, 204, request);
  const now = new Date();
  const sdate = cnDate(now);
  if (now < L_START || now > L_END) {
    return json({ sv: 'secret-file', ok: false, error: 'not_in_window', serverDate: sdate }, 200, request);
  }
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  const key = String(body.key || '').trim().slice(0, 40);
  if (!key) {
    return json({ sv: 'secret-file', ok: false, error: 'invalid', serverDate: sdate }, 200, request);
  }
  const res = await adminLottery('list', {});
  if (!res || !res.ok || !Array.isArray(res.codes)) {
    return json({ sv: 'secret-file', ok: false, error: 'server', serverDate: sdate }, 200, request);
  }
  const row = res.codes.find(c => c.code === '08952870');
  if (!row || row.claimed || String(row.prize || '').startsWith('【已使用】')) {
    return json({ sv: 'secret-file', ok: false, error: 'used_up', serverDate: sdate }, 200, request);
  }
  if (key !== row.code) {
    return json({ sv: 'secret-file', ok: false, error: 'invalid', serverDate: sdate }, 200, request);
  }
  // 原子核销（持久化，防并发/冷启动重复领取）
  const up = await adminLottery('update_prize', { id: String(row.id), prize: '【已使用】' + (row.prize || '') });
  if (!up || !up.ok) {
    return json({ sv: 'secret-file', ok: false, error: 'retry', serverDate: sdate }, 200, request);
  }
  const code = extractCode(row.prize);
  return json({ sv: 'secret-file', ok: true, code: code, serverDate: sdate }, 200, request);
}
