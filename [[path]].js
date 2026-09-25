// Cloudflare Pages Function: /api/* -> Supabase 代理
// 捕获 /api/rest/* 和 /api/auth/*，转发到 Supabase，透传 method/query/headers/body
export async function onRequest(context) {
  const { request, params } = context;
  const path = (params.path || []).join('/');
  const url = new URL(request.url);
  const supabaseBase = 'https://jilcbcodphxpasicjghv.supabase.co';
  const target = supabaseBase + '/' + path + url.search;

  // 复制请求头（保留 apikey / Authorization / Content-Type）
  const headers = new Headers(request.headers);
  headers.delete('host');

  // 转发请求
  const upstream = await fetch(target, {
    method: request.method,
    headers: headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
    redirect: 'manual'
  });

  // 组装响应头
  const respHeaders = new Headers(upstream.headers);
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set('Access-Control-Allow-Headers', 'apikey, Authorization, Content-Type');
  respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders
  });
}
