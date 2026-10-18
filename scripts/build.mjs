import {readFile,readdir,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {extname} from 'node:path';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8'};
const assets={};
async function walk(path=''){for(const item of await readdir('public'+path,{withFileTypes:true})){const key=path+'/'+item.name;if(item.isDirectory())await walk(key);else assets[key]={type:mime[extname(key)]||'application/octet-stream',base64:(await readFile('public'+key)).toString('base64')};}}
await walk();await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',(await readFile('worker/index.js','utf8'))+'\nexport default createWorker('+JSON.stringify(assets)+');\n');
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log(`Bundled ${Object.keys(assets).length} assets and authenticated portal API.`);
