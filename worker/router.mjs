function privatePath(path){
  try{for(let i=0;i<2;i++)path=decodeURIComponent(path);}
  catch{return true;}
  return path.replace(/\/+/g,'/').toLowerCase().startsWith('/_cloudflare');
}
function forwarded(request,env){
  const url=new URL(request.url),headers=new Headers(request.headers);
  headers.set('X-Forwarded-Proto','https');headers.set('X-Forwarded-Host',url.host);
  headers.set('X-Cloudflare-Read-Only',env.READ_ONLY==='true'?'true':'false');
  return new Request(request,{headers});
}
function ready(env){return Boolean(env.SESSION_SECRET&&(env.STAGING==='true'||env.DATABASE_URL));}
export default{
  async fetch(request,env){
    const url=new URL(request.url);
    if(privatePath(url.pathname))return new Response('Not found',{status:404});
    if(url.protocol!=='https:'){url.protocol='https:';return Response.redirect(url.toString(),308);}
    if(!ready(env))return new Response('The site is temporarily unavailable.',{status:503});
    try{return await env.APP.getByName('legacy-app').fetch(forwarded(request,env));}
    catch{console.error('Legacy Dracoria container unavailable');return new Response('The site is temporarily unavailable.',{status:503});}
  },
  async scheduled(event,env){
    if(env.READ_ONLY==='true'||env.STAGING==='true'||!ready(env))return;
    const response=await env.APP.getByName('legacy-app').fetch(forwarded(new Request('https://internal/_cloudflare/grow',{method:'POST'}),env));
    await response.body?.cancel();if(!response.ok)throw new Error('Scheduled growth failed');
  },
};
