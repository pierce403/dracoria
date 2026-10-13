const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const bcrypt=require('bcrypt');
const {io}=require('socket.io-client');
const container=process.env.DRACORIA_FIXTURE_CONTAINER;
const base=process.env.DRACORIA_FIXTURE_URL;
function fixtureDb(code){
 assert.match(container,/^codex-dracoria-fixture-/);
 const script=`const {MongoClient}=require('mongoose').mongo;(async()=>{const c=new MongoClient('mongodb://127.0.0.1:27017/dracoria_staging');await c.connect();const db=c.db('dracoria_staging');${code};await c.close()})().catch(()=>process.exit(1))`;
 return execFileSync('docker',['exec','-i',container,'node'],{input:script,encoding:'utf8'}).trim();
}
function request(pathname,{cookie,readonly=false,headers={},...options}={}){
 assert.equal(new URL(base).hostname,'127.0.0.1');
 return fetch(base+pathname,{redirect:'manual',...options,headers:{'X-Forwarded-Proto':'https','X-Forwarded-Host':'dracoria.test','X-Cloudflare-Read-Only':String(readonly),...(cookie?{Cookie:cookie}:{}),...headers}});
}
async function login(username,password='fixture-password-only',cookie){
 return request('/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password}),cookie});
}
const cookieOf=response=>response.headers.get('set-cookie')?.split(';')[0];
function socket(cookie,origin='https://dracoria.test'){
 return io(base,{transports:['websocket'],forceNew:true,reconnection:false,extraHeaders:{'X-Forwarded-Proto':'https','X-Forwarded-Host':'dracoria.test','X-Cloudflare-Read-Only':'false',Origin:origin,...(cookie?{Cookie:cookie}:{})}});
}
function connect(client){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Socket timeout')),5000);client.once('connect',()=>{clearTimeout(timeout);resolve();});client.once('connect_error',error=>{clearTimeout(timeout);reject(error);});});}
test('Legacy bcrypt hashes remain valid',async()=>{
 // Fixed public vector from bcrypt's upstream tests, independent of a fresh hash.
 const hash='$2a$10$XOPbrlUPQdwdJUpSrIF6X.LbE14qsMmKGhM1A8W9iqaG3vv1BD7WC';
 assert.equal(await bcrypt.compare('envy1362987212538',hash),true);
 assert.equal(await bcrypt.compare('wrong',hash),false);
});
test('Disposable container preserves password sessions, ownership, read-only data and WebSocket isolation',{skip:!container||!base,timeout:20000},async()=>{
 let response=await request('/');assert.equal(response.status,200);assert.match(await response.text(),/Dracoria/);
 response=await request('/does-not-exist');assert.equal(response.status,404);await response.text();
 response=await request('/api/user/status');assert.equal(response.status,401);await response.text();
 response=await login('staging_alice','incorrect');assert.equal(response.status,400);await response.text();
 const prior=cookieOf(response);
 response=await login('staging_alice',undefined,prior);assert.equal(response.status,302);const alice=cookieOf(response);assert.ok(alice);assert.notEqual(alice,prior);
 assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/Secure/);assert.match(response.headers.get('set-cookie'),/SameSite=Lax/);await response.text();
 response=await login('staging_bob');assert.equal(response.status,302);const bob=cookieOf(response);await response.text();
 response=await request('/api/user/status',{cookie:alice});const user=await response.json();assert.equal(user.username,'staging_alice');assert.equal(user.password,undefined);assert.equal(user.openAIKey,undefined);
 response=await request('/api/user/status',{cookie:alice+'tampered'});assert.equal(response.status,401);await response.text();
 response=await request('/admin/dashboard',{cookie:alice});assert.equal(response.status,403);await response.text();
 response=await request('/api/dragon/status',{cookie:alice});const dragon=await response.json();
 response=await request('/api/dragon/conversation?dragonId='+dragon._id,{cookie:bob});assert.equal(response.status,403);await response.text();
 response=await request('/api/dragon/chat',{cookie:alice,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dragonId:dragon._id,message:'Synthetic fixture question.'})});assert.equal(response.status,200);assert.equal((await response.json()).reply.dragonMessage,'Synthetic staging reply.');
 response=await request('/auth/wallet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({walletAddress:'0x'+'11'.repeat(20)})});const walletCookie=cookieOf(response);await response.text();
 response=await request('/api/user/status',{cookie:walletCookie});assert.equal(response.status,401);await response.text();
 response=await request('/auth/settings',{cookie:alice,method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);await response.text();
 fixtureDb("await db.collection('gardens').deleteOne({userId: new (require('mongoose').mongo.ObjectId)('"+user._id+"')})");
 const snapshot=()=>fixtureDb("const data={};for(const name of ['users','dragons','gardens','conversations','sessions'])data[name]=await db.collection(name).find().sort({_id:1}).toArray();console.log(require('node:crypto').createHash('sha256').update(JSON.stringify(data)).digest('hex'))");
 const before=snapshot();
 for(const pathname of ['/','/api/user/status','/api/dragon/status','/api/garden/status','/auth/logout']){
  response=await request(pathname,{cookie:alice,readonly:true});assert.equal(response.status,pathname==='/auth/logout'?503:pathname==='/api/garden/status'?404:200);await response.text();
 }
 response=await request('/auth/login',{readonly:true,method:'POST',body:'ignored'});assert.equal(response.status,503);await response.text();assert.equal(snapshot(),before);
 const anonymous=socket();await assert.rejects(connect(anonymous));anonymous.close();
 const foreign=socket(alice,'https://evil.test');await assert.rejects(connect(foreign));foreign.close();
 const a=socket(alice),a2=socket(alice),b=socket(bob);
 try{
  await Promise.all([connect(a),connect(a2),connect(b)]);let bobEvents=0;b.on('dragonUpdate',()=>bobEvents++);
  const event=new Promise(resolve=>a2.once('dragonUpdate',resolve));a.emit('feedDragon',{newHungerLevel:3,newHappinessLevel:95});assert.deepEqual(await event,{hunger:3,happiness:95});await new Promise(r=>setTimeout(r,150));assert.equal(bobEvents,0);
 }finally{a.close();a2.close();b.close();}
 response=await request('/_cloudflare/grow',{method:'POST'});assert.equal(response.status,200);await response.text();
 response=await request('/api/garden/status',{cookie:bob});assert.equal((await response.json()).fruitCount,3);
 response=await request('/auth/logout',{cookie:alice});assert.equal(response.status,302);await response.text();
 response=await request('/api/user/status',{cookie:alice});assert.equal(response.status,401);await response.text();
 const loggedOut=socket(alice);await assert.rejects(connect(loggedOut));loggedOut.close();
 fixtureDb("await db.collection('sessions').updateMany({},{$set:{expires:new Date(0)}})");
 response=await request('/api/user/status',{cookie:bob});assert.equal(response.status,401);await response.text();
});
