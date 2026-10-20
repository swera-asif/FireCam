import { runProvider, RequestError } from './providers.mjs';
const headers={'Cache-Control':'no-store, private','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
export async function handle(req,getUser,run=runProvider){
  const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(req.method!=='POST')return respond({error:'Method not allowed'},405);
  if(req.headers.get('origin')!==new URL(req.url).origin)return respond({error:'Origin not allowed'},403);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return respond({error:'JSON required'},415);
  try{
    const user=await getUser();
    if(!user?.id)return respond({error:'Sign in before connecting an AI provider.'},401);
    const reader=req.body?.getReader(); if(!reader)throw new RequestError('Missing request');
    const chunks=[];let length=0;
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>1500000){await reader.cancel();throw new RequestError('Image request too large',413);}chunks.push(value);}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new RequestError('Invalid JSON');}
    const result=await run(body);
    return respond(result);
  }catch(error){
    // Never log or return provider exceptions: they may contain keys or images.
    return respond({error:error instanceof RequestError?error.message:'Review unavailable. Check the provider connection or try later; no safety conclusion was made.'},error instanceof RequestError?error.status:502);
  }
}
