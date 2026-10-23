import { build } from 'esbuild';
import { mkdir, cp, copyFile } from 'node:fs/promises';
await mkdir('dist/assets', { recursive: true });
// Additive build: no source or previous deployment directories are deleted.
await cp('assets', 'dist/assets', { recursive: true });
await copyFile('src/index.html', 'dist/index.html');
await copyFile('src/styles.css', 'dist/styles.css');
await copyFile('src/sw.js', 'dist/sw.js');
// Public configuration from the build environment (Netlify environment variables or a local shell).
const publicConfig = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || ''
};
const define = { __FIRECAM_CONFIG__: JSON.stringify(publicConfig) };
await build({ entryPoints: ['src/app.js'], bundle: true, format: 'esm', outfile: 'dist/app.js', minify: true, target: 'es2022', define });
// The AudioWorklet module is loaded by URL at runtime and must stay a separate file.
await build({ entryPoints: ['src/alarm-worklet.js'], bundle: true, format: 'esm', outfile: 'dist/alarm-worklet.js', minify: true, target: 'es2022' });
console.log(`FireCam showcase built in showcase/dist (cloud ${publicConfig.supabaseUrl ? 'configured' : 'not configured: local mode'}, push ${publicConfig.vapidPublicKey ? 'configured' : 'not configured'})`);
