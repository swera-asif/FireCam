import {database} from '../lib/database.js';
import {handleApi} from '../lib/portal-api.js';
export default async function handler(req,res){
 try{
  const origin='https://'+req.headers.host;
  const method=req.method;let body;
  if(!['GET','HEAD'].includes(method)){
   if(req.body!==undefined)body=typeof req.body==='string'?req.body:JSON.stringify(req.body);
   else{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>3000000){res.statusCode=413;res.end('Upload too large');return;}chunks.push(chunk);}body=Buffer.concat(chunks);}
  }
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
  const result=await handleApi(new Request(new URL(req.url,origin),{method,headers,body}),database());
  res.statusCode=result.status;for(const [k,v] of result.headers)res.setHeader(k,v);res.end(await result.text());
 }catch{res.statusCode=503;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({message:'The account service is temporarily unavailable.'}));}
}
