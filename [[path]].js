// Cloudflare Pages Functions - The Slow Tide 官网 API 代理
// /api/auth/* -> Supabase Auth；/api/rest/* -> Supabase REST
// /api/data、/api/admin -> 转发到数据服务站点（解决前端写死域名问题，K27JL4）
// 抽奖加固（表3）：draw_lottery IP 每日限速 + 服务端时间窗校验 + serverDate 注入 + 状态查询
// CORS 仅放行本站与反馈站（299K8H）

const SUPABASE_URL = 'https://jilcbcodphxpasicjghv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGNiY29kcGh4cGFzaWNqZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDUzNTgsImV4cCI6MjEwNDE4MTM1OH0._DkyiWyL5viXByCJ5ejFifn9RuEVkVHjAnU4oQepsbs';
const DATA_ORIGIN = 'https://tst-server-site.pages.dev';

// 抽奖 IP 每日限速表（isolate 内存；无 KV 绑定的尽力方案，配合服务端数据库去重共同防刷）
const LOTTERY_IP_MAP = new Map();
const LOTTERY_START = new Date(2026, 8, 25, 0, 0, 0);   // 2026-09-25 00:00
const LOTTERY_END = new Date(2026, 8, 27, 23, 59, 59);  // 2026-09-27 23:59:59

function allowedOrigin(req) {
  const origin = req.headers.get('Origin') || '';
  const ok = ['https://theslowtide.pages.dev', 'https://theslowtidefk.pages.dev', 'http://localhost', 'http://127.0.0.1', 'null'];
  return ok.includes(origin) ? origin : '';
}
function corsHeaders(req) {
  const origin = allowedOrigin(req);
  return {
    'Access-Control-Allow-Origin': origin || 'https://theslowtide.pages.dev',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}
function json(obj, status, req) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });
}
function todayStr(d) {
  const dt = d || new Date();
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
function clientIp(req) {
  return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown';
}

async function proxyFetch(target, request) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
  const upstream = await fetch(target, { method: request.method, headers: headers, body: body, redirect: 'manual' });
  const respHeaders = new Headers(upstream.headers);
  respHeaders.set('Access-Control-Allow-Origin', allowedOrigin(request) || 'https://theslowtide.pages.dev');
  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(request) });
  }

  // ===== 抽奖状态查询（KKE58L：状态不再只依赖 localStorage）=====
  if (path === '/api/lottery/state' && request.method === 'GET') {
    const ip = clientIp(request);
    const key = 'lot:' + ip + ':' + todayStr(new Date());
    const rec = LOTTERY_IP_MAP.get(key);
    return json({
      drawn: !!rec,
      prize: rec ? rec.prize : null,
      code: rec ? rec.code : null,
      seq: rec ? rec.seq : null,
      serverDate: todayStr(new Date()),
    }, 200, request);
  }

  // ===== 抽奖接口加固（表3：ZXEHVW/N2U9QF/RCNY7C/CPUY9G/WNG6WE/Q92XS4/69G5XT/7P9HW4）=====
  if (path === '/api/rest/rpc/draw_lottery' && request.method === 'POST') {
    const now = new Date();
    const sdate = todayStr(now);
    // 1) 服务端时间窗校验（7P9HW4：不再只信前端时间）
    if (now < LOTTERY_START || now > LOTTERY_END) {
      return json({ ok: false, error: 'not_in_window', serverDate: sdate }, 200, request);
    }
    // 2) IP 每日限速（ZXEHVW 等防刷：换浏览器/无痕/改参数均受 IP 兜底）
    const ip = clientIp(request);
    const key = 'lot:' + ip + ':' + sdate;
    const rec = LOTTERY_IP_MAP.get(key);
    if (rec) {
      return json({ ok: false, error: 'already_drawn', prize: rec.prize, code: rec.code, seq: rec.seq, serverDate: rec.date }, 200, request);
    }
    // 3) 转发到 Supabase draw_lottery（服务端数据库函数保证原子性与去重）
    const bodyBuf = await request.arrayBuffer();
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('apikey', SUPABASE_ANON);
    headers.set('authorization', 'Bearer ' + SUPABASE_ANON);
    const upstream = await fetch(SUPABASE_URL + '/rest/v1/rpc/draw_lottery', {
      method: 'POST',
      headers: headers,
      body: bodyBuf,
      redirect: 'manual',
    });
    const respText = await upstream.text();
    let resp = null;
    try { resp = JSON.parse(respText); } catch (e) { resp = null; }
    const out = (resp && typeof resp === 'object') ? resp : { ok: false, error: 'server_error' };
    // 注入服务端日期（HCYA2X：前端不再信任本地系统时间判断"今天"）
    out.serverDate = sdate;
    // 抽中或已抽：记录该 IP 今日已抽，防止 retry/换设备继续刷（69G5XT）
    if (upstream.ok && (out.ok === true || (typeof out.seq === 'number' && out.seq > 0))) {
      LOTTERY_IP_MAP.set(key, { date: sdate, prize: out.prize || '', code: out.code || '', seq: out.seq || 0 });
    }
    // retry（手气不佳）也记录为今日已消耗一次，杜绝无限重试刷概率（69G5XT）
    if (upstream.ok && out.error === 'retry') {
      LOTTERY_IP_MAP.set(key, { date: sdate, prize: '', code: '', seq: 0 });
    }
    // 清理过期 key（只留最近 3 天）
    if (LOTTERY_IP_MAP.size > 500) {
      const cutoff = todayStr(new Date(now.getTime() - 3 * 86400000));
      for (const k of LOTTERY_IP_MAP.keys()) {
        if (k.endsWith(cutoff) === false && k.indexOf(':') > -1 && k.split(':').pop() !== sdate) LOTTERY_IP_MAP.delete(k);
      }
    }
    const respHeaders2 = new Headers();
    respHeaders2.set('Content-Type', 'application/json');
    respHeaders2.set('Access-Control-Allow-Origin', allowedOrigin(request) || 'https://theslowtide.pages.dev');
    return new Response(JSON.stringify(out), { status: 200, headers: respHeaders2 });
  }

  // 数据/管理接口：转发到数据服务站点（同域化，前端不再写死域名）
  if (path === '/api/data' || path.startsWith('/api/data/')) {
    return proxyFetch(DATA_ORIGIN + '/api/data' + url.search, request);
  }
  if (path === '/api/admin' || path.startsWith('/api/admin/')) {
    return proxyFetch(DATA_ORIGIN + '/api/admin' + url.search, request);
  }

  // 仅代理 /api/auth/* 与 /api/rest/*（去掉 /api 前缀直达 Supabase 同路径；补 /v1）
  if (path.startsWith('/api/auth/') || path.startsWith('/api/rest/')) {
    let p = path.slice('/api'.length); // /rest/v1/... 或 /rest/rpc/...
    if (p.startsWith('/rest/') && !p.startsWith('/rest/v1/')) {
      p = '/rest/v1' + p.slice('/rest'.length); // /rest/rpc/... -> /rest/v1/rpc/...
    }
    const target = SUPABASE_URL + p + url.search;
    const headers = new Headers(request.headers);
    headers.delete('host');
    if (!headers.get('apikey')) headers.set('apikey', SUPABASE_ANON);
    if (!headers.get('authorization')) headers.set('authorization', 'Bearer ' + SUPABASE_ANON);

    let body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    // 活动参与落库时注入真实客户端 IP（防多账号重复领取）
    if (request.method === 'POST' && path.includes('/activity_participants') && body && body.byteLength) {
      try {
        const obj = JSON.parse(new TextDecoder().decode(body));
        const cfIp = request.headers.get('CF-Connecting-IP') || '';
        if (!obj.ip) obj.ip = cfIp;
        body = new TextEncoder().encode(JSON.stringify(obj));
      } catch (e) { /* 非 JSON 原样转发 */ }
    }

    const upstream = await fetch(target, {
      method: request.method,
      headers: headers,
      body: body,
      redirect: 'manual'
    });
    const respHeaders = new Headers(upstream.headers);
    respHeaders.set('Access-Control-Allow-Origin', allowedOrigin(request) || 'https://theslowtide.pages.dev');
    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders
    });
  }

  return new Response('Not found', { status: 404 });
}
