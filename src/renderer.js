import { STAGES, WEAPONS, HEIGHT, clamp } from './engine.js';
const C={ink:'#10101b',white:'#f6f4ff',muted:'#a9a5bd',purple:'#bca7ff',lime:'#d9fc7a',gold:'#fbd76a',red:'#ff758c',cyan:'#74e7ed',building:'#202036',buildingFar:'#1b1a2d',platform:'#42405d',edge:'#77718e',dark:'#242238'};
export function createRenderer(canvas,images){
  const ctx=canvas.getContext('2d');let width=960,camera=0,shake=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function resize(){const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);width=HEIGHT*box.width/box.height;canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);}
  new ResizeObserver(resize).observe(canvas);resize();
  function image(id,x,y,size,alpha=1){const img=images[id];ctx.globalAlpha=alpha;if(img?.complete&&img.naturalWidth)ctx.drawImage(img,x-size/2,y-size/2,size,size);else{ctx.fillStyle=C.gold;ctx.beginPath();ctx.arc(x,y,size*.38,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
  function line(points,color,width=4){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  function text(label,x,y,size=12,color=C.white,align='left'){ctx.font=`${size>20?900:600} ${size}px Arial`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(label,x,y);}
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
  function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function background(g){
    const stage=STAGES[g.level],t=g.time;
    rect(0,0,width,HEIGHT,stage.sky);
    for(let i=0;i<48;i++){const x=((i*173.71-camera*.07)%(width+70)+width+70)%(width+70);const y=28+(i*53.3)%290;circle(x,y,i%3===0?1.3:.7,i%5===0?stage.color:C.edge);}
    circle(width*.79-camera*.018,116,43,C.dark);circle(width*.79-camera*.018+10,107,38,stage.sky);
    for(let layer=0;layer<2;layer++){
      const speed=layer?.27:.12,spacing=layer?160:190;
      const start=Math.floor(camera*speed/spacing)-1;
      for(let n=start;n<start+width/spacing+3;n++){
        const i=((n%31)+31)%31,x=n*spacing-camera*speed,h=90+(i*73+layer*60)%190,y=465-h,w=spacing-15;
        rect(x,y,w,h,layer?C.building:C.buildingFar);
        rect(x+14,y-13,w-28,13,layer?C.building:C.buildingFar);
        if(layer){for(let row=0;row<Math.floor(h/30)-1;row++)for(let col=0;col<4;col++)if((row*7+col*3+i)%4!==0)rect(x+15+col*29,y+22+row*29,9,11,(row+col+i)%7===0?stage.color:C.platform);
          if(i%3===0){rect(x+10,y+28,103,32,C.ink);rect(x+10,y+28,3,32,stage.color);text(['BUZZ!','ONLINE 2005','Y! NIGHT'][i%3],x+22,y+49,12,stage.color);}
        }
      }
    }
    // Faint cables, a second parallax plane, and drifting server dust.
    line([[0,235],[width*.3,255],[width*.65,240],[width,270]],C.platform,1);
    if(g.level===1)for(let i=0;i<28;i++)circle(((i*111-camera*.4+t*9)%(width+50)+width+50)%(width+50),(i*83+t*24)%HEIGHT,1.4,C.cyan);
    rect(0,514,width,26,C.ink);
  }
  function stick(p,g){
    const x=p.x+15,y=p.y,color=WEAPONS[g.equipped].color;
    const running=Math.abs(p.vx)>20&&p.grounded,phase=g.time*17,leg=running?Math.sin(phase)*13:!p.grounded?13:3;
    if(p.dash>0){for(let i=1;i<=5;i++){ctx.globalAlpha=.17*(1-i/6);rect(x-p.face*i*17-9,y+20,18,41,color);}ctx.globalAlpha=1;}
    if(p.invincible>0&&Math.floor(g.time*14)%2===0)ctx.globalAlpha=.55;
    const alpha=ctx.globalAlpha;
    ctx.save();ctx.translate(x,y);ctx.rotate(p.dash>0?p.face*.3:0);
    line([[0,23],[0,43]],C.white,6);
    line([[0,41],[-leg,52],[-leg-p.face*5,64]],C.white,5);
    line([[0,41],[leg,53],[leg+p.face*6,64]],C.white,5);
    line([[0,27],[-p.face*10,37],[-p.face*17,30]],C.white,4);
    const swing=p.attack>0?1:0;
    line([[0,27],[p.face*(swing?20:10),swing?22:37],[p.face*(swing?36:18),swing?20:32]],C.white,4);
    line([[0,24],[-p.face*17,27],[-p.face*(29+Math.sin(g.time*10)*4),20]],color,5);
    ctx.globalAlpha=alpha;image(g.equipped,0,10,39);ctx.globalAlpha=alpha;
    circle(p.face*(swing?36:18),swing?20:32,4,color);
    ctx.restore();ctx.globalAlpha=1;
    if(p.dashCooldown<=0){rect(x-8,y+75,16,2,C.lime);}
  }
  function foe(e,g){
    const color=e.slow>0?C.cyan:WEAPONS[e.face]?.color||C.red;
    const x=e.x+e.w/2,y=e.y;
    if(e.boss){
      if(e.phase>2&&e.phase<2.6&&g.bossActive){rect(e.direction>0?x:x-260,469,260,5,C.red);text('LƯỚT!',x,y-26,13,C.red,'center');}
      line([[x,y+49],[x,y+78]],e.flash>0?C.white:color,9);
      line([[x,y+70],[x-30,y+83],[x-37,y+97]],color,7);line([[x,y+70],[x+29,y+83],[x+37,y+97]],color,7);
      const reach=e.phase>2.6?55:43;
      line([[x,y+54],[x-reach,y+45],[x-reach-8,y+62]],color,7);line([[x,y+54],[x+reach,y+45],[x+reach+8,y+62]],color,7);
      image(e.face,x,y+29+Math.sin(g.time*3)*3,80);text(g.bossActive?'':STAGES[g.level].boss,x,y-30,15,color,'center');
    }else{
      const bounce=Math.sin(g.time*10+e.origin)*2;
      line([[x-9,y+37],[x-15,y+47]],color,4);line([[x+9,y+37],[x+15,y+47]],color,4);
      image(e.face,x,y+20+bounce,49);
      if(e.hp<e.maxHp){rect(x-19,y-10,38,4,C.platform);rect(x-19,y-10,38*e.hp/e.maxHp,4,color);}
    }
    if(e.flash>0){ctx.globalAlpha=e.flash*2;circle(x,y+e.h/2,e.w*.65,C.white);ctx.globalAlpha=1;}
    if(e.slow>0){line([[x-20,y+e.h-5],[x+20,y+e.h-5]],C.cyan,3);}
  }
  function fx(f){
    const age=1-f.life/f.maxLife;ctx.globalAlpha=1-age;
    if(f.kind==='text')text(f.text,f.x,f.y,17,f.color);
    if(f.kind==='slash'){
      ctx.strokeStyle=f.color;ctx.lineWidth=8*(1-age)+2;ctx.beginPath();ctx.ellipse(f.x,f.y,48+age*15,48,0,f.direction>0?-1.25:1.9,f.direction>0?1.25:4.4);ctx.stroke();
      line([[f.x-f.direction*12,f.y+12],[f.x+f.direction*40,f.y-15]],C.white,2);
    }
    if(f.kind==='burst')for(let i=0;i<11;i++){const a=i*2.399,r=age*62;rect(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,3+3*(1-age),3,f.color);}
    if(f.kind==='ring'||f.kind==='buzz'){
      const radius=f.kind==='buzz'?235:28;ctx.strokeStyle=f.color;ctx.lineWidth=f.kind==='buzz'?10*(1-age):3;ctx.beginPath();ctx.arc(f.x,f.y,Math.max(1,age*radius),0,Math.PI*2);ctx.stroke();
      if(f.kind==='buzz')text('BUZZ!',f.x,f.y-45-age*40,42,f.color,'center');
    }
    ctx.globalAlpha=1;
  }
  function draw(g,dt=1/60){
    const target=clamp(g.player.x-width*(width<650?.2:.36),0,Math.max(0,g.width-width));camera+=(target-camera)*Math.min(1,dt*7);shake=Math.max(0,shake-dt*30);
    ctx.setTransform(canvas.width/width,0,0,canvas.height/HEIGHT,0,0);ctx.clearRect(0,0,width,HEIGHT);ctx.save();
    if(shake>0&&!reduced)ctx.translate(Math.sin(performance.now()*.12)*shake,Math.cos(performance.now()*.15)*shake*.5);
    background(g);ctx.save();ctx.translate(-camera,0);
    // Trackside lamps and chat-room signs live in world space.
    for(let i=0;i<9;i++){
      const x=140+i*500;rect(x,288,5,192,C.platform);line([[x,290],[x+20,277],[x+52,277]],C.edge,4);rect(x+29,277,29,5,STAGES[g.level].color);
      if(i%2===0){rect(x-19,338,106,37,C.dark);text(['bạn_cũ_2005',':)) QUẨY THÔI','Y! THỨC KHUYA'][i%3],x-9,361,11,C.muted);}
    }
    for(const p of g.platforms){
      if(p.x+p.w<camera-20||p.x>camera+width+20)continue;
      rect(p.x,p.y,p.w,p.h,C.dark);rect(p.x,p.y,p.w,6,STAGES[g.level].color);rect(p.x,p.y+6,p.w,13,C.platform);
      for(let x=p.x+16;x<p.x+p.w;x+=38)rect(x,p.y+8,12,3,C.edge);
      if(p.y===480){for(let x=p.x+4;x<p.x+p.w;x+=72){rect(x,510,55,1,C.platform);rect(x+34,496,1,14,C.platform);}}
      else{line([[p.x+10,p.y+20],[p.x+25,p.y+36],[p.x+40,p.y+20]],C.platform,3);}
    }
    const floors=g.platforms.filter(p=>p.y===480);
    for(let i=0;i<floors.length-1;i++){const x=floors[i].x+floors[i].w,gap=floors[i+1].x-x;
      for(let offset=8;offset<gap-8;offset+=22)line([[x+offset,537],[x+offset+16,515]],C.red,2);
      text('VỰC',x+gap/2,505,12,C.red,'center');circle(x-20,456,12,C.red);text('!',x-20,461,16,C.ink,'center');
      if(g.level===0&&g.player.x<x&&g.player.x>x-350){ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.setLineDash([4,7]);ctx.beginPath();ctx.moveTo(x-55,463);ctx.quadraticCurveTo(x+gap/2,280,x+gap+45,463);ctx.stroke();ctx.setLineDash([]);text('NHẢY ĐÔI',x-35,421,11,C.gold,'right');}
    }
    for(const coin of g.coins)if(!coin.taken&&coin.x>camera-30&&coin.x<camera+width+30){circle(coin.x,coin.y+Math.sin(g.time*3+coin.x)*4,15,C.dark);image('wink',coin.x,coin.y+Math.sin(g.time*3+coin.x)*4,25);}
    const flag=g.checkpointTarget;rect(flag,364,4,116,C.edge);rect(flag+4,365,56,33,g.checkpointActive?C.lime:C.purple);text('Y!',flag+18,388,19,C.ink);text('ĐIỂM HỒI SINH',flag-23,348,10,g.checkpointActive?C.lime:C.muted);
    if(g.bossActive){rect(3444,335,5,145,C.red);for(let i=0;i<7;i++)rect(3434+(i%2)*10,340+i*20,20,3,C.red);}
    text('LÃNH ĐỊA BOSS',3740,287,16,STAGES[g.level].color);
    text(STAGES[g.level].boss,3740,314,27,C.white);
    if(g.player.x<450){text('CHẠY →',125,437,12,C.white);text('NHẢY ĐÔI ↑↑',320,351,11,C.lime);text(g.touchControls?'TỰ ĐÁNH':'J / ĐÁNH',555,427,12,C.purple);}
    for(const e of g.enemies)if(e.hp>0&&e.x+130>camera&&e.x-130<camera+width)foe(e,g);
    for(const b of g.projectiles){const color=WEAPONS[b.face]?.color||C.red;line([[b.x+10-b.vx*.035,b.y+10],[b.x+10,b.y+10]],color,5);image(b.face,b.x+b.w/2,b.y+b.h/2,b.friendly?28:31);}
    if(g.player.energy>=100){ctx.globalAlpha=.25;ctx.strokeStyle=C.lime;ctx.lineWidth=1.5;ctx.setLineDash([7,9]);ctx.beginPath();ctx.arc(g.player.x+15,g.player.y+33,235,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
    stick(g.player,g);for(const f of g.effects)fx(f);ctx.restore();
    if(g.combo>1&&g.comboTime>0){text(`${g.combo} ĐÒN`,width-25,126,32,C.lime,'right');text('LIÊN HOÀN',width-25,145,10,C.muted,'right');}
    ctx.restore();
  }
  return {draw,shake(amount){shake=Math.max(shake,amount);},reset(){camera=0;}};
}
