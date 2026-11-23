// Fixed-step platformer rules; no DOM or rendering dependencies.
export const HEIGHT = 540;
export const WEAPONS = {
  smile: { name:'Cười xoáy', title:'Mặt cười', code:':)', color:'#fbd76a', description:'Chém cận chiến. Nhanh, gọn, không tốn năng lượng.' },
  devil: { name:'Quỷ lửa', title:'Tiểu quỷ', code:'>:)', color:'#ff758c', description:'Bắn cầu lửa. Hạ Quỷ Spam để thu phục.' },
  cool: { name:'Băng tiễn', title:'Ngầu lạnh', code:'B-)', color:'#74e7ed', description:'Bắn băng làm chậm địch. Hạ Trùm Đóng Băng để thu phục.' },
  angel: { name:'Hào quang', title:'Thiên thần', code:'O:-)', color:'#c3afff', description:'Chém rộng, hồi một tim khi hạ địch. Hạ Thiên Thần Lỗi để thu phục.' }
};
export const STAGES = [
  { name:'Phố nick sáng đèn', subtitle:'Vượt phố đêm. Tìm và hạ Quỷ Spam.', boss:'Quỷ Spam', reward:'devil', color:'#bca7ff', sky:'#141326' },
  { name:'Máy chủ băng giá', subtitle:'Mang Quỷ lửa đi phá băng.', boss:'Trùm Đóng Băng', reward:'cool', color:'#74e7ed', sky:'#10212d' },
  { name:'Đỉnh tháp offline', subtitle:'Trận cuối. Thu phục Thiên Thần Lỗi.', boss:'Thiên Thần Lỗi', reward:'angel', color:'#ffba79', sky:'#261b2b' }
];
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const center=o=>({x:o.x+o.w/2,y:o.y+o.h/2});
const near=(a,b,r)=>Math.hypot(a.x-b.x,a.y-b.y)<r;
function enemy(x,level,index,boss=false){
  const hp=boss?13+level*4:2+(level===2?1:0);
  return {x,y:boss?382:432,w:boss?86:42,h:boss?98:48,vx:0,vy:0,hp,maxHp:hp,boss,face:boss?STAGES[level].reward:['devil','cry','laugh'][index%3],direction:-1,origin:x,cooldown:1.7,phase:0,flash:0,slow:0,grounded:false,dashHit:-1};
}
export function createGame(level=0,previous={}){
  level=clamp(Number.isInteger(level)?level:0,0,2);
  const owned=[...new Set(['smile',...(Array.isArray(previous.owned)?previous.owned:[]).filter(id=>Object.hasOwn(WEAPONS,id))])];
  const platforms=[[0,480,830],[960,480,760],[1850,480,690],[2700,480,1700],[300,382,160],[580,310,160],[1120,382,170],[1450,314,150],[1970,380,170],[2290,308,160],[2820,380,160],[3060,320,160]].map(([x,y,w])=>({x,y,w,h:y===480?60:20}));
  const coins=[];
  for(const f of platforms)for(let x=f.x+70;x<f.x+f.w-30;x+=110)coins.push({x,y:f.y-42,taken:false});
  return {level,width:4400,status:'playing',time:0,score:previous.score||0,collected:previous.collected||0,owned,equipped:owned.includes(previous.equipped)?previous.equipped:'smile',
    player:{x:80,y:410,w:30,h:66,vx:0,vy:0,hp:5,maxHp:5,face:1,grounded:false,jumps:0,coyote:0,attack:0,attackCooldown:0,dash:0,dashCooldown:0,invincible:1,energy:100,id:0},
    checkpoint:80,checkpointActive:false,platforms,coins,enemies:[...[640,1160,1510,2060,2380,2850,3130].map((x,i)=>enemy(x,level,i)),enemy(3930,level,0,true)],projectiles:[],effects:[],events:[],combo:0,comboTime:0,kills:0,bossActive:false};
}
export function equip(g,id){if(!g.owned.includes(id)||!Object.hasOwn(WEAPONS,id))return false;g.equipped=id;return true;}
const emit=(g,type,detail={})=>g.events.push({type,...detail});
const effect=(g,kind,x,y,color,extra={})=>g.effects.push({kind,x,y,color,life:.5,maxLife:.5,...extra});
function land(b,platforms,dt){
  const bottom=b.y+b.h;b.vy+=1850*dt;b.y+=b.vy*dt;b.grounded=false;
  for(const p of platforms)if(b.vy>=0&&bottom<=p.y+2&&b.y+b.h>=p.y&&b.x+b.w>p.x+2&&b.x<p.x+p.w-2){b.y=p.y-b.h;b.vy=0;b.grounded=true;}
}
export function hurtPlayer(g,damage=1,direction=-1){
  const p=g.player;if(p.invincible>0||p.dash>0||g.status!=='playing')return false;
  p.hp=Math.max(0,p.hp-damage);p.invincible=1.3;p.vx=direction*310;p.vy=-280;g.combo=0;
  emit(g,'hurt');effect(g,'burst',p.x+15,p.y+25,'#ff758c');
  if(!p.hp){g.status='dead';emit(g,'dead');}return true;
}
export function hitEnemy(g,e,damage,direction=1){
  if(e.hp<=0||g.status!=='playing'||(e.boss&&!g.bossActive))return false;
  e.hp=Math.max(0,e.hp-damage);e.flash=.17;e.x+=direction*(e.boss?7:22);g.player.energy=Math.min(100,g.player.energy+5);
  emit(g,'hit',{boss:e.boss});effect(g,'burst',e.x+e.w/2,e.y+e.h/2,WEAPONS[g.equipped].color);
  if(e.hp<=0){
    g.combo++;g.comboTime=3;g.kills++;g.score+=(e.boss?2000:120)*Math.min(4,g.combo);
    effect(g,'text',e.x,e.y-10,'#fbd76a',{text:e.boss?'THU PHỤC!':`${g.combo>1?g.combo+' HIT! ':''}+${120*Math.min(4,g.combo)}`});emit(g,'kill',{face:e.face});
    if(g.equipped==='angel')g.player.hp=Math.min(g.player.maxHp,g.player.hp+1);
    if(e.boss){const reward=STAGES[g.level].reward;if(!g.owned.includes(reward))g.owned.push(reward);g.status='cleared';g.score+=g.player.hp*150;emit(g,'reward',{id:reward});}
  }
  return true;
}
function attack(g){
  const p=g.player,w=g.equipped;if(p.attackCooldown>0)return;p.attack=.2;p.attackCooldown=w==='smile'?.27:.36;emit(g,'attack',{weapon:w});
  if(w==='devil'||w==='cool')g.projectiles.push({x:p.x+15+p.face*24,y:p.y+25,w:21,h:17,vx:p.face*650,vy:0,friendly:true,life:1.3,face:w,damage:w==='devil'?1.6:1.2});
  else{const reach=w==='angel'?126:96,box={x:p.face>0?p.x+6:p.x-reach+24,y:p.y-18,w:reach,h:100};
    effect(g,'slash',p.x+15+p.face*35,p.y+31,WEAPONS[w].color,{direction:p.face,life:.19,maxLife:.19});
    for(const e of g.enemies)if(e.hp>0&&overlaps(box,e))hitEnemy(g,e,w==='angel'?1.7:1,p.face);
  }
}
function buzz(g){
  const p=g.player;if(p.energy<100)return;p.energy=0;p.invincible=Math.max(p.invincible,.6);
  effect(g,'buzz',p.x+15,p.y+30,'#d9fc7a',{life:.6,maxLife:.6});emit(g,'buzz');
  for(const e of g.enemies)if(e.hp>0&&near(center(p),center(e),235))hitEnemy(g,e,4,Math.sign(e.x-p.x)||1);
  g.projectiles=g.projectiles.filter(b=>b.friendly||!near(center(p),center(b),240));
}
export function respawn(g){
  if(g.status!=='dead')return;g.status='playing';
  Object.assign(g.player,{x:g.checkpoint,y:380,vx:0,vy:0,hp:5,invincible:2,energy:100,jumps:0,dash:0,attack:0});
  g.projectiles=[];g.effects=[];g.combo=0;g.bossActive=false;
  for(const e of g.enemies.filter(e=>e.hp>0||e.boss))Object.assign(e,{x:e.origin,y:e.boss?382:432,hp:e.maxHp,phase:0,cooldown:1.7,vx:0,vy:0});
}
export function step(g,input,dt){
  g.events=[];if(g.status!=='playing')return;dt=clamp(dt,0,1/30);g.time+=dt;const p=g.player;
  for(const k of ['attack','attackCooldown','dash','dashCooldown','invincible'])p[k]=Math.max(0,p[k]-dt);
  p.energy=Math.min(100,p.energy+dt*8);g.comboTime-=dt;if(g.comboTime<=0)g.combo=0;
  for(const f of g.effects){f.life-=dt;if(f.kind==='text')f.y-=30*dt;}g.effects=g.effects.filter(f=>f.life>0);
  p.coyote=p.grounded?.1:Math.max(0,p.coyote-dt);
  if(input.jump&&(p.jumps<2||p.coyote>0)){const second=!p.grounded&&p.coyote<=0;p.vy=second?-590:-650;p.jumps=second?p.jumps+1:1;p.grounded=false;p.coyote=0;effect(g,'ring',p.x+15,p.y+65,second?'#d9fc7a':'#c3afff',{life:.3,maxLife:.3});emit(g,'jump');}
  const axis=(input.right?1:0)-(input.left?1:0);if(axis)p.face=axis;
  if(input.dash&&p.dashCooldown<=0){p.dash=.19;p.dashCooldown=.9;p.id++;emit(g,'dash');}
  if(p.dash>0){p.vx=p.face*830;p.vy*=.4;}else p.vx+=clamp(axis*315-p.vx,-2400*dt,2400*dt);
  p.x=clamp(p.x+p.vx*dt,g.bossActive?3450:0,g.width-p.w);
  // Dash changes velocity, not whether the floor exists.
  land(p,g.platforms,dt);if(p.grounded)p.jumps=0;
  if(input.attack)attack(g);if(input.buzz)buzz(g);if(g.status!=='playing')return;
  if(p.y>HEIGHT+100){p.invincible=0;p.dash=0;hurtPlayer(g);if(g.status==='playing'){p.x=g.checkpoint;p.y=380;p.vx=p.vy=0;p.jumps=0;p.invincible=1.5;g.bossActive=false;}}
  if(p.x>=2740&&!g.checkpointActive){g.checkpoint=2750;g.checkpointActive=true;p.hp=5;emit(g,'checkpoint');}
  if(p.x>3500&&!g.bossActive){g.bossActive=true;emit(g,'boss');}
  for(const c of g.coins)if(!c.taken&&near(center(p),c,34)){c.taken=true;g.collected++;g.score+=25;p.energy=Math.min(100,p.energy+3);emit(g,'coin');effect(g,'ring',c.x,c.y,'#fbd76a',{life:.23,maxLife:.23});}
  for(const e of g.enemies){
    if(e.hp<=0)continue;e.flash=Math.max(0,e.flash-dt);e.slow=Math.max(0,e.slow-dt);e.cooldown-=dt;const distance=p.x-e.x;e.direction=Math.sign(distance)||1;
    if(e.boss){
      if(!g.bossActive)continue;e.phase=(e.phase+dt)%4;const rage=e.hp<e.maxHp/2;e.vx=e.phase>2.6?e.direction*(rage?340:255):e.direction*58;
      if(e.cooldown<=0){e.cooldown=rage?1:1.55;const t=center(p),s=center(e),angle=Math.atan2(t.y-s.y,t.x-s.x);
        for(const offset of rage?[-.19,0,.19]:[0])g.projectiles.push({x:s.x,y:s.y,w:22,h:22,vx:Math.cos(angle+offset)*250,vy:Math.sin(angle+offset)*250,life:4,friendly:false,face:e.face});emit(g,'bossShot');}
      e.x=clamp(e.x+e.vx*dt*(e.slow>0?.4:1),3470,4280);
    }else{
      const active=Math.abs(distance)<350,dir=active?e.direction:Math.sin(g.time+e.origin)>0?1:-1;
      const ground=g.platforms.find(f=>f.y===480&&e.origin>=f.x&&e.origin<f.x+f.w);
      e.vx=dir*(active?85+g.level*13:32)*(e.slow>0?.35:1);e.x=clamp(e.x+e.vx*dt,Math.max(ground.x+5,e.origin-180),Math.min(ground.x+ground.w-e.w-5,e.origin+180));
    }
    land(e,g.platforms,dt);
    if(overlaps(p,e)){if(p.dash>0&&e.dashHit!==p.id){e.dashHit=p.id;hitEnemy(g,e,2,p.face);}else if(p.vy>120&&p.y+p.h<e.y+28&&!e.boss){hitEnemy(g,e,2,p.face);p.y=e.y-p.h;p.vy=-430;p.jumps=1;}else hurtPlayer(g,1,Math.sign(p.x-e.x)||-1);}
  }
  for(const b of g.projectiles){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.friendly){for(const e of g.enemies)if(e.hp>0&&overlaps(b,e)){const hit=hitEnemy(g,e,b.damage,Math.sign(b.vx));if(hit&&b.face==='cool')e.slow=2;b.life=0;break;}}
    else if(overlaps(b,p)){hurtPlayer(g,1,Math.sign(b.vx));b.life=0;}}
  g.projectiles=g.projectiles.filter(b=>b.life>0&&b.x>-80&&b.x<g.width+80);
}
