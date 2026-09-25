// Cloudflare Pages Functions - The Slow Tide 官网 API 代理
// /api/auth/* -> Supabase Auth（登录/注册）
// /api/rest/* -> Supabase REST（活动数据、RPC 抽奖等）
// 说明：anon key 为公开可共享密钥，在此自动注入简化前端请求；抽奖原子逻辑在数据库函数 draw_lottery（SECURITY DEFINER）内完成

const SUPABASE_URL = 'https://jilcbcodphxpasicjghv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGNiY29kcGh4cGFzaWNqZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDUzNTgsImV4cCI6MjEwNDE4MTM1OH0._DkyiWyL5viXByCJ5ejFifn9RuEVkVHjAnU4oQepsbs';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  // 仅代理 /api/auth/* 与 /api/rest/*
  if (path.startsWith('/api/auth/') || path.startsWith('/api/rest/')) {
    let target;
    if (path.startsWith('/api/rest/')) {
      // /api/rest/rpc/xxx -> /rest/v1/rpc/xxx
      target = SUPABASE_URL + '/rest/v1' + path.slice('/api/rest'.length) + url.search;
    } else {
      // /api/auth/xxx -> /auth/v1/xxx
      target = SUPABASE_URL + '/auth/v1' + path.slice('/api/auth'.length) + url.search;
    }
    const headers = new Headers(request.headers);
    headers.delete('host');

    // 自动注入 anon key（公开密钥，方便前端）
    if (!headers.get('apikey')) headers.set('apikey', SUPABASE_ANON);
    if (!headers.get('authorization')) headers.set('authorization', 'Bearer ' + SUPABASE_ANON);

    // 活动参与落库时注入真实客户端 IP（防多账号重复领取）
    let body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
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
    respHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders
    });
  }

  return new Response('Not found', { status: 404 });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}
