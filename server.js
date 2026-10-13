const logger=require('./utils/logger');logger.installConsoleGate();
require('dotenv').config();
const mongoose=require('mongoose');
const express=require('express');
const session=require('express-session');
const MongoStore=require('connect-mongo');
const http=require('node:http');
const {Server}=require('socket.io');
const {readOnly,requestContext,socketContext,freezeSessionWrites,frozenRequest}=require('./utils/migration');
const app=express(),server=http.createServer(app);
const io=new Server(server,{allowRequest:(req,callback)=>{
 const origin=req.headers.origin;
 const host=process.env.CLOUDFLARE==='true'?req.headers['x-forwarded-host']:req.headers.host;
 callback(null,!origin||origin===`${process.env.CLOUDFLARE==='true'?'https':'http'}://${host}`);
}});
module.exports={getIo:()=>io};
const authRoutes=require('./routes/authRoutes');
const walletAuthRoutes=require('./routes/walletAuthRoutes');
const apiRoutes=require('./routes/apiRoutes');
const adminRoutes=require('./routes/adminRoutes');
const {isAuthenticated}=require('./routes/middleware/authMiddleware');
const Dragon=require('./models/Dragon');
const {checkAndGrowFruits}=require('./services/gardenService');
if(!process.env.DATABASE_URL||!process.env.SESSION_SECRET){logger.error();process.exit(1);}
const cloudflare=process.env.CLOUDFLARE==='true';
app.set('trust proxy',cloudflare?1:false);app.set('view engine','ejs');
app.use(requestContext);
app.use(express.urlencoded({extended:true,limit:'100kb'}));app.use(express.json({limit:'100kb'}));
app.use((req,res,next)=>{
 if(!['GET','HEAD'].includes(req.method)&&req.get('Origin')){
  const host=cloudflare?req.get('X-Forwarded-Host'):req.get('Host');
  if(req.get('Origin')!==`${req.protocol}://${host}`)return res.status(403).send('Request origin does not match this site.');
 }
 res.set('Cache-Control','no-store');next();
});
// The Worker denies public access to this prefix. Only its coordinator uses it.
app.get('/_cloudflare/health',(req,res)=>res.json({ready:mongoose.connection.readyState===1,sockets:io.engine.clientsCount}));
app.post('/_cloudflare/grow',async(req,res)=>{
 try{await checkAndGrowFruits();res.json({ok:true});}catch{res.status(503).json({ok:false});}
});
app.use(express.static('public'));
const store=freezeSessionWrites(MongoStore.create({mongoUrl:process.env.DATABASE_URL,autoRemove:'disabled'}));
const sessionMiddleware=session({secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,store,cookie:{secure:cloudflare,httpOnly:true,sameSite:'lax'}});
app.use(sessionMiddleware);
app.use((req,res,next)=>{
 if(!readOnly())req.session.views=(req.session.views||0)+1;
 res.locals.session=req.session;res.locals.readOnly=readOnly();next();
});
app.use(authRoutes);app.use(walletAuthRoutes);app.use('/api',apiRoutes);app.use('/admin',adminRoutes);
io.engine.use((req,res,next)=>socketContext(req,res,()=>sessionMiddleware(req,res,next)));
io.use((socket,next)=>{
 if(!socket.request.session?.userId)return next(new Error('Sign in to connect.'));
 next();
});
io.on('connection',socket=>{
 const room=String(socket.request.session.userId);socket.join(room);
 const frozen=frozenRequest(socket.request);
 socket.on('feedDragon',data=>{
  if(frozen||!Number.isFinite(data?.newHungerLevel)||!Number.isFinite(data?.newHappinessLevel))return;
  io.to(room).emit('dragonUpdate',{hunger:data.newHungerLevel,happiness:data.newHappinessLevel});
 });
 socket.on('harvestFruit',data=>{
  if(frozen||!Number.isFinite(data?.newFruitCount))return;
  io.to(room).emit('gardenUpdate',{fruitCount:data.newFruitCount});
 });
});
app.get('/',async(req,res)=>{
 try{const dragon=req.session.userId?await Dragon.findOne({userId:req.session.userId}):null;res.render('index',{dragon});}
 catch{res.status(500).send('There was an error serving your request.');}
});
app.get('/dashboard',isAuthenticated,(req,res)=>res.render('dashboard'));
app.use((req,res)=>res.status(404).send('Page not found.'));
app.use((error,req,res,next)=>{logger.error();res.status(500).send('There was an error serving your request.');});
let interval;
mongoose.connect(process.env.DATABASE_URL,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:15000}).then(()=>{
 server.listen(process.env.PORT||3000,'0.0.0.0',()=>logger.event('server_ready'));
 if(process.env.EXTERNAL_SCHEDULER!=='true')interval=setInterval(()=>checkAndGrowFruits().catch(()=>logger.error()),3600000);
}).catch(error=>{logger.event('database_connection_failed',{kind:error.name});process.exit(1);});
async function stop(){if(interval)clearInterval(interval);io.close();server.close();await store.close();await mongoose.disconnect();process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
