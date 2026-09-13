import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,publicRoom,guessPoints,normalize,choices,truthDareOptions} from '../server/game.mjs';
test('word choice has three unique options',()=>{for(let i=0;i<100;i++)assert.equal(new Set(choices()).size,3);});
test('score rewards speed and clamps late guesses',()=>{assert.equal(guessPoints(60,60),10);assert.equal(guessPoints(30,60),6);assert.equal(guessPoints(-2,60),1);});
test('word remains secret until guessed or revealed',()=>{const r=createRoom({id:'a',name:'Artist'});Object.assign(r,{word:'ice cream',choices:['one','two','three'],drawerId:'a',status:'drawing'});assert.equal(publicRoom(r,'b').word,null);assert.deepEqual(publicRoom(r,'b').choices,[]);assert.equal(publicRoom(r,'a').word,'ice cream');r.guessed=['b'];assert.equal(publicRoom(r,'b').word,'ice cream');r.status='reveal';assert.equal(publicRoom(r,'c').word,'ice cream');});
test('room settings stay bounded',()=>{const r=createRoom({id:'a'},{rounds:99,duration:1});assert.equal(r.rounds,8);assert.equal(r.duration,30);});
test('guess matching ignores case and extra spaces, not spelling',()=>{assert.equal(normalize('  Ice   CREAM '),'ice cream');assert.notEqual(normalize('icecrem'),'ice cream');});
test('truth or dare options include two prompts each',()=>{const options=truthDareOptions();assert.equal(options.truth.length,2);assert.equal(options.dare.length,2);assert.equal(new Set(options.truth).size,2);assert.equal(new Set(options.dare).size,2);});
