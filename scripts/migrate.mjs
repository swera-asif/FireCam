import {readFile} from 'node:fs/promises';
import {database} from '../lib/database.js';
const db=database();if(!db)throw Error('Set DATABASE_URL in Vercel before running the database migration.');
try{await db.query(await readFile(new URL('../migrations/001-postgres.sql',import.meta.url),'utf8'));console.log('FireCam database schema is ready.');}finally{await db.end();}
