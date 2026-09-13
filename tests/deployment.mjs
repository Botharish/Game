import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const port='3137', url=`http://127.0.0.1:${port}`;
const origin='https://game-psi-blond.vercel.app';
const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:port,GAME_SERVER_ONLY:'true',NODE_ENV:'production',CLIENT_ORIGINS:origin,DATABASE_URL:'',REDIS_URL:''},stdio:['ignore','pipe','pipe']});
try {
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server did not start')),10000);server.stdout.on('data',data=>{if(String(data).includes('ready')){clearTimeout(t);resolve();}});server.once('exit',code=>{clearTimeout(t);reject(Error(`Server exited: ${code}`));});server.stderr.on('data',data=>process.stderr.write(data));});
 const health=await fetch(`${url}/health`);assert.deepEqual(await health.json(),{status:'ok'});
 const handshake=await fetch(`${url}/socket.io/?EIO=4&transport=polling`,{headers:{Origin:origin}});assert.equal(handshake.status,200);assert.equal(handshake.headers.get('access-control-allow-origin'),origin);assert.ok((await handshake.text()).startsWith('0{"sid":'));
 const denied=await fetch(`${url}/socket.io/?EIO=4&transport=polling`,{headers:{Origin:'https://unapproved.example'}});assert.equal(denied.status,403);
 await new Promise((resolve,reject)=>{const test=spawn(process.execPath,['tests/multiplayer.mjs'],{env:{...process.env,TEST_URL:url},stdio:'inherit'});test.once('exit',code=>code===0?resolve():reject(Error(`Multiplayer test exited ${code}`)));});
 console.log('PASS: standalone server, health check, cross-origin polling handshake, origin restrictions, and multiplayer.');
} finally { server.kill('SIGTERM'); }
