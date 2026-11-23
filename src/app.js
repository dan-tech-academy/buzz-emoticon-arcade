import { EMOTES, SIZE, LEVEL_NAMES, newGame, restoreGame, adjacent, findChain, createBoard, clearCells, buzzArea } from './engine.js';

const $ = id => document.getElementById(id);
const emote = id => EMOTES.find(e=>e.id===id);
const face = (id, alt='') => `<img src="/emotes/${id}.png" alt="${alt}" draggable="false"/>`;
const format = n => n.toLocaleString('vi-VN');
const initialChat=$('chat-log').innerHTML;
let saved;
try { saved=JSON.parse(localStorage.getItem('buzz-save-v1')) || {}; } catch { saved={}; }
let best=Number(saved.best)||0;
let unlocked=new Set(Array.isArray(saved.unlocked) ? saved.unlocked.filter(id=>EMOTES.some(e=>e.id===id)) : EMOTES.slice(0,5).map(e=>e.id));
EMOTES.slice(0,5).forEach(e=>unlocked.add(e.id));
let state=restoreGame(saved.round)||newGame(), chain=[], armed=false, dragging=false, dragMoved=false, dragStart=null, busy=false;
let sound=!!saved.sound, audio, toastTimer, hintTimer, modalKind='', resumeAfterModal=false;
let returnToResult=false, lastReject=0;
let focusIndex=0;
function save() {
  try { localStorage.setItem('buzz-save-v1',JSON.stringify({best,unlocked:[...unlocked],sound,round:['playing','paused'].includes(state.status)?state:null})); } catch { /* Private mode can make storage unavailable; the game still works. */ }
}
function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent=message; $('toast').classList.add('show');
  toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2800);
}
function tone(freq=500,duration=.09,type='sine') {
  if(!sound) return;
  try {
    audio ??= new (window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended') audio.resume();
    const oscillator=audio.createOscillator(), gain=audio.createGain();
    oscillator.type=type; oscillator.frequency.value=freq;
    gain.gain.setValueAtTime(.045,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
    oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+duration);
  } catch { /* Audio is optional. */ }
}
function soundUI() {
  $('sound-button').innerHTML=sound?'♫':'♫<span class="sound-off">/</span>';
  $('sound-button').setAttribute('aria-label',sound?'Tắt âm thanh':'Bật âm thanh');
  $('sound-button').title=sound?'Tắt âm thanh':'Bật âm thanh';
}
function clearHint() {clearTimeout(hintTimer);document.querySelectorAll('.hinted').forEach(t=>t.classList.remove('hinted'));}
function renderBoard() {
  const hadFocus=$('board').contains(document.activeElement);
  $('board').innerHTML=state.board.map((id,i)=>`<button class="tile" data-index="${i}" style="background:${emote(id).color}" aria-label="${emote(id).name}, hàng ${Math.floor(i/SIZE)+1}, cột ${i%SIZE+1}" aria-pressed="false" tabindex="${i===focusIndex?0:-1}">${face(id)}</button>`).join('');
  if(hadFocus)focusTile(focusIndex);
}
function renderStats() {
  $('goals').innerHTML=Object.entries(state.goals).map(([id,goal])=> {
    const collected=Math.min(state.collected[id],goal),done=collected>=goal;
    return `<div class="goal ${done?'done':''}"><div class="goal-face" style="background:${emote(id).color}">${face(id)}</div><div class="goal-info"><div><span class="goal-name">${emote(id).name}</span><b><strong>${collected}</strong> / ${goal}${done?' ✓':''}</b></div><div class="goal-track" role="progressbar" aria-label="Thu thập ${emote(id).name}" aria-valuenow="${collected}" aria-valuemin="0" aria-valuemax="${goal}"><i style="width:${collected/goal*100}%"></i></div></div></div>`;
  }).join('');
  $('moves').textContent=state.moves; $('moves').classList.toggle('low',state.moves<=5);
  $('score').textContent=format(state.score); $('best').textContent=format(best);
  $('room-number').textContent=String(state.level).padStart(2,'0');
  $('room-title').textContent=LEVEL_NAMES[(state.level-1)%LEVEL_NAMES.length];
  $('board-status').textContent=state.status==='ready'?'Sẵn sàng kết nối':state.status==='paused'?'Đang tạm nghỉ':state.status==='won'?'Đã gửi đủ cảm xúc!':state.status==='lost'?'Hẹn bạn một ván mới':'Bạn đang online';
  $('start-overlay').classList.toggle('hidden',state.status!=='ready');
  const finished=['won','lost'].includes(state.status);
  $('end-overlay').classList.toggle('hidden',!finished);
  $('end-title').textContent=state.status==='won'?'Đã gửi đủ cảm xúc!':'Hết lượt, chưa hết vui.';
  $('buzz-count').textContent=armed?'Bấm lại để hủy':`${state.buzzes} lần sẵn sàng`;
  $('buzz-button').classList.toggle('armed',armed);
  $('buzz-button').setAttribute('aria-pressed',String(armed));
  $('charge-bar').style.width=`${state.charge/18*100}%`; $('charge-count').textContent=`${state.charge}/18`;
  $('collection-count').textContent=`${unlocked.size}/${EMOTES.length}`;
  for(const id of ['hint-button','shuffle-button','buzz-button']) $(id).disabled=state.status!=='playing'||busy||(id==='buzz-button'&&!state.buzzes);
  renderSelection();
}
function renderSelection() {
  document.querySelectorAll('.tile').forEach((tile,i)=> {
    const selected=chain.includes(i);tile.classList.toggle('selected',selected);tile.classList.toggle('buzz-target',armed);
    tile.setAttribute('aria-pressed',String(selected));tile.dataset.order=selected?chain.indexOf(i)+1:'';
  });
  $('send-button').disabled=chain.length<3||state.status!=='playing'||busy;
  $('selection-label').textContent=armed?'Chọn 1 ô để BUZZ! vùng 3×3':chain.length?`${chain.length} cảm xúc · ${chain.length<3?'Nối thêm nhé!':'Sẵn sàng gửi!'}`:'Nối 3+ cảm xúc giống nhau';
  drawChain();
}
function drawChain() {
  if(chain.length<2){$('chain-line').innerHTML='';return;}
  const bounds=$('board').getBoundingClientRect();
  const points=chain.map(i=>{const t=$('board').children[i].getBoundingClientRect();return `${t.x-bounds.x+t.width/2},${t.y-bounds.y+t.height/2}`;});
  $('chain-line').setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
  const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  line.setAttribute('points',points.join(' '));
  $('chain-line').replaceChildren(line);
}
function render() {renderBoard();renderStats();}
function addChat(message, own=false, id) {
  const div=document.createElement('div');div.className=`chat-message${own?' own':''}`;
  const name=document.createElement('span');name.className='chat-name';name.textContent=`${own?'tớ_của_hôm_nay':'bạn_cũ_2005'} · ${new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}`;
  const p=document.createElement('p');p.textContent=message+' ';
  if(id) {const img=document.createElement('img');img.src=`/emotes/${id}.png`;img.alt=emote(id).name;p.append(img);}
  div.append(name,p);$('chat-log').append(div);
  while($('chat-log').children.length>16) $('chat-log').firstElementChild.remove();
  $('chat-log').scrollTop=$('chat-log').scrollHeight;
}
function start(level=1) {
  state=newGame(level);state.status='playing';chain=[];armed=false;busy=false;focusIndex=0;
  $('chat-log').innerHTML=initialChat;save();
  render();focusTile(0);tone(620,.15);addChat(level===1?'Online rồi! Gửi tớ chút niềm vui nào.':`Phòng ${level} mở rồi. Tiếp tục nha!`,false,'wave');
}
function focusTile(index,focus=true) {
  focusIndex=index;
  Array.from($('board').children).forEach((tile,i)=>tile.tabIndex=i===index?0:-1);
  if(focus)$('board').children[index].focus({preventScroll:true});
}
function reject(index,message) {
  const tile=$('board').children[index];tile?.classList.add('invalid');
  setTimeout(()=>tile?.classList.remove('invalid'),350);
  if(Date.now()-lastReject>1500){lastReject=Date.now();toast(message);tone(170,.08);}
}
function select(index) {
  if(state.status!=='playing'||busy) return;
  clearHint();focusTile(index,false);
  if(armed){submit(buzzArea(index),true);return;}
  if(!chain.length){chain=[index];tone(420);}
  else if(index===chain.at(-2)){chain.pop();tone(420+chain.length*40);}
  else if(index===chain.at(-1)) return;
  else if(chain.includes(index)) return;
  else if(state.board[index]===state.board[chain[0]]&&adjacent(chain.at(-1),index)){chain.push(index);tone(420+chain.length*40);}
  else if(!dragging){chain=[index];reject(index,'Chuỗi mới: nối ít nhất 3 mặt giống nhau nằm cạnh nhau.');}
  else reject(index,'Chỉ nối các mặt giống nhau nằm cạnh nhau, kể cả chéo.');
  renderSelection();
}
async function submit(cells=chain,isBuzz=false) {
  if(busy||state.status!=='playing'||(!isBuzz&&cells.length<3)) return;
  const previous=state, next=clearCells(state,[...cells],isBuzz);
  if(next===state)return;
  busy=true;armed=false;chain=[];clearHint();
  const shell=document.querySelector('.board-shell');shell.classList.remove('pop','buzzing');void shell.offsetWidth;shell.classList.add(isBuzz?'buzzing':'pop');
  if(isBuzz){const room=document.querySelector('main');room.classList.remove('room-buzz');void room.offsetWidth;room.classList.add('room-buzz');setTimeout(()=>room.classList.remove('room-buzz'),850);}
  tone(isBuzz?130:720,isBuzz?.35:.15,isBuzz?'sawtooth':'sine');
  state=next;const gained=state.score-previous.score;
  if(state.score>best)best=state.score;
  save();
  render();
  addChat(isBuzz?'BUZZ!!! Có ai ở đây không?':`Đã gửi ${cells.length} mặt ${emote(previous.board[cells[0]]).name.toLowerCase()}. +${format(gained)} điểm`,true,isBuzz?null:previous.board[cells[0]]);
  if(!isBuzz&&cells.length>=5){toast(`Nối được ${cells.length} mặt! Cả hội cười theo ✦`);addChat('Đỉnh vậy! Đúng là cao thủ Yahoo năm ấy.',false,'cool');}
  else if(isBuzz)toast('BUZZ! Cả phòng đã nghe thấy bạn!');
  else if(state.buzzes>previous.buzzes)toast('Đầy năng lượng! Bạn có thêm một lượt BUZZ!');
  if(state.moves===5&&state.status==='playing')addChat('Còn 5 lượt! Nhắm vào cảm xúc trong nhiệm vụ nha.',false,'wink');
  await new Promise(resolve=>setTimeout(resolve,220));
  busy=false;renderStats();
  if(state.status==='won'||state.status==='lost') showResult();
}
function shuffle() {
  if(state.status!=='playing'||busy) return;
  const wasArmed=armed;
  chain=[];armed=false;clearHint();state.board=createBoard(state.types);state.moves--;
  if(state.moves<=0)state.status='lost';save();render();tone(330,.16);toast(`Đã đảo bảng. −1 lượt.${wasArmed?' Đã hủy chọn BUZZ!, năng lượng vẫn còn.':''}`);
  if(state.status==='lost')showResult();
}
function openModal(kind,html) {
  clearHint();dragging=false;modalKind=kind;resumeAfterModal=resumeAfterModal||state.status==='playing';
  if(resumeAfterModal)state.status='paused';
  $('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();renderStats();
}
function closeModal(restoreResult=true) {
  const goBack=restoreResult&&modalKind==='collection'&&returnToResult&&['won','lost'].includes(state.status);
  $('modal').close();
  if(resumeAfterModal&&state.status==='paused')state.status='playing';
  resumeAfterModal=false;modalKind='';returnToResult=false;renderStats();
  if(goBack)showResult();
}
function showHelp() {
  openModal('help',`<span class="modal-eyebrow">BÍ KÍP CỦA DÂN 9X</span><h2 class="modal-title" id="modal-title">Chơi dễ như gửi một :))</h2><p class="modal-intro">Không chạy đua với đồng hồ. Cứ thong thả nối lại niềm vui.</p><ol class="help-steps"><li><b>Nối cảm xúc</b>Click từng ô hoặc kéo qua ít nhất 3 emoticon giống nhau, nằm cạnh nhau theo chiều ngang, dọc hoặc chéo. Đi ngược một ô để bỏ chọn ô cuối.</li><li><b>Gửi một chút niềm vui</b>Bấm “Gửi cảm xúc” để thu thập và ghi điểm. Mỗi lần gửi tốn 1 lượt. Hoàn thành cả 3 mục tiêu trước khi hết 20 lượt.</li><li><b>Rung phòng bằng BUZZ!</b>Mỗi ván có sẵn 1 BUZZ! Chọn BUZZ! rồi chọn 1 ô để thu toàn bộ vùng 3×3 xung quanh, tốn 1 lượt. Mỗi 18 emoticon thường thu được sẽ nạp thêm 1 BUZZ! (tối đa 3).</li><li><b>Chút trợ giúp khi cần</b>Gợi ý luôn miễn phí. Đảo bảng tốn 1 lượt. Chuỗi dài từ 4 ô có điểm thưởng; lượt còn dư khi thắng được +50 điểm/lượt. Qua mỗi phòng mở khóa thêm một gương mặt trong bộ sưu tập.</li></ol><div class="keyboard-help"><kbd>← ↑ ↓ →</kbd> Di chuyển · <kbd>Enter</kbd> Chọn ô · <kbd>Space</kbd> Gửi chuỗi<br/><kbd>Esc</kbd> Bỏ chọn / Hủy BUZZ! · <kbd>?</kbd> Cách chơi</div>`);
}
function showCollection() {
  openModal('collection',`<span class="modal-eyebrow">MỖI GƯƠNG MẶT, MỘT KÝ ỨC</span><h2 class="modal-title" id="modal-title">Bộ sưu tập cảm xúc</h2><p class="modal-intro">Đã mở ${unlocked.size}/${EMOTES.length} emoticon từ ảnh bạn gửi. Hoàn thành phòng chat để tìm lại những người bạn còn lại.</p><div class="collection-grid">${EMOTES.map(e=>`<div class="collection-tile ${unlocked.has(e.id)?'':'locked'}">${face(e.id,e.name)}<strong>${e.name}</strong><code>${unlocked.has(e.id)?e.code:'???'}</code><small>${unlocked.has(e.id)?'Đã tìm lại':'Thắng thêm phòng để mở'}</small></div>`).join('')}</div>`);
}
function pause() {
  if($('modal').open)return;
  if(state.status==='ready'){toast('Vào phòng chat để bắt đầu nhé!');return;}
  if(state.status==='won'||state.status==='lost'){showResult();return;}
  openModal('pause',`<div class="pause-content">${face('sleep')}<span class="modal-eyebrow">TRẠNG THÁI: TẠM VẮNG</span><h2 class="modal-title" id="modal-title">Nghỉ một chút nha.</h2><p class="modal-intro">Phòng chat vẫn ở đây. Cảm xúc không đi đâu cả.</p><button class="primary" id="resume-button">Quay lại online ↗</button><button class="secondary" id="restart-button">Chơi lại phòng này</button></div>`);
  $('resume-button').onclick=closeModal;
  $('restart-button').onclick=()=>{const level=state.level;closeModal();start(level);};
}
function confetti() {
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  for(let i=0;i<35;i++){const p=document.createElement('i');p.className='confetti';p.style.left=`${Math.random()*100}%`;p.style.background=['#b28cdb','#f0cb6c','#a9ccb4','#f0a1aa'][i%4];p.style.animationDelay=`${Math.random()*.6}s`;document.body.append(p);setTimeout(()=>p.remove(),3200);}
}
let resultLevel=0,resultUnlock='';
function showResult() {
  const won=state.status==='won';
  if(won&&resultLevel!==state.level){
    resultLevel=state.level;resultUnlock='';
    const next=EMOTES.find(e=>!unlocked.has(e.id));
    if(next){unlocked.add(next.id);resultUnlock=next.name;save();}
    confetti();addChat('Nhận đủ cảm xúc rồi! Bạn vẫn đáng yêu như ngày nào.',false,'love');
  }
  openModal('result',`<div class="result">${face(won?'party':'sad')}<span class="modal-eyebrow">${won?'KẾT NỐI THÀNH CÔNG':'ĐỪNG ĐẶT TRẠNG THÁI BUỒN'}</span><h2 class="modal-title" id="modal-title">${won?'Đã gửi đủ cảm xúc!':'Hết lượt, chưa hết vui.'}</h2><p class="modal-intro">${won?'Cả hội nhận đủ niềm vui rồi. Hẹn ở phòng tiếp theo nhé!':'Còn một chút cảm xúc chưa gửi. Thử lại, lần này mình sẽ làm được!'}</p><div class="result-score">${format(state.score)}<small>ĐIỂM CẢM XÚC · PHÒNG ${state.level}</small></div>${won&&resultUnlock?`<div class="unlock-note">✦ Vừa tìm lại: ${resultUnlock} — xem trong bộ sưu tập!</div>`:''}<div class="result-actions"><button class="primary" id="next-button">${won?'Phòng tiếp theo ↗':'Thử lại nhé ↗'}</button><button class="secondary" id="result-collection">Bộ sưu tập</button></div></div>`);
  $('next-button').onclick=()=>{const level=state.level+(won?1:0);closeModal();resultLevel=0;start(level);};
  $('result-collection').onclick=()=>{closeModal(false);returnToResult=true;showCollection();};
}

$('board').addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse'&&event.button!==0)return;
  const tile=event.target.closest('.tile');if(!tile||state.status!=='playing'||busy)return;
  // Suppress implicit touch capture so each crossed tile is discovered via coordinates.
  event.preventDefault();dragging=false;dragMoved=false;dragStart=Number(tile.dataset.index);select(dragStart);dragging=true;
});
document.addEventListener('pointermove',event=>{
  if(!dragging||state.status!=='playing'||busy)return;
  const tile=document.elementFromPoint(event.clientX,event.clientY)?.closest('.tile');
  if(tile){const index=Number(tile.dataset.index);if(index!==dragStart)dragMoved=true;if(dragMoved)select(index);}
});
document.addEventListener('pointerup',()=>{dragging=false;dragStart=null;});
document.addEventListener('pointercancel',()=>{dragging=false;dragStart=null;});
$('board').addEventListener('click',event=>{if(event.detail===0){const tile=event.target.closest('.tile');if(tile)select(Number(tile.dataset.index));}});
$('start-button').onclick=()=>start();$('send-button').onclick=()=>submit();$('shuffle-button').onclick=shuffle;
$('hint-button').onclick=()=>{if(state.status!=='playing'||busy)return;const wasArmed=armed;armed=false;clearHint();chain=findChain(state.board)||[];renderStats();chain.forEach(i=>$('board').children[i].classList.add('hinted'));toast(`Đã chọn sẵn một chuỗi. Nhấn Gửi cảm xúc!${wasArmed?' BUZZ! chưa bị sử dụng.':''}`);};
$('buzz-button').onclick=()=>{if(state.status!=='playing'||!state.buzzes||busy)return;armed=!armed;chain=[];clearHint();renderStats();toast(armed?'Chọn một ô để rung vùng 3×3. Bấm BUZZ! lần nữa để hủy.':'Đã hủy chọn BUZZ! Chưa dùng lượt hay năng lượng.');};
$('sound-button').onclick=()=>{sound=!sound;soundUI();save();tone(650,.12);toast(sound?'Đã bật âm thanh':'Đã tắt âm thanh');};
$('pause-button').onclick=pause;$('help-nav').onclick=showHelp;$('more-help').onclick=showHelp;$('collection-nav').onclick=showCollection;
$('play-nav').onclick=()=>{if($('modal').open)closeModal();$('board').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});};
$('close-modal').onclick=closeModal;
$('result-button').onclick=showResult;
$('modal').addEventListener('cancel',event=>{event.preventDefault();closeModal();});
$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const r=$('modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
document.addEventListener('keydown',event=>{
  if($('modal').open)return;
  if(event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(state.status==='playing'){
    const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-SIZE,ArrowDown:SIZE};
    if(Object.hasOwn(steps,event.key)){event.preventDefault();focusTile(Math.max(0,Math.min(SIZE*SIZE-1,focusIndex+steps[event.key])));return;}
    if(event.code==='Space'){event.preventDefault();event.stopPropagation();if(!event.repeat)submit();return;}
    if(event.key==='Enter'&&(event.target.closest?.('.tile')||event.target===document.body)){event.preventDefault();select(focusIndex);return;}
  }
  if(event.key==='Escape'){const wasArmed=armed;chain=[];armed=false;clearHint();renderStats();if(wasArmed)toast('Đã hủy chọn BUZZ! Chưa dùng lượt hay năng lượng.');}
  else if(event.key==='?'){event.preventDefault();showHelp();}
},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.status==='playing')pause();});
window.addEventListener('resize',drawChain);
soundUI();render();
if(state.status==='playing'){addChat('Đã khôi phục ván trước. Mình chơi tiếp nhé!',false,'wave');toast('Đã khôi phục ván chơi trước.');}
