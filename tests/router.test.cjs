const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
test('Worker runtime blocks private RPCs, replaces trusted headers and isolates read-only policy',async()=>{
 const {Miniflare,convertV4MiniflareOptions}=await import('miniflare');
 const router=path.resolve('worker/router.mjs');
 const options=convertV4MiniflareOptions({workers:[{
  name:'router',modules:[{type:'ESModule',path:path.resolve('tests/runtime-entry.mjs'),contents:`import router from '../worker/router.mjs';export default router;export class Recorder{async fetch(request){return Response.json({url:request.url,method:request.method,headers:Object.fromEntries(request.headers)});}}`},{type:'ESModule',path:router}],
  compatibilityDate:'2026-10-12',bindings:{SESSION_SECRET:'test-only',DATABASE_URL:'fixture-only',READ_ONLY:'true',STAGING:'false'},
  durableObjects:{APP:{className:'Recorder',useSQLite:true}},
 }]});
 const mf=new Miniflare(options);
 try{
  for(const pathname of ['/_cloudflare/health','//_cloudflare/grow','/%5Fcloudflare/health','/%255Fcloudflare/grow','/%ZZ']){
   const response=await mf.dispatchFetch(`https://dracoria.test${pathname}`);assert.equal(response.status,404);await response.text();
  }
  let response=await mf.dispatchFetch('http://dracoria.test/auth/login?next=%2F',{redirect:'manual'});assert.equal(response.status,308);assert.equal(response.headers.get('location'),'https://dracoria.test/auth/login?next=%2F');await response.text();
  response=await mf.dispatchFetch('https://dracoria.test/auth/login',{method:'POST',headers:{'X-Forwarded-Host':'evil.test','X-Forwarded-Proto':'http','X-Cloudflare-Read-Only':'false'},body:'fixture'});
  const data=await response.json();assert.equal(data.headers['x-forwarded-host'],'dracoria.test');assert.equal(data.headers['x-forwarded-proto'],'https');assert.equal(data.headers['x-cloudflare-read-only'],'true');assert.equal(data.method,'POST');
 }finally{await mf.dispose();}
});
