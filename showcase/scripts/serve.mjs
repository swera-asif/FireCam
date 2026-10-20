import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../dist', import.meta.url));
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml', '.ttf':'font/ttf' };
createServer(async (req,res) => {
  if (req.url.startsWith('/.netlify') || req.url.startsWith('/.netlify/identity')) {
    res.writeHead(503, {'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'Managed login and AI functions require a Netlify deployment. Local demo works without them.'}));
  }
  try {
    const name = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (name !== root && !name.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
    let file = name, data;
    try { data = await readFile(file); } catch {
      if (extname(name)) { res.writeHead(404); return res.end('Not found'); }
      file = resolve(root,'index.html'); data = await readFile(file);
    }
    res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'}); res.end(data);
  } catch { res.writeHead(400); res.end('Bad request'); }
}).listen(4180,'127.0.0.1',()=>console.log('FireCam: http://127.0.0.1:4180'));
