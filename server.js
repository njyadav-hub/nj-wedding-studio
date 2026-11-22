const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data', 'store.json');
const UPLOADS = path.join(__dirname, 'uploads');
fs.mkdirSync(path.dirname(DATA), {recursive:true});
fs.mkdirSync(UPLOADS, {recursive:true});
if (!fs.existsSync(DATA)) fs.writeFileSync(DATA, JSON.stringify({users:[], weddings:[]}, null, 2));

const read = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
const write = db => fs.writeFileSync(DATA, JSON.stringify(db, null, 2));
const slugify = s => String(s || 'wedding').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,35) || 'wedding';
const safeUser = u => ({id:u.id, name:u.name, email:u.email});
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-before-deploying-nj-studio',
  resave:false, saveUninitialized:false,
  cookie:{httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV === 'production', maxAge:7*24*60*60*1000}
}));
app.use('/uploads', express.static(UPLOADS));
app.use(express.static(path.join(__dirname,'public')));

const storage = multer.diskStorage({
  destination:(req,file,cb)=>cb(null,UPLOADS),
  filename:(req,file,cb)=>cb(null,Date.now()+'-'+crypto.randomBytes(5).toString('hex')+path.extname(file.originalname).toLowerCase())
});
const upload = multer({storage, limits:{fileSize:8*1024*1024},fileFilter: (req, file, cb) => {
  if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Please upload JPG, PNG, WEBP or GIF images only.'));
  }
}});
const auth = (req,res,next)=>req.session.userId ? next() : res.status(401).json({error:'Please sign in first.'});

app.post('/api/register', async (req,res)=>{
  const {name,email,password}=req.body||{};
  if(!name?.trim() || !email?.trim() || !password || password.length<8) return res.status(400).json({error:'Name, email and password (at least 8 characters) are required.'});
  const db=read(), clean=email.trim().toLowerCase();
  if(db.users.some(u=>u.email===clean)) return res.status(409).json({error:'An account with this email already exists.'});
  const user={id:crypto.randomUUID(),name:name.trim(),email:clean,password:await bcrypt.hash(password,12),createdAt:new Date().toISOString()};
  db.users.push(user); write(db); req.session.userId=user.id;
  res.json({user:safeUser(user)});
});
app.post('/api/login', async (req,res)=>{
  const {email,password}=req.body||{}, db=read();
  const user=db.users.find(u=>u.email===String(email||'').trim().toLowerCase());
  if(!user || !await bcrypt.compare(password||'',user.password)) return res.status(401).json({error:'Email or password is incorrect.'});
  req.session.userId=user.id; res.json({user:safeUser(user)});
});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/me',(req,res)=>{
  if(!req.session.userId) return res.json({user:null});
  const u=read().users.find(x=>x.id===req.session.userId);
  res.json({user:u?safeUser(u):null});
});
app.get('/api/weddings',auth,(req,res)=>{
  const db=read(); res.json(db.weddings.filter(w=>w.userId===req.session.userId).map(({userId,...w})=>w));
});
app.post('/api/upload',auth,(req,res)=>{
  upload.single('photo')(req,res,err=>{
    if(err) return res.status(400).json({error:err.message});
    if(!req.file) return res.status(400).json({error:'Choose a photo to upload.'});
    res.json({url:'/uploads/'+req.file.filename});
  });
});
app.post('/api/weddings',auth,(req,res)=>{
  const db=read(), d=req.body||{};
  if(!d.bride?.trim() || !d.groom?.trim()) return res.status(400).json({error:'Please enter both names.'});
  const base=slugify(`${d.bride}-${d.groom}`), slug=base+'-'+crypto.randomBytes(3).toString('hex');
  const wedding={id:crypto.randomUUID(),userId:req.session.userId,slug,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),...d};
  db.weddings.push(wedding); write(db);
  res.json({wedding:{...wedding,userId:undefined},url:`${req.protocol}://${req.get('host')}/w/${slug}`});
});
app.put('/api/weddings/:id',auth,(req,res)=>{
  const db=read(), w=db.weddings.find(x=>x.id===req.params.id && x.userId===req.session.userId);
  if(!w) return res.status(404).json({error:'Invitation not found.'});
  Object.assign(w,req.body||{},{updatedAt:new Date().toISOString()}); write(db);
  res.json({wedding:{...w,userId:undefined}});
});
app.delete('/api/weddings/:id',auth,(req,res)=>{
  const db=read(), idx=db.weddings.findIndex(x=>x.id===req.params.id && x.userId===req.session.userId);
  if(idx<0) return res.status(404).json({error:'Invitation not found.'});
  db.weddings.splice(idx,1); write(db); res.json({ok:true});
});
app.get('/api/public/:slug',(req,res)=>{
  const w=read().weddings.find(x=>x.slug===req.params.slug);
  if(!w) return res.status(404).json({error:'This invitation could not be found.'});
  const {userId,...publicWedding}=w; res.json(publicWedding);
});
app.get('/w/:slug',(req,res)=>res.sendFile(path.join(__dirname,'public','invitation.html')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT,()=>console.log(`NJ Wedding Studio running at http://localhost:${PORT}`));
