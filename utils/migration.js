const {AsyncLocalStorage}=require('node:async_hooks');
const context=new AsyncLocalStorage();
const readOnly=()=>context.getStore()?.readOnly===true;
function frozenRequest(req){
 const header=req.headers['x-cloudflare-read-only'];
 return process.env.CLOUDFLARE==='true'&&header!==undefined?header==='true':process.env.MIGRATION_READ_ONLY==='true';
}
function requestContext(req,res,next){
 context.run({readOnly:frozenRequest(req)},()=>{
  if(readOnly() && (!['GET','HEAD'].includes(req.method)||req.path==='/auth/logout')){
   res.set('Cache-Control','no-store');return res.status(503).send('The site is temporarily read-only during migration.');
  }
  next();
 });
}
function socketContext(req,res,next){context.run({readOnly:frozenRequest(req)},next);}
function freezeSessionWrites(store){
 for(const method of ['set','touch','destroy']){
  const original=store[method].bind(store);
  store[method]=function(...args){
   if(readOnly()){const callback=args.at(-1);if(typeof callback==='function')callback(null);return;}
   return original(...args);
  };
 }
 return store;
}
module.exports={readOnly,requestContext,socketContext,freezeSessionWrites,frozenRequest};
