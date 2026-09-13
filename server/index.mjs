import next from 'next';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createRoom, publicRoom, choices, normalize, guessPoints } from './game.mjs';
import { createClient } from 'redis';
import pg from 'pg';
const dev = process.env.NODE_ENV !== 'production';
const standalone = process.env.GAME_SERVER_ONLY === 'true';
let handler;
if (!standalone) {
 const app = next({dev}); await app.prepare();
 handler = app.getRequestHandler();
}
const allowedOrigins = (process.env.CLIENT_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (standalone && !allowedOrigins.length) throw new Error('Set CLIENT_ORIGINS to your frontend URL, e.g. https://game-psi-blond.vercel.app');
const http = createServer((req, res) => {
 if (req.url === '/health') { res.writeHead(200, {'Content-Type':'application/json'}); return res.end(JSON.stringify({status:'ok'})); }
 if (handler) return handler(req, res);
 res.writeHead(404); res.end('Not found');
});
const io = new Server(http, {
 maxHttpBufferSize:100000,
 ...(allowedOrigins.length ? {cors:{origin:allowedOrigins,methods:['GET','POST']}} : {}),
 ...(standalone ? {allowRequest:(req, callback) => callback(null, !req.headers.origin || allowedOrigins.includes(req.headers.origin))} : {}),
});
const rooms = new Map();
let redis, db;
if(process.env.REDIS_URL) { redis=createClient({url:process.env.REDIS_URL}); redis.on('error',e=>console.error('Redis:',e.message)); try {await redis.connect();} catch(e) {console.error(e.message);} }
if(process.env.DATABASE_URL) { db=new pg.Pool({connectionString:process.env.DATABASE_URL}); await db.query('CREATE TABLE IF NOT EXISTS games (id BIGSERIAL PRIMARY KEY, room_code TEXT NOT NULL, completed_at TIMESTAMPTZ DEFAULT NOW(), results JSONB NOT NULL)'); }
function emit(room) { for (const p of room.players) io.to(p.id).emit('room', publicRoom(room,p.id)); if(redis?.isReady) redis.set(`doodle:room:${room.id}`,JSON.stringify(publicRoom(room,null)),{EX:3600}).catch(console.error); }
function message(room,text,type='system',name='Doodle Club') { room.messages.push({id:crypto.randomUUID(),text,type,name}); room.messages=room.messages.slice(-100); }
function later(room, fn, ms) { clearTimeout(room.timer); room.timer=setTimeout(fn,ms); }
function finish(room) { clearTimeout(room.timer); room.status='finished'; room.round=room.rounds; room.deadline=0; message(room,'That’s a wrap! Every doodle deserves a little applause.'); emit(room); if(db) db.query('INSERT INTO games(room_code,results) VALUES($1,$2)',[room.id,JSON.stringify(room.players.map(({name,score})=>({name,score})))]).catch(console.error); }
function nextTurn(room) {
 if(room.players.length<2) { clearTimeout(room.timer); room.status='lobby'; room.deadline=0; room.word=null; message(room,'Waiting for one more player to join.'); return emit(room); }
 room.turnIndex++;
 if(room.turnIndex>=room.turnOrder.length) { room.round++; room.turnIndex=0; room.turnOrder=room.players.map(p=>p.id); }
 if(room.round>room.rounds) return finish(room);
 const drawer=room.players.find(p=>p.id===room.turnOrder[room.turnIndex]);
 if(!drawer) return nextTurn(room);
 room.drawerId=drawer.id; room.status='choosing'; room.word=null; room.choices=choices(); room.guessed=[]; room.strokes=[]; room.deadline=Date.now()+15000;
 message(room,`${drawer.name} is choosing a word.`); emit(room); later(room,()=>selectWord(room,room.choices[0]),15000);
}
function selectWord(room,word) { room.word=word; room.choices=[]; room.status='drawing'; room.deadline=Date.now()+room.duration*1000; emit(room); later(room,()=>reveal(room),room.duration*1000); }
function reveal(room) { if(room.status!=='drawing') return; room.status='reveal'; room.deadline=Date.now()+5000; message(room,`The word was ${room.word}!`); emit(room); later(room,()=>nextTurn(room),5000); }
function leave(socket) { const room=rooms.get(socket.data.roomId); if(!room) return; socket.leave(room.id); socket.data.roomId=null; room.players=room.players.filter(p=>p.id!==socket.id); if(!room.players.length) {clearTimeout(room.timer); rooms.delete(room.id); if(redis?.isReady) redis.del(`doodle:room:${room.id}`).catch(console.error); return;} if(room.hostId===socket.id) room.hostId=room.players[0].id; message(room,`${socket.data.name} left the room.`); if(room.players.length<2 && !['lobby','finished'].includes(room.status)) {clearTimeout(room.timer);room.status='lobby';room.word=null;room.deadline=0;} else if(room.drawerId===socket.id && ['drawing','choosing'].includes(room.status)) { clearTimeout(room.timer);nextTurn(room); } else if(room.status==='drawing' && room.players.filter(p=>p.id!==room.drawerId).every(p=>room.guessed.includes(p.id))) reveal(room); emit(room); }
io.on('connection',socket=>{
 let lastChat=0, drawCount=0, drawWindow=0;
 socket.on('join',(data={},ack=()=>{})=>{
 if(typeof ack!=='function') return; if(!data||typeof data!=='object') return ack({error:'Invalid room request.'});
 const name=String(data.name||'').trim().slice(0,20); if(!name) return ack({error:'Choose a nickname first.'});
 let room;
 if(data.mode==='join') {room=rooms.get(String(data.code||'').trim().toUpperCase()); if(!room) return ack({error:'We couldn’t find that room. Check the invite code.'}); if(room.players.length>=room.maxPlayers) return ack({error:'That room is full. Try another one.'});}
 else if(data.mode==='freeplay') room=[...rooms.values()].find(r=>r.kind==='public'&&r.status==='lobby'&&r.players.length<r.maxPlayers&&r.id!==socket.data.roomId);
 leave(socket); socket.data.name=name;
 const player={id:socket.id,name,score:0,avatar:Math.max(0,Math.min(5,Math.floor(Number(data.avatar))||0))};
 if(!room) {room=createRoom(player,data.settings,data.mode==='freeplay'?'public':'private'); while(rooms.has(room.id)) room.id=crypto.randomUUID().slice(0,6).toUpperCase(); rooms.set(room.id,room);} else room.players.push(player);
 socket.data.roomId=room.id; socket.join(room.id); message(room,`${name} joined the club.`); ack({ok:true}); emit(room);
 if(room.kind==='public'&&room.players.length>=2&&room.status==='lobby') {room.round=1;room.turnOrder=room.players.map(p=>p.id);room.turnIndex=-1;nextTurn(room);}
 });
 socket.on('start',()=>{const r=rooms.get(socket.data.roomId);if(!r||r.hostId!==socket.id||!['lobby','finished'].includes(r.status)||r.players.length<2)return;r.players.forEach(p=>p.score=0);r.round=1;r.turnOrder=r.players.map(p=>p.id);r.turnIndex=-1;nextTurn(r);});
 socket.on('choose',word=>{const r=rooms.get(socket.data.roomId);if(r?.drawerId===socket.id&&r.status==='choosing'&&r.choices.includes(word))selectWord(r,word);});
 socket.on('chat',value=>{const r=rooms.get(socket.data.roomId);if(!r||typeof value!=='string'||Date.now()-lastChat<350)return;lastChat=Date.now();const text=value.trim().slice(0,160);if(!text)return;
 const p=r.players.find(p=>p.id===socket.id);
 if(r.status==='drawing') {
 if(Date.now()>=r.deadline)return reveal(r);
 if(socket.id===r.drawerId||r.guessed.includes(socket.id))return;
 if(normalize(text)===normalize(r.word)) {const points=guessPoints((r.deadline-Date.now())/1000,r.duration);p.score+=points;r.guessed.push(p.id);const drawer=r.players.find(p=>p.id===r.drawerId);if(drawer)drawer.score+=75;message(r,`${p.name} guessed the word! +${points}`,'correct'); if(r.players.filter(p=>p.id!==r.drawerId).every(p=>r.guessed.includes(p.id))) return reveal(r); emit(r);return;}
 } message(r,text,'chat',p.name);emit(r); });
 socket.on('stroke',stroke=>{const r=rooms.get(socket.data.roomId);if(!r||r.drawerId!==socket.id||r.status!=='drawing')return;if(Date.now()-drawWindow>1000){drawWindow=Date.now();drawCount=0;}if(++drawCount>150||r.strokes.length>=30000)return;if(!stroke||!Array.isArray(stroke.from)||!Array.isArray(stroke.to)||stroke.from.length!==2||stroke.to.length!==2||![...stroke.from,...stroke.to].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||!/^#[0-9a-f]{6}$/i.test(stroke.color)||!Number.isFinite(stroke.size)||stroke.size<1||stroke.size>40)return;const clean={from:stroke.from,to:stroke.to,color:stroke.color,size:stroke.size};r.strokes.push(clean);socket.to(r.id).emit('stroke',clean);});
 socket.on('clear',()=>{const r=rooms.get(socket.data.roomId);if(r?.drawerId===socket.id&&r.status==='drawing'){r.strokes=[];io.to(r.id).emit('clear');}});
 socket.on('leave',()=>leave(socket)); socket.on('disconnect',()=>leave(socket));
});
http.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Doodle Club ready on http://localhost:'+(process.env.PORT||3000)));
