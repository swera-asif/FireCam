import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('docs',{recursive:true});await cp('public','docs',{recursive:true});
await cp('github/data.js','docs/data.js');await cp('github/firebase-config.js','docs/firebase-config.js');
let app=await readFile('public/app.js','utf8');app=app.replace('state, init,','state, googleLogin, resetPassword, init,');
const start=app.indexOf('function authPage('),end=app.indexOf('function proposal()',start);
app=app.slice(0,start)+`function authPage(register=false) {
 const completing=register&&state.signedIn;
 return \`\${header()}<main id="main" class="auth-layout container"><div class="auth-art"><img src="./assets/hero.webp" alt="A warmly lit home"><div><h1>Welcome<br><span class="serif">home.</span></h1><p>Your private FireCam workspace.</p></div></div><div class="auth-form"><a href="#/" class="back-link">← Back to FireCam</a><h2>\${register?'Create your account.':'Sign in to continue.'}</h2><p>\${completing?'Add your name to finish registration.':'Use Google or your email address to access FireCam.'}</p>\${!state.backend?'<div class="info-note">'+esc(state.setupError)+'</div>':
 '<form data-form="'+(register?'register':'login')+'">'+(register?field('Full name','fullName','','text','required maxlength="100" autocomplete="name"'):'')+(completing?'':field('Email','email','','email','required autocomplete="email"')+field('Password','password','','password','required minlength="10" autocomplete="'+(register?'new-password':'current-password')+'"'))+formError+'<button class="btn primary full" type="submit">'+(register?'Create account':'Sign in')+'</button></form>'+(completing?'':'<div class="auth-divider"><span>or</span></div>'+button('Continue with Google','google-login','secondary full','')+(register?'':button('Forgot password?','reset-password','text','')))}<p class="auth-switch">\${register?'Already registered? <a href="#/login">Sign in</a>':'New here? <a href="#/register">Create an account</a>'}</p></div></main>\${footer()}\`;
}
`+app.slice(end);
app=app.replace("if(a==='close')return closeModal();",`if(a==='close')return closeModal();
  if(a==='google-login'){target.disabled=true;const registered=await googleLogin();go(registered?'dashboard':'register');await render();return;}
  if(a==='reset-password'){await resetPassword(document.querySelector('[name="email"]')?.value);toast('If this email has an account, check your inbox for a reset link.');return;}`);
app=app.replaceAll('ChatGPT sign-in','Google or email sign-in').replaceAll('D1','Firestore').replaceAll('Local workspace','Private workspace');
app=app.replaceAll('2_000_000','500_000').replaceAll('smaller than 2 MB','smaller than 500 KB');
app=app.replace("navigator.serviceWorker.register('/sw.js')","navigator.serviceWorker.register('./sw.js')");
await writeFile('docs/app.js',app);
for(const file of ['app.js','index.html','styles.css','manifest.webmanifest']){let s=await readFile('docs/'+file,'utf8');s=s.replaceAll('/assets/','./assets/').replaceAll('href="/','href="./').replaceAll('src="/','src="./');if(file==='manifest.webmanifest'){const manifest=JSON.parse(s);manifest.id='./';manifest.start_url='./#/';manifest.scope='./';s=JSON.stringify(manifest);}if(file==='manifest.webmanifest')s=s.replace('"start_url": "/"','"start_url": "./"').replace('"scope": "/"','"scope": "./"');await writeFile('docs/'+file,s);}
await writeFile('docs/sw.js',"self.addEventListener('install',()=>self.skipWaiting()); self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));\n");
await writeFile('docs/.nojekyll','');console.log('GitHub Pages files prepared in docs/. Firebase setup is required for sign-in.');

