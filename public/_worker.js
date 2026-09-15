const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function randomCode() {
  let code = '';
  while (code.length < 3) { const byte = crypto.getRandomValues(new Uint8Array(1))[0]; if (byte < 248) code += ALPHABET[byte % 62]; }
  return code;
}
const reply = (text, status) => new Response(text, { status });
async function handle(request, env) {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return reply('HTTPS is required.', 400);
  if (url.pathname === '/api/messages') {
    if (request.method !== 'POST') return reply('Method not allowed', 405);
    if (request.headers.get('Origin') !== url.origin) return reply('Forbidden', 403);
    if (request.headers.get('Content-Type') !== 'application/octet-stream') return reply('Expected encrypted binary data', 415);
    if (!request.body) return reply('Invalid encrypted data', 400);
    const reader = request.body.getReader(), bytes = new Uint8Array(65580); let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      if (size + value.length > bytes.length) { await reader.cancel(); return reply('Message too large', 413); }
      bytes.set(value, size); size += value.length;
    }
    if (size < 45) return reply('Invalid encrypted data', 400);
    for (let attempt = 0; attempt < 32; attempt++) {
      const code = randomCode();
      const object = env.MESSAGES.get(env.MESSAGES.idFromName(code));
      const result = await object.fetch('https://message/', { method: 'POST', body: bytes.slice(0, size) });
      if (result.status === 409) continue;
      if (result.status !== 201) return reply('Storage unavailable. Try again.', 503);
      const { expiresAt } = await result.json();
      return Response.json({ code, expiresAt }, { status: 201 });
    }
    return reply('No short code available right now. Please try again later.', 503);
  }
  const match = url.pathname.match(/^\/api\/messages\/([A-Za-z0-9]{3})$/);
  if (match) {
    if (request.method !== 'GET') return reply('Method not allowed', 405);
    return env.MESSAGES.get(env.MESSAGES.idFromName(match[1])).fetch('https://message/');
  }
  if (!['GET', 'HEAD'].includes(request.method)) return reply('Method not allowed', 405);
  if (url.pathname === '/receive' || /^\/[A-Za-z0-9]{3}$/.test(url.pathname)) {
    return env.ASSETS.fetch(new Request(new URL('/', url), request));
  }
  const assets = ['/', '/index.html', '/app.js', '/crypto.js', '/style.css', '/vendor/qrcode.js', '/vendor/qr-scanner.min.js', '/vendor/qr-scanner-worker.min.js'];
  if (!assets.includes(url.pathname)) return reply('Not found', 404);
  return env.ASSETS.fetch(request);
}
export default {
  async fetch(request, env) {
    let response;
    try { response = await handle(request, env); } catch { response = reply('Service unavailable. Please try again.', 503); }
    const secured = new Response(response.body, response);
    secured.headers.set('Cache-Control', 'no-store');
    secured.headers.set('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; worker-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    secured.headers.set('Referrer-Policy', 'no-referrer');
    secured.headers.set('X-Content-Type-Options', 'nosniff');
    secured.headers.set('X-Frame-Options', 'DENY');
    secured.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    secured.headers.set('Strict-Transport-Security', 'max-age=31536000');
    return secured;
  }
};
