const {mkdirSync,writeFileSync}=require('node:fs');
const {execFileSync}=require('node:child_process');
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
mkdirSync('worker',{recursive:true});mkdirSync('public',{recursive:true});
writeFileSync('worker/version.mjs',`export const commit=${JSON.stringify(commit)};\n`);
writeFileSync('public/deployment.json',JSON.stringify({repository:'pierce403/dracoria',commit,originalHerokuCommit:'1b58a84076d7a87b633cc0195a8ff8a7792a20b8',app:'dracoria-legacy'})+'\n');
