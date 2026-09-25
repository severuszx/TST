// Cloudflare Pages Functions - The Slow Tide 官网 API 代理
// /api/auth/* -> Supabase Auth（登录/注册）
// /api/rest/* -> Supabase REST（活动数据等）
// 绑定要求：无（仅需网络转发）

const SUPABASE_URL = 'https://jilcbcodphxpasicjghv.supabase.co';

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
    const target = SUPABASE_URL + path.replace(/^\/api/, '') + url.search;
    const headers = new Headers(request.headers);
    headers.delete('host');
    const upstream = await fetch(target, {
      method: request.method,
      headers: headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
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
