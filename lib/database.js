import {Pool} from 'pg';
let pool;
export function database(){
 if(!process.env.DATABASE_URL) return null;
 return pool ||= new Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000});
}
