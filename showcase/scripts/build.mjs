import { build } from 'esbuild';
import { mkdir, cp, copyFile } from 'node:fs/promises';
await mkdir('dist/assets', { recursive: true });
// Additive build: no source or previous deployment directories are deleted.
await cp('../public/assets', 'dist/assets', { recursive: true });
await copyFile('src/index.html', 'dist/index.html');
await copyFile('src/styles.css', 'dist/styles.css');
await build({ entryPoints: ['src/app.js'], bundle: true, format: 'esm', outfile: 'dist/app.js', minify: true, target: 'es2022' });
console.log('FireCam showcase built in showcase/dist');
