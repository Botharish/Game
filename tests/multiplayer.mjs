import { io } from 'socket.io-client';
import assert from 'node:assert/strict';
const url=process.env.TEST_URL||'http://localhost:3000';
const clients=[];
function connect(){return new Promise((resolve,reject)=>{const s=io(url,{transports:['websocket'],reconnection:false});clients.push(s);s.on('room',r=>s.room=r);s.once('connect',()=>resolve(s));s.once('connect_error',reject);});}
function roomWhen(s,predicate,timeout=8000){if(s.room&&predicate(s.room))return Promise.resolve(s.room);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{s.off('room',listener);reject(Error('Timed out waiting for room'));},timeout);function listener(r){if(predicate(r)){clearTimeout(timer);s.off('room',listener);resolve(r);}}s.on('room',listener);});}
function join(s,data){return new Promise(resolve=>s.emit('join',data,resolve));}
function event(s,name){return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error(`No ${name} event`)),4000);s.once(name,data=>{clearTimeout(t);resolve(data);});});}
try{
 const a=await connect(),b=await connect();
 assert.ok((await join(a,{name:'Artist',mode:'create',settings:{rounds:1,duration:30}})).ok);
 await roomWhen(a,r=>r.status==='lobby');const code=a.room.id;
 assert.ok((await join(b,{name:'Guesser',mode:'join',code})).ok);
 await roomWhen(a,r=>r.players.length===2); a.emit('start');
 await roomWhen(a,r=>r.status==='choosing');await roomWhen(b,r=>r.status==='choosing');
 assert.equal(a.room.choices.length,3);assert.equal(b.room.choices.length,0);
 const word=a.room.choices[0];a.emit('choose',word);
 await roomWhen(b,r=>r.status==='drawing');assert.equal(b.room.word,null);assert.equal(a.room.word,word);
 const stroke={from:[.1,.2],to:[.5,.6],color:'#333333',size:6};const received=event(b,'stroke');a.emit('stroke',stroke);assert.deepEqual(await received,stroke);
 const cleared=event(b,'clear');a.emit('clear');await cleared;
 b.emit('chat',word.toUpperCase());await roomWhen(b,r=>r.status==='reveal');assert.equal(b.room.word,word);assert.ok(b.room.players.find(p=>p.id===b.id).score>=490);assert.equal(b.room.players.find(p=>p.id===a.id).score,75);
 await roomWhen(b,r=>r.status==='choosing'&&r.drawerId===b.id);b.emit('choose',b.room.choices[0]);await roomWhen(b,r=>r.status==='drawing');await roomWhen(a,r=>r.status==='drawing');a.emit('chat',b.room.word);
 await roomWhen(a,r=>r.status==='finished',8000);assert.equal(a.room.round,1);assert.equal(a.room.players.length,2);
 a.disconnect();await roomWhen(b,r=>r.hostId===b.id);b.disconnect();
 const c=await connect(),d=await connect();await join(c,{name:'Public A',mode:'freeplay'});await roomWhen(c,r=>r.status==='lobby');await join(d,{name:'Public B',mode:'freeplay'});await roomWhen(d,r=>r.status==='choosing');assert.equal(c.room.id,d.room.id);c.disconnect();await roomWhen(d,r=>r.status==='lobby');
 console.log('PASS: private rooms, word secrecy, live strokes, clear, speed scoring, drawer rewards, turn rotation, final leaderboard, host transfer, Freeplay, and disconnect recovery.');
}finally{clients.forEach(s=>s.disconnect());}
