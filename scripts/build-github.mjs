import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('docs',{recursive:true});await cp('public','docs',{recursive:true});
await cp('github/data.js','docs/data.js');await cp('github/portal-config.js','docs/portal-config.js');
for(const file of ['app.js','index.html','styles.css','manifest.webmanifest']){
 let s=await readFile('docs/'+file,'utf8');
 s=s.replace(/(?<![.])\/assets\//g,'./assets/').replaceAll('href="/','href="./').replaceAll('src="/','src="./');
 if(file==='manifest.webmanifest'){const m=JSON.parse(s);m.id='./';m.start_url='./#/';m.scope='./';s=JSON.stringify(m);}
 await writeFile('docs/'+file,s);
}
await writeFile('docs/.nojekyll','');console.log('Prepared GitHub Pages with Vercel portal links.');
