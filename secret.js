

const L_START = new Date('2026-10-01T00:30:00+08:00');
const L_END = new Date('2026-10-08T23:59:59+08:00');
let ADMIN_PWD = null; 

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
function clientIp(req) {
  return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown';
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
  if (!key) return json({ sv: 'secret-file', ok: false, error: 'invalid', serverDate: sdate }, 200, request);
  const ip = clientIp(request);
  const res = await adminLottery('list', {});
  if (!res || !res.ok || !Array.isArray(res.codes)) {
    return json({ sv: 'secret-file', ok: false, error: 'server', serverDate: sdate }, 200, request);
  }
  
  const unlocked = res.codes.find(c => c.code === 'SCIP:' + ip + ':' + sdate + ':unlocked');
  if (unlocked) {
    const row2 = res.codes.find(c => String(c.prize || '').startsWith('神秘礼包'));
    if (!row2) return json({ sv: 'secret-file', ok: false, error: 'used_up', serverDate: sdate }, 200, request);
    const code2 = extractCode(row2.prize);
    return json({ sv: 'secret-file', ok: true, code: code2, unlocked: true, serverDate: sdate }, 200, request);
  }
  
  const tries = res.codes.filter(c => String(c.code || '').startsWith('SCIP:' + ip + ':' + sdate + ':t'));
  if (tries.length >= 3) {
    return json({ sv: 'secret-file', ok: false, error: 'no_chances', serverDate: sdate }, 200, request);
  }
  const row = res.codes.find(c => String(c.prize || '').startsWith('神秘礼包'));
  if (!row || row.claimed || String(row.prize || '').startsWith('【已使用】')) {
    return json({ sv: 'secret-file', ok: false, error: 'used_up', serverDate: sdate }, 200, request);
  }
  if (key !== row.code) {
    
    await adminLottery('add', { code: 'SCIP:' + ip + ':' + sdate + ':t' + Date.now(), prize: '密钥尝试', weight: 0 });
    return json({ sv: 'secret-file', ok: false, error: 'invalid', serverDate: sdate }, 200, request);
  }
  
  await adminLottery('add', { code: 'SCIP:' + ip + ':' + sdate + ':unlocked', prize: '密钥已解锁', weight: 0 });
  const code = extractCode(row.prize);
  return json({ sv: 'secret-file', ok: true, code: code, serverDate: sdate }, 200, request);
}
