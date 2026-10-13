const {execFileSync,spawnSync}=require('node:child_process');
const crypto=require('node:crypto');
const name='codex-dracoria-fixture-'+crypto.randomBytes(6).toString('hex');
const docker=args=>execFileSync('docker',args,{encoding:'utf8'}).trim();
async function main(){
 execFileSync('docker',['build','-f','Dockerfile.staging','-t','codex-dracoria-fixture:test','.'],{stdio:'inherit'});
 let created=false;
 try{
  docker(['run','-d','--name',name,'--label','codex.task=cloudflare-migrations','--label','codex.role=dracoria-synthetic-fixture','--memory=1g','--read-only','--tmpfs','/tmp:rw,uid=1000,gid=1000,size=1g','--tmpfs','/home/ubuntu/.mongodb:rw,uid=1000,gid=1000,size=16m','-p','127.0.0.1::3000',...Object.entries({NODE_ENV:'production',FIXTURE_MODE:'true',DATABASE_URL:'mongodb://127.0.0.1:27017/dracoria_staging',SESSION_SECRET:'local-synthetic-fixture-only',OPENAI_API_KEY:'fixture-key',OPENAI_BASE_URL:'http://127.0.0.1:3002/v1',CLOUDFLARE:'true',EXTERNAL_SCHEDULER:'true',MIGRATION_READ_ONLY:'false'}).flatMap(([k,v])=>['-e',`${k}=${v}`]),'codex-dracoria-fixture:test']);created=true;
  const base='http://'+docker(['port',name,'3000/tcp']);let ready=false;
  for(let i=0;i<60;i++){
   try{const response=await fetch(base+'/_cloudflare/health');const body=await response.json();if(body.ready){ready=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,500));
  }
  if(!ready)throw new Error('Synthetic fixture failed to start');
  const result=spawnSync(process.execPath,['--test','tests/container.test.cjs','tests/router.test.cjs'],{stdio:'inherit',env:{...process.env,DRACORIA_FIXTURE_CONTAINER:name,DRACORIA_FIXTURE_URL:base}});
  if(result.status!==0)throw new Error('Fixture acceptance failed');
 }finally{
  // Only the disposable fixture created by this exact invocation is removed.
  if(created)docker(['rm','-f',name]);
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
