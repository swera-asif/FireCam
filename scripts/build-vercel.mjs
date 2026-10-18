if(process.env.DATABASE_URL)await import('./migrate.mjs');
else console.log('DATABASE_URL is not set. The public site will deploy, but accounts stay unavailable.');
console.log('Vercel serves public/ with api/index.js.');
