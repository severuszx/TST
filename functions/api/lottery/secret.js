// The Slow Tide 神秘潮汐 —— 密钥核销端点（密钥与兑换码存 Supabase，不在代码里）
const L_START = new Date('2026-10-01T00:30:00+08:00');
const L_END = new Date('2026-10-08T23:59:59+08:00');
let ADMIN_PWD = null; // 管理员口令：仅由 onRequest 从环境变量 ADMIN_PWD 注入（仓库不含口令）

function cnDate(d) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
async function adminLottery(action, payload) {
  if (!ADMIN_PWD) return { ok: false, error: 'no_pwd' };
  if (!ADMIN_PWD) return { ok: false, error: 'no_pwd' };
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
async function secretGate(device, sdate) {
  if (!device) return { err: 'bad_device' };
  const list = await adminLottery('list', {});
  if (!list || !list.ok || !Array.isArray(list.codes)) return { err: 'server_error' };
  const base = 'SCDEV:' + device + ':' + sdate;
  const keys = [base + ':1', base + ':2', base + ':3'];
  const exist = new Set((list.codes || []).map(c => c.code));
  for (let i = 0; i < 3; i++) {
    if (exist.has(keys[i])) continue;
    const add = await adminLottery('add', { code: keys[i], prize: '密钥输入标记', weight: 0 });
    if (add && add.ok) return { used: i + 1 };
    if (add && add.error === 'code_exists') continue;
    return { err: 'server_error' };
  }
  return { over: true };
}

export async function onRequestPost(context) {
  if (context && context.env && context.env.ADMIN_PWD) ADMIN_PWD = context.env.ADMIN_PWD;
  if (context && context.env && context.env.ADMIN_PWD) ADMIN_PWD = context.env.ADMIN_PWD;
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
  const device = String(body.device || '').slice(0, 80);
  if (!device) {
    return json({ sv: 'secret-file', ok: false, error: 'bad_device', serverDate: sdate }, 200, request);
  }
  const gate = await secretGate(device, sdate);
  if (gate && gate.over) {
    return json({ sv: 'secret-file', ok: false, error: 'no_chances', serverDate: sdate }, 200, request);
  }
  if (gate && gate.err) {
    return json({ sv: 'secret-file', ok: false, error: 'server', serverDate: sdate }, 200, request);
  }
  const res = await adminLottery('list', {});
  if (!res || !res.ok || !Array.isArray(res.codes)) {
    return json({ sv: 'secret-file', ok: false, error: 'server', serverDate: sdate }, 200, request);
  }
  const row = res.codes.find(c => String(c.prize || '').startsWith('神秘礼包'));
  if (!row || row.claimed || String(row.prize || '').startsWith('【已使用】')) {
    return json({ sv: 'secret-file', ok: false, error: 'used_up', serverDate: sdate }, 200, request);
  }
  if (key !== row.code) {
    return json({ sv: 'secret-file', ok: false, error: 'invalid', serverDate: sdate }, 200, request);
  }
  // 查看模式：不核销，可无限次查看（与抽奖独立控制；后台标已用即关闭）
  const code = extractCode(row.prize);
  return json({ sv: 'secret-file', ok: true, code: code, serverDate: sdate }, 200, request);
}
