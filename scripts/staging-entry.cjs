const {spawn}=require('node:child_process');
const {mkdtempSync}=require('node:fs');
const http=require('node:http');
const crypto=require('node:crypto');
const bcrypt=require('bcrypt');
const {MongoClient,ObjectId}=require('mongoose').mongo;
const uri='mongodb://127.0.0.1:27017/dracoria_staging';
if(process.env.FIXTURE_MODE!=='true'||process.env.DATABASE_URL!==uri||!process.env.SESSION_SECRET)throw new Error('Disposable staging configuration required');
const directory=mkdtempSync('/tmp/dracoria-fixture-');
const mongo=spawn('mongod',['--dbpath',directory,'--bind_ip','127.0.0.1','--wiredTigerCacheSizeGB','0.25','--nounixsocket','--quiet'],{stdio:'ignore'});
let app,stub;
async function start(){
  let client;
  for(let i=0;i<60;i++){
    client=new MongoClient(uri,{serverSelectionTimeoutMS:300});
    try{await client.connect();break;}
    catch{await client.close();if(i===59)throw new Error('Fixture database unavailable');await new Promise(r=>setTimeout(r,250));}
  }
  const db=client.db('dracoria_staging');
  // This database is confined to this fixture image and localhost MongoDB.
  await db.dropDatabase();
  await db.collection('users').createIndex({username:1},{unique:true});
  await db.collection('users').createIndex({walletAddress:1},{unique:true});
  await db.collection('sessions').createIndex({expires:1},{expireAfterSeconds:0});
  for(const username of ['staging_alice','staging_bob']){
    const id=new ObjectId();
    await db.collection('users').insertOne({_id:id,username,password:await bcrypt.hash('fixture-password-only',10),walletAddress:'0x'+crypto.createHash('sha256').update(username).digest('hex').slice(0,40),openAIKey:'fixture-user-key',isAdmin:false,lavaJuice:0,garden:[]});
    await db.collection('dragons').insertOne({_id:new ObjectId(),userId:id,name:'Fixture Draco',stage:'egg',experience:0,energy:100,experiencePoints:0});
    await db.collection('gardens').insertOne({_id:new ObjectId(),userId:id,treeType:'lava',fruitCount:0,lastHarvested:new Date(),fruitGrowthTimestamp:new Date(Date.now()-3*3600000)});
  }
  await client.close();
  stub=http.createServer(async(req,res)=>{
    if(req.method!=='POST'||req.url!=='/v1/chat/completions'){res.writeHead(404);return res.end();}
    let size=0;for await(const chunk of req){size+=chunk.length;if(size>100000){res.writeHead(413);return res.end();}}
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({id:'isolated-fixture',object:'chat.completion',model:'gpt-4-turbo',choices:[{index:0,message:{role:'assistant',content:'Synthetic staging reply.'},finish_reason:'stop'}],usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0}}));
  });
  await new Promise(resolve=>stub.listen(3002,'127.0.0.1',resolve));
  app=spawn(process.execPath,['server.js'],{stdio:'inherit'});
  app.on('exit',code=>{mongo.kill('SIGTERM');stub.close();process.exit(code??1);});
}
start().catch(()=>{console.error('Disposable staging failed to start');mongo.kill('SIGTERM');process.exit(1);});
function stop(){app?.kill('SIGTERM');mongo.kill('SIGTERM');stub?.close();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
