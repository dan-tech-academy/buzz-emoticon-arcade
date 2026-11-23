import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,step,equip,respawn,hitEnemy,hurtPlayer} from '../src/engine.js';
const advance=(g,n,input={})=>{for(let i=0;i<n;i++)step(g,input,1/60);};
const settled=()=>{const g=createGame();advance(g,10);return g;};
test('running and gravity land on the floor without tunneling',()=>{
  const g=settled();advance(g,60,{right:true});assert.ok(g.player.x>350);assert.equal(g.player.y+g.player.h,480);assert.equal(g.player.grounded,true);
});
test('two jumps work, a third cannot reset vertical velocity',()=>{
  const g=settled();step(g,{jump:true},1/60);advance(g,6);step(g,{jump:true},1/60);const velocity=g.player.vy;
  step(g,{jump:true},1/60);assert.ok(g.player.vy>velocity);assert.equal(g.player.jumps,2);
});
test('falling into a gap costs one heart and returns to a safe spawn',()=>{
  const g=settled();Object.assign(g.player,{x:885,y:660,invincible:0});step(g,{},1/60);
  assert.equal(g.player.hp,4);assert.equal(g.player.x,80);assert.ok(g.player.y<480);assert.equal(g.status,'playing');
});
test('damage immunity prevents a contact cluster from deleting all hearts',()=>{
  const g=settled();g.player.invincible=0;assert.equal(hurtPlayer(g),true);assert.equal(hurtPlayer(g),false);assert.equal(g.player.hp,4);
  g.player.invincible=0;g.player.dash=.1;assert.equal(hurtPlayer(g),false);
});
test('melee hits a nearby target in front but not one behind',()=>{
  const g=settled(),front=g.enemies[0],back=g.enemies[1];Object.assign(front,{x:g.player.x+45,y:432});Object.assign(back,{x:g.player.x-50,y:432});
  step(g,{attack:true},1/60);assert.equal(front.hp,1);assert.equal(back.hp,2);
});
test('locked weapons cannot be equipped and invalid IDs never unlock',()=>{
  const g=createGame(0,{owned:['devil','toString','__proto__','made-up']});assert.deepEqual(g.owned,['smile','devil']);assert.equal(equip(g,'angel'),false);assert.equal(g.equipped,'smile');assert.equal(equip(g,'devil'),true);
});
test('fire emoji launches a damaging projectile beyond melee reach',()=>{
  const g=createGame(0,{owned:['devil'],equipped:'devil'});advance(g,10);const e=g.enemies[0];Object.assign(e,{x:300,origin:300,y:432});
  step(g,{attack:true},1/60);assert.ok(g.projectiles.some(b=>b.friendly));advance(g,25);assert.ok(e.hp<e.maxHp);
});
test('ice emoji slows an enemy struck by its projectile',()=>{
  const g=createGame(0,{owned:['cool'],equipped:'cool'});advance(g,10);const e=g.enemies[0];Object.assign(e,{x:250,origin:250,y:432});step(g,{attack:true},1/60);advance(g,20);assert.ok(e.slow>0);
});
test('healing slash restores a missing heart only on an actual kill',()=>{
  const g=createGame(0,{owned:['angel'],equipped:'angel'});g.player.hp=3;const e=g.enemies[0];hitEnemy(g,e,1);assert.equal(g.player.hp,3);hitEnemy(g,e,1);assert.equal(g.player.hp,4);hitEnemy(g,e,1);assert.equal(g.player.hp,4);
});
test('boss death grants its emoji, retains prior unlocks and ends the stage',()=>{
  const g=createGame(1,{owned:['devil'],equipped:'devil'}),boss=g.enemies.find(e=>e.boss);hitEnemy(g,boss,boss.maxHp);
  assert.equal(g.status,'cleared');assert.deepEqual(g.owned,['smile','devil','cool']);assert.equal(g.events.at(-1).type,'reward');const x=g.player.x;step(g,{right:true},1/60);assert.equal(g.player.x,x);
});
test('checkpoint heals and death retry resets boss health and projectiles',()=>{
  const g=settled();g.player.x=2780;g.player.hp=2;step(g,{},1/60);assert.equal(g.checkpoint,2750);assert.equal(g.player.hp,5);
  const boss=g.enemies.find(e=>e.boss);boss.hp=2;g.bossActive=true;g.projectiles.push({life:3});g.status='dead';respawn(g);
  assert.equal(g.player.x,2750);assert.equal(g.player.hp,5);assert.equal(boss.hp,boss.maxHp);assert.equal(g.projectiles.length,0);assert.equal(g.bossActive,false);
});
test('BUZZ requires full energy, kills nearby minions and clears enemy shots',()=>{
  const g=settled(),e=g.enemies[0];g.player.energy=50;step(g,{buzz:true},1/60);assert.ok(!g.events.some(x=>x.type==='buzz'));
  g.player.energy=100;Object.assign(e,{x:150,y:432});g.projectiles.push({x:140,y:440,w:20,h:20,vx:-100,vy:0,life:3,friendly:false});step(g,{buzz:true},1/60);
  assert.equal(e.hp,0);assert.ok(g.player.energy<100);assert.equal(g.projectiles.length,0);
});
test('boss arena prevents escaping the encounter while leaving dodge space',()=>{
  const g=settled();g.player.x=3510;step(g,{},1/60);assert.equal(g.bossActive,true);advance(g,60,{left:true});assert.ok(g.player.x>=3450);
});
test('each boss rewards the matching equipable emoji',()=>{
  for(const [level,reward] of ['devil','cool','angel'].entries()){const g=createGame(level);hitEnemy(g,g.enemies.at(-1),100);assert.equal(equip(g,reward),true);assert.equal(g.equipped,reward);}
});
test('a late aerial dash lands on solid ground instead of tunneling through it',()=>{
  const g=settled();Object.assign(g.player,{x:200,y:413,vy:300,grounded:false,invincible:0});
  step(g,{dash:true},1/60);advance(g,25);assert.equal(g.player.y+g.player.h,480);assert.equal(g.player.hp,5);
});
test('a stomp separates the player from a surviving stage3 minion',()=>{
  const g=createGame(2),e=g.enemies[0];Object.assign(g.player,{x:e.x,y:386,vy:220,invincible:0});
  step(g,{},1/60);assert.equal(e.hp,1);advance(g,3);assert.equal(g.player.hp,5);assert.ok(g.player.y+g.player.h<e.y);
});
