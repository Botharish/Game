import { randomUUID, randomInt } from 'node:crypto';
export const WORDS = ['pineapple','astronaut','volcano','jellyfish','skateboard','campfire','cactus','rainbow','octopus','lighthouse','snowman','butterfly','pizza','spaceship','watermelon','guitar','penguin','treehouse','umbrella','dinosaur','robot','treasure','mermaid','dragon','sunflower','hot air balloon','roller coaster','ice cream','birthday cake','submarine','hedgehog','telescope','sailboat','mushroom','fireworks','elephant','sandcastle','unicorn','popcorn','helicopter','koala','pancakes','windmill','suitcase','toothbrush','crocodile','backpack','headphones','basketball','flamingo'];
export function normalize(value) { return String(value).toLowerCase().trim().replace(/\s+/g, ' '); }
export function guessPoints(remaining, duration) { return 100 + Math.round(400 * Math.max(0, Math.min(1, remaining / duration))); }
export function choices() { const pool = [...WORDS]; return Array.from({length:3}, () => pool.splice(randomInt(pool.length),1)[0]); }
export function createRoom(host, settings = {}, kind = 'private') {
 return { id:randomUUID().slice(0,6).toUpperCase(), kind, hostId:host.id, players:[host], status:'lobby', round:0, rounds:Math.max(1,Math.min(8,Math.floor(Number(settings.rounds))||3)), duration:Math.max(30,Math.min(120,Math.floor(Number(settings.duration))||60)), maxPlayers:8, drawerId:null, word:null, choices:[], guessed:[], strokes:[], messages:[], turnOrder:[], turnIndex:-1, deadline:0 };
}
export function publicRoom(room, viewer) {
 const { word, choices: words, timer, turnOrder, ...safe } = room;
 const knows = viewer === room.drawerId || room.guessed.includes(viewer) || ['reveal','finished'].includes(room.status);
 return { ...safe, word:knows ? word : null, choices: viewer === room.drawerId && room.status === 'choosing' ? words : [], hint:word ? [...word].map(c=>c===' '?'  ':'_').join(' ') : '', players:room.players.map(p=>({...p, guessed:room.guessed.includes(p.id)})) };
}
