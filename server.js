// 订阅内容整理小服务（练习 2 用）
// 功能：粘贴订阅原文（base64 或明文节点链接）→ 解码 → 提取节点链接 → 整齐列出
// 环境变量：
//   PORT       Render 自动注入，本地默认 3000
//   ACCESS_KEY 可选口令。设了之后，访问首页要在网址后带 ?key=口令，否则 401
const http = require('http');

const PORT = process.env.PORT || 3000;
const ACCESS_KEY = process.env.ACCESS_KEY || '';

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function page(title, inner) {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
         background:#0f1419; color:#e7e9ea; max-width:720px; margin:0 auto; padding:32px 18px; }
  h1 { font-size:22px; } p { color:#aeb9c4; line-height:1.6; }
  textarea { width:100%; min-height:150px; background:#1c2733; color:#e7e9ea;
             border:1px solid #2f3b47; border-radius:10px; padding:12px; font-size:13px; }
  button { margin-top:12px; background:#e08a3c; color:#231303; border:0; border-radius:10px;
           padding:10px 22px; font-size:15px; font-weight:700; cursor:pointer; }
  pre { background:#1c2733; border:1px solid #2f3b47; border-radius:10px;
        padding:12px; white-space:pre-wrap; word-break:break-all; font-size:12.5px; }
  .ok { color:#7ee2a8; } .warn { color:#f5c66b; }
</style></head><body>${inner}</body></html>`;
}

function extractNodes(text) {
  let decoded = null;
  const compact = text.replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/=_-]+$/.test(compact) && compact.length % 4 !== 1) {
    try {
      const d = Buffer.from(compact, 'base64').toString('utf-8');
      if (d.includes('://')) decoded = d;
    } catch (_) { /* 不是 base64 就按明文处理 */ }
  }
  const source = decoded !== null ? decoded : text;
  const links = source.split(/\r?\n/).map(s => s.trim())
    .filter(s => /^[a-z0-9]+:\/\//i.test(s));
  return { wasBase64: decoded !== null, links };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (ACCESS_KEY && url.searchParams.get('key') !== ACCESS_KEY) {
    log('AUTH-DENIED', req.method, url.pathname);
    res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page('需要口令', `<h1>🔒 需要口令</h1>
      <p>这个服务设了环境变量口令。在网址后面加上 <b>?key=你的口令</b> 再访问。</p>`));
    return;
  }
  const keyField = ACCESS_KEY
    ? `<input type="hidden" name="key" value="${url.searchParams.get('key') || ''}">` : '';

  if (req.method === 'GET' && url.pathname === '/') {
    log('HOME');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page('订阅整理', `<h1>订阅内容整理</h1>
      <p>把订阅原文（base64 订阅或明文节点链接，一行一个）粘进来，点整理，得到干净的节点链接清单。</p>
      <form method="POST" action="/convert">${keyField}
        <textarea name="content" placeholder="粘贴订阅内容到这里"></textarea>
        <br><button type="submit">整 理</button>
      </form>`));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/convert') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2_000_000) req.destroy(); });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const content = params.get('content') || '';
      const { wasBase64, links } = extractNodes(content);
      log('CONVERT', 'base64=' + wasBase64, 'nodes=' + links.length);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page('整理结果', `<h1>整理结果</h1>
        <p class="ok">输入${wasBase64 ? '是 base64 订阅，已解码' : '按明文处理'}，共提取到 <b>${links.length}</b> 条节点链接：</p>
        <pre>${links.join('\n') || '（没有识别到节点链接）'}</pre>
        <p><a href="/?key=${encodeURIComponent(url.searchParams.get('key') || '')}" style="color:#f5c66b">← 再来一次</a></p>`));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, '0.0.0.0', () => log('LISTENING on port', PORT, 'auth=' + (ACCESS_KEY ? 'on' : 'off')));
