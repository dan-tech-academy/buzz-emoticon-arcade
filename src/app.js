import {createGame,step,equip,respawn,WEAPONS,STAGES} from './engine.js';
import {mergeProgress} from './progress.js';
import {createRenderer} from './renderer.js';
const $=id=>document.getElementById(id),canvas=$('game'),modal=$('modal');
const keys=new Set(),pressed=new Set(),touches=new Map();
let game,mode='welcome',audio,sound=true,wasPlaying=false,noticeTimer,frameTime=0,accumulator=0,hudTimer=0,autoAttack=false;
// Match the visible touch layout, not merely touchscreen hardware capability.
let previousTouchLayout;
const isTouch=()=>Boolean(previousTouchLayout);
function syncInputLayout(){
  document.body.classList.toggle('has-touch',navigator.maxTouchPoints>0);
  const touch=getComputedStyle(document.querySelector('.touch-controls')).display!=='none';
  document.body.classList.toggle('touch-device',touch);
  if(previousTouchLayout!==undefined&&previousTouchLayout!==touch){clearInput();setAutoAttack(false);}
  previousTouchLayout=touch;
  document.querySelectorAll('[data-control-copy]').forEach(node=>{node.innerHTML=controlLabel(node.dataset.controlCopy);});
  canvas.setAttribute('aria-label',touch?'Người que đi cảnh. Tay trái giữ nút chạy; tay phải nhảy, lướt hoặc BUZZ. Chạm Tự đánh để bật đánh liên tục. Hạ boss để thu phục emoji.':'Người que đi cảnh. A D chạy, Space nhảy đôi, giữ J hoặc X để đánh, K lướt, E BUZZ. Bấm Tấn công để bật hoặc tắt tự đánh. Hạ boss để thu phục emoji.');
}
syncInputLayout();window.addEventListener('resize',syncInputLayout);matchMedia('(pointer:coarse)').addEventListener('change',syncInputLayout);
const imageIds=['smile','wink','love','laugh','cry','devil','cool','angel','party','clap'];
const images=Object.fromEntries(imageIds.map(id=>{const img=new Image();img.src=`/emotes/${id}.png`;return[id,img];}));
const renderer=createRenderer(canvas,images);
const validOwned=value=>Array.isArray(value)?value.filter(id=>Object.hasOwn(WEAPONS,id)):[];
function readSave(){try{const data=JSON.parse(localStorage.getItem('buzz-action-v1'))||{},record=Number(localStorage.getItem('buzz-action-best'));return {owned:validOwned(data.owned),equipped:Object.hasOwn(WEAPONS,data.equipped)?data.equipped:'smile',level:Number.isInteger(data.level)&&data.level>=0&&data.level<3?data.level:0,best:Math.max(0,Number.isFinite(data.best)?data.best:0,Number.isFinite(record)?record:0)};}catch{return {owned:['smile'],equipped:'smile',level:0,best:0};}}
let saved=readSave();
try{sound=localStorage.getItem('buzz-action-sound')!=='false';}catch{}
game=createGame(saved.level,saved);
function saveProgress(intent='keep'){
  // Merge permanent unlocks with other tabs; audio preferences use a separate key.
  saved=mergeProgress(readSave(),game,intent);
  try{localStorage.setItem('buzz-action-v1',JSON.stringify(saved));}catch{}
}
function saveRecord(){
  // Exiting an older tab may update the record, never stage or equipment.
  const best=Math.max(readSave().best,game.score);saved.best=best;
  try{localStorage.setItem('buzz-action-best',String(best));}catch{}
}
function activateAudio(){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function tone(hz,duration=.08,type='sine',volume=.06){if(!sound||!audio)return;try{const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(hz,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(30,hz*.5),audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch{}}
function notify(text){$('announcement').textContent=text;$('announcement').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('announcement').classList.remove('show'),2200);}
function setAutoAttack(enabled){
  autoAttack=enabled;
  document.querySelectorAll('[data-auto-attack]').forEach(button=>{button.classList.toggle('held',enabled);button.setAttribute('aria-pressed',String(enabled));});
  $('attack-label').textContent=enabled?'TỰ ĐÁNH: BẬT':'TẤN CÔNG';
  $('attack-hint').textContent=enabled?'Bấm lần nữa để tắt':'Giữ J / X · hoặc bấm để tự đánh';
  $('attack-button').setAttribute('aria-label',enabled?'Tự đánh: bật. Bấm để tắt.':'Tấn công. Bấm để bật tự đánh, hoặc giữ J hay X.');
}
function toggleAutoAttack(){setAutoAttack(!autoAttack);notify(autoAttack?'Tự đánh đang bật. Rảnh tay để nhảy!':'Đã tắt tự đánh.');}
function clearInput(){keys.clear();pressed.clear();touches.clear();document.querySelectorAll('[data-action]').forEach(b=>b.classList.remove('held'));setAutoAttack(autoAttack);}
function showModal(html,kind){clearInput();mode=kind;$('modal-content').innerHTML=html;const title=$('modal-content').querySelector('h2');if(title)title.id='modal-title';if(kind==='paused'||kind==='dead')addModalEquipment();if(!modal.open)modal.showModal();if(title&&(kind==='dead'||kind==='reward')){title.tabIndex=-1;title.focus({preventScroll:true});}}
function addModalEquipment(){
  if(game.owned.length<2)return;
  const box=document.createElement('div');box.className='modal-equipment';
  box.innerHTML='<small>ĐỔI CHIÊU TRƯỚC KHI CHƠI TIẾP</small><div>'+game.owned.map(id=>`<button data-modal-equip="${id}" aria-pressed="${id===game.equipped}"><img src="/emotes/${id}.png" alt=""/>${WEAPONS[id].name}</button>`).join('')+'</div>';
  $('modal-content').querySelector('.modal-actions').before(box);
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{equip(game,b.dataset.modalEquip);saveProgress();renderWeapons();updateHUD();box.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.modalEquip===game.equipped)));});
}
function controls(){return isTouch()?{run:'Giữ ◀ / ▶ bằng tay trái.',jump:'Tay phải chạm NHẢY.',attack:'Chạm TỰ ĐÁNH để bật / tắt đánh liên tục.',dash:'Chạm LƯỚT để né đạn.',buzz:'Chạm BUZZ! để tung sóng.',equip:'Chạm Kho emoji hoặc ô emoji',retry:'Tay trái giữ ◀ / ▶, tay phải chạm NHẢY. Bật TỰ ĐÁNH để rảnh tay né đòn.',intro:'Tay trái di chuyển · Tay phải NHẢY / LƯỚT.<br/>Chạm TỰ ĐÁNH một lần để bật đánh liên tục.'}:{run:'A D / ← → để chạy.',jump:'Space / W / ↑ để nhảy.',attack:'Giữ J / X để đánh, hoặc bấm TẤN CÔNG để bật / tắt tự đánh.',dash:'K / Shift lướt, né đạn.',buzz:'E / L tung sóng đẩy lùi.',equip:'Bấm Kho emoji hoặc phím 1–4',retry:'Thử nhảy đôi qua vực, giữ J để đánh và dùng K để né đòn.',intro:'A D chạy · Space nhảy · J đánh · K lướt · E BUZZ!<br/>Hoặc bấm TẤN CÔNG phía trên sân chơi.'};}
function controlLabel(key){return key==='pause'?(isTouch()?'Chạm TỰ ĐÁNH để bật hoặc tắt đánh liên tục.':'Giữ J / X hoặc bấm TẤN CÔNG để đánh liên tục.'):controls()[key];}
function controlCopy(key){return `<span data-control-copy="${key}">${controlLabel(key)}</span>`;}
function closeModal(){modal.close();mode='playing';clearInput();canvas.focus({preventScroll:true});}
function start(level=game.level){game=createGame(level,{...readSave(),score:0,collected:0,equipped:game.equipped});setAutoAttack(false);renderer.reset();closeModal();saveProgress('restart');renderWeapons();updateHUD();activateAudio();notify(STAGES[level].subtitle);}
function nextStage(equipReward=true){
  if(equipReward)equip(game,STAGES[game.level].reward);saveProgress('advance');
  if(game.level===2){start(0);return;}
  game=createGame(game.level+1,game);renderer.reset();closeModal();saveProgress();renderWeapons();updateHUD();notify(STAGES[game.level].subtitle);
}
function welcome(){
  showModal(`<span class="modal-eyebrow">NGƯỜI QUE × EMOJI YAHOO</span><h2>Hết chat.<br/><em>Tới giờ chiến.</em></h2><div class="modal-art"><img src="/emotes/smile.png" alt="Mặt cười"/><span>⚔</span><img src="/emotes/devil.png" alt="Boss tiểu quỷ"/><span>→</span><img src="/emotes/cool.png" alt="Sức mạnh băng"/></div><p>Chạy, nhảy đôi, lướt qua đạn. Hạ boss để <b>thu phục emoji</b>, rồi mang chính sức mạnh ấy sang trận tiếp theo.</p><div class="modal-actions"><button class="primary" id="start-button">${saved.level?'Chơi màn '+(saved.level+1):'Vào trận'} →</button><button id="intro-help">Cách chơi</button></div><p class="modal-note">3 màn · 3 boss · 4 chiêu emoji<br/>${controlCopy('intro')}</p>`,'welcome');
  $('start-button').onclick=()=>start(saved.level);$('intro-help').onclick=()=>help('welcome');
}
function pause(){if(mode!=='playing'||game.status!=='playing')return;wasPlaying=true;showModal(`<span class="modal-eyebrow">NGHỈ TAY MỘT CHÚT</span><h2>Chưa offline đâu.</h2><p>Nhảy lên đầu quái hoặc lướt xuyên địch để gây sát thương. ${controlCopy('pause')}</p><div class="modal-actions"><button class="primary" id="resume-button" autofocus>Chiến tiếp →</button><button id="restart-button">Chơi lại màn</button></div>`,'paused');$('resume-button').onclick=closeModal;$('restart-button').onclick=()=>start(game.level);}
function help(returnMode=mode){
  wasPlaying=returnMode==='playing'||returnMode==='paused';
  showModal(`<span class="modal-eyebrow">BÍ KÍP PHÁ ĐẢO</span><h2>Đừng đứng yên.</h2><div class="help-grid"><div><b>Chạy & nhảy đôi</b>${controlCopy('run')}<br/>${controlCopy('jump')}<br/>Bấm lần nữa giữa không trung.</div><div><b>Đánh & lướt</b>${controlCopy('attack')}<br/>${controlCopy('dash')}<br/>Đạp đầu quái cũng gây sát thương.</div><div><b>BUZZ! diện rộng</b>${controlCopy('buzz')}<br/>Vòng sáng là tầm đánh. Không trúng địch thì không mất năng lượng.</div><div><b>Thu phục & trang bị</b>Hạ boss nhận emoji mới.<br/>${controlCopy('equip')} để đổi sức mạnh đã mở, kể cả lúc tạm dừng hoặc hồi sinh.</div></div><p>Qua cờ hồi sinh để hồi đầy tim. Rơi xuống vực mất một tim và trở lại bờ gần nhất; hết tim có thể hồi sinh tại cờ.</p><div class="modal-actions"><button class="primary" id="help-close">${wasPlaying?'Chiến tiếp':'Đã hiểu'} →</button></div>`,'help');
  $('help-close').onclick=()=>wasPlaying?closeModal():welcome();
}
function collection(){
  if(mode!=='playing'&&mode!=='welcome'&&mode!=='paused')return;
  wasPlaying=mode!=='welcome';const allOwned=[...new Set([...game.owned,...readSave().owned])];game.owned=allOwned;
  const items=Object.entries(WEAPONS).map(([id,w])=>{const owned=allOwned.includes(id);return `<div class="collection-item ${owned?'':'locked'}"><img src="/emotes/${id}.png" alt="${w.title}"/><b>${w.name} ${w.code.replaceAll('<','&lt;')}</b><p>${w.description}</p>${owned?`<button data-equip="${id}" ${id===game.equipped?'disabled':''}>${id===game.equipped?'Đang trang bị':'Trang bị'}</button>`:'<p>CHƯA THU PHỤC</p>'}</div>`;}).join('');
  showModal(`<span class="modal-eyebrow">SỨC MẠNH TỪ NHỮNG GƯƠNG MẶT QUEN</span><h2>Kho emoji <em>${allOwned.length}/4</em></h2><div class="collection-list">${items}</div><div class="modal-actions"><button class="primary" id="collection-close">${wasPlaying?'Chiến tiếp':'Quay lại'} →</button></div>`,'collection');
  document.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{equip(game,b.dataset.equip);saveProgress();renderWeapons();updateHUD();collectionRefresh();});
  function collectionRefresh(){const returnToPlay=wasPlaying;mode=returnToPlay?'playing':'welcome';collection();}
  $('collection-close').onclick=()=>wasPlaying?closeModal():welcome();
}
function result(){
  saveProgress(game.status==='cleared'?'advance':'keep');renderWeapons();updateHUD();
  if(game.status==='dead'){
    showModal(`<span class="modal-eyebrow">NGÃ Ở ĐÂU, ĐỨNG DẬY Ở ĐÓ</span><h2>Chưa hết <em>chiến.</em></h2><p>${game.checkpointActive?'Cờ hồi sinh đã giữ vị trí của bạn.':controlCopy('retry')}<br/>Điểm: <b>${game.score.toLocaleString('vi')}</b> · Đã hạ ${game.kills} quái.</p><div class="modal-actions"><button class="primary" id="retry-button">Hồi sinh ${game.checkpointActive?'tại cờ':'đầu màn'} →</button><button id="retry-stage">Chơi lại màn</button></div>`,'dead');
    $('retry-button').onclick=()=>{respawn(game);closeModal();updateHUD();};$('retry-stage').onclick=()=>start(game.level);return;
  }
  const id=STAGES[game.level].reward,w=WEAPONS[id],final=game.level===2;
  showModal(`<span class="modal-eyebrow">${final?'PHÁ ĐẢO! THU PHỤC ĐỦ 3 BOSS':'BOSS ĐÃ GỤC · EMOJI THUỘC VỀ BẠN'}</span><div class="modal-art"><img src="/emotes/${id}.png" alt="${w.title}"/><span>+</span><img src="/emotes/smile.png" alt="Người que"/></div><h2>Nhận chiêu<br/><em>${w.name}.</em></h2><p>${w.description.split('. Hạ')[0]}. ${final?'Mang toàn bộ sức mạnh trở lại màn 1 để quẩy tiếp.':'Trang bị ngay rồi mang emoji này sang màn tiếp theo.'}<br/>Tổng điểm: <b>${game.score.toLocaleString('vi')}</b></p><div class="modal-actions"><button class="primary" id="equip-next">${final?'Mang Hào quang chơi lại':'Trang bị & qua màn'} →</button>${final?'':'<button id="keep-next">Giữ chiêu hiện tại</button>'}</div>`,'reward');
  $('equip-next').onclick=()=>nextStage(true);if($('keep-next'))$('keep-next').onclick=()=>nextStage(false);
}
function renderWeapons(){
  $('weapon-rack').innerHTML=Object.entries(WEAPONS).map(([id,w],i)=>`<button class="weapon-slot ${game.owned.includes(id)?'':'locked'} ${game.equipped===id?'selected':''}" data-weapon="${id}" aria-label="${w.name}${game.owned.includes(id)?'':' chưa thu phục'}" aria-pressed="${game.equipped===id}"><img src="/emotes/${id}.png" alt=""/><span>${w.name}<small>${game.owned.includes(id)?`${i+1} · ${game.equipped===id?'Đang dùng':'Trang bị'}`:'Hạ boss để mở'}</small></span></button>`).join('');
  document.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>{if(mode!=='playing')return;if(equip(game,b.dataset.weapon)){saveProgress();renderWeapons();updateHUD();notify(`Đã trang bị: ${WEAPONS[game.equipped].name}`);canvas.focus({preventScroll:true});}else notify(WEAPONS[b.dataset.weapon].description);});
}
function updateHUD(){
  const p=game.player;$('hearts').innerHTML=`${'♥ '.repeat(p.hp)}<span class="empty-heart">${'♡ '.repeat(5-p.hp)}</span>`;$('hearts').setAttribute('aria-label',`${p.hp} trên 5 tim`);
  $('energy-bar').style.width=`${p.energy}%`;$('energy-label').textContent=p.energy>=100?'Sẵn sàng':`${Math.floor(p.energy)}%`;
  $('score').textContent=String(game.score).padStart(6,'0');$('coin-count').textContent=game.collected;$('best').textContent=Math.max(saved.best||0,game.score).toLocaleString('vi');
  $('progress').style.width=`${Math.min(100,game.player.x/3930*100)}%`;$('stage-number').textContent=`MÀN 0${game.level+1} / 03`;$('stage-name').textContent=STAGES[game.level].name;
  $('weapon-name').textContent=WEAPONS[game.equipped].name;$('weapon-description').textContent=game.equipped==='smile'?(isTouch()?'Chạm emoji để đổi chiêu':'Chém nhanh · 1–4 đổi chiêu'):game.equipped==='devil'?'Bắn cầu lửa tầm xa':game.equipped==='cool'?'Bắn băng · làm chậm địch':'Chém rộng · hạ quái hồi tim';$('owned-count').textContent=`${game.owned.length}/4`;
  $('sound-button').textContent=`Âm thanh: ${sound?'bật':'tắt'}`;$('sound-button').setAttribute('aria-label',sound?'Tắt âm thanh':'Bật âm thanh');$('sound-button').title=sound?'Tắt âm thanh':'Bật âm thanh';
  const boss=game.enemies.find(e=>e.boss);$('boss-hud').hidden=!game.bossActive||boss.hp<=0;$('boss-name').textContent=STAGES[game.level].boss;$('boss-bar').style.width=`${boss.hp/boss.maxHp*100}%`;$('boss-phase').textContent=boss.hp<=0?'ĐÃ HẠ':boss.hp<boss.maxHp/2?'NỔI GIẬN!':'TRẬN BOSS';
  $('stage-objective').textContent=`Hạ ${STAGES[game.level].boss} → nhận ${WEAPONS[STAGES[game.level].reward].name}`;
  setAutoAttack(autoAttack);
}
function events(){for(const event of game.events){
  if(event.type==='jump')tone(380,.1,'sine',.04);
  if(event.type==='attack')tone(game.equipped==='cool'?780:180,.08,'triangle',.035);
  if(event.type==='hit'){renderer.shake(event.boss?4:2);tone(85,.07,'square',.045);}
  if(event.type==='coin')tone(1050,.04,'sine',.02);
  if(event.type==='dash')tone(240,.12,'sawtooth',.025);
  if(event.type==='buzz'){renderer.shake(14);tone(75,.45,'sawtooth',.09);}
  if(event.type==='hurt'){renderer.shake(9);tone(110,.2,'square',.05);}
  if(event.type==='checkpoint'){notify('ĐIỂM HỒI SINH! Đã hồi đầy tim.');saveProgress();}
  if(event.type==='buzzMiss')notify('Chưa có địch trong vòng BUZZ! Áp sát thêm.');
  if(event.type==='fall')notify(event.arena?'Trở lại sàn đấu · mất 1 tim':'Trượt chân! Thử nhảy đôi · mất 1 tim');
  if(event.type==='boss'){notify(`${STAGES[game.level].boss.toUpperCase()} XUẤT HIỆN!`);tone(65,.7,'sawtooth',.04);}
  if(event.type==='reward'){renderer.shake(12);tone(720,.5,'triangle',.06);}
}if(game.status!=='playing'&&mode==='playing')result();}
const bindings={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',KeyW:'jump',ArrowUp:'jump',KeyJ:'attack',KeyX:'attack',KeyK:'dash',ShiftLeft:'dash',ShiftRight:'dash',KeyE:'buzz',KeyL:'buzz'};
document.addEventListener('keydown',event=>{
  if(event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(modal.open){if(event.repeat&&(event.code==='Space'||event.code==='Enter'))event.preventDefault();return;}
  if(event.key==='Escape'||event.code==='KeyP'){event.preventDefault();pause();return;}
  if(event.key==='?'){event.preventDefault();help();return;}
  if(mode!=='playing')return;
  if(/^[1-4]$/.test(event.key)){if(event.repeat)return;if(equip(game,Object.keys(WEAPONS)[Number(event.key)-1])){saveProgress();renderWeapons();updateHUD();}return;}
  // Preserve native activation for a focused button. Canvas focus owns game keys.
  if(event.target.closest?.('button,a')&&(event.code==='Space'||event.code==='Enter'))return;
  const action=bindings[event.code];if(!action)return;event.preventDefault();activateAudio();if(!keys.has(event.code))pressed.add(action);keys.add(event.code);
});
document.addEventListener('keyup',event=>keys.delete(event.code));
canvas.addEventListener('pointerdown',()=>{canvas.focus({preventScroll:true});activateAudio();});
$('attack-button').onclick=()=>{if(mode!=='playing')return;activateAudio();toggleAutoAttack();canvas.focus({preventScroll:true});};
document.querySelectorAll('[data-action]').forEach(button=>{
  button.addEventListener('pointerdown',event=>{event.preventDefault();if(mode!=='playing')return;activateAudio();if(button.dataset.action==='attack'){toggleAutoAttack();return;}button.setPointerCapture(event.pointerId);touches.set(event.pointerId,button.dataset.action);pressed.add(button.dataset.action);button.classList.add('held');});
  const release=event=>{if(button.dataset.action==='attack')return;touches.delete(event.pointerId);if(![...touches.values()].includes(button.dataset.action))button.classList.remove('held');};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
});
window.addEventListener('blur',()=>{clearInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){saveRecord();clearInput();pause();}});
modal.addEventListener('cancel',event=>{event.preventDefault();if(mode==='welcome')return;if(mode==='dead'||mode==='reward')return;if(mode==='help'||mode==='collection'){if(wasPlaying)closeModal();else welcome();}else closeModal();});
$('pause-button').onclick=pause;$('help-button').onclick=()=>{if(mode==='playing'||mode==='welcome')help();};$('collection-button').onclick=collection;
$('sound-button').onclick=()=>{sound=!sound;try{localStorage.setItem('buzz-action-sound',String(sound));}catch{}activateAudio();tone(600);updateHUD();};
window.addEventListener('storage',event=>{if(event.key==='buzz-action-v1'||event.key==='buzz-action-best'){const newer=readSave();game.owned=[...new Set([...game.owned,...newer.owned])];if(game.owned.includes(newer.equipped))equip(game,newer.equipped);saved=newer;renderWeapons();updateHUD();}});
function tick(now){
  const dt=Math.min((now-frameTime)/1000||0, .05);frameTime=now;
  if(mode==='playing'){
    accumulator+=dt;
    while(accumulator>=1/60&&mode==='playing'){
      const held=new Set([...keys].map(code=>bindings[code]).concat([...touches.values()]));
      game.touchControls=isTouch();step(game,{left:held.has('left'),right:held.has('right'),attack:held.has('attack')||autoAttack,jump:pressed.has('jump'),dash:pressed.has('dash'),buzz:pressed.has('buzz')},1/60);pressed.clear();events();accumulator-=1/60;
    }
  }else accumulator=0;
  hudTimer+=dt;if(hudTimer>.08){updateHUD();hudTimer=0;}
  renderer.draw(game,dt);requestAnimationFrame(tick);
}
renderWeapons();updateHUD();welcome();requestAnimationFrame(tick);
