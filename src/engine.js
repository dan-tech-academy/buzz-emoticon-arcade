export const SIZE = 6;
export const EMOTES = [
  { id:'smile', name:'Vui vẻ', code:':)', color:'#fff3c9' },
  { id:'love', name:'Yêu thương', code:':x', color:'#ffe2e8' },
  { id:'laugh', name:'Cười hết cỡ', code:':))', color:'#ffecd6' },
  { id:'cool', name:'Ngầu', code:'B-)', color:'#dff1e9' },
  { id:'wink', name:'Nháy mắt', code:';)', color:'#e8e0fa' },
  { id:'tongue', name:'Tinh nghịch', code:':P', color:'#e2edff' },
  { id:'angel', name:'Thiên thần', code:'O:-)', color:'#fff5d9' },
  { id:'devil', name:'Tiểu quỷ', code:'>:)', color:'#eadcfa' },
  { id:'cry', name:'Bật khóc', code:'=((', color:'#e0efff' },
  { id:'grin', name:'Cười toe', code:':D', color:'#fff1c2' },
  { id:'sad', name:'Buồn bã', code:':(', color:'#e5eaf6' },
  { id:'hug', name:'Ôm một cái', code:'>:D<', color:'#ffe4dc' },
  { id:'sleep', name:'Buồn ngủ', code:'I-)', color:'#e8e5ff' },
  { id:'party', name:'Ăn mừng', code:'<:-P', color:'#ffe3ed' },
  { id:'clap', name:'Vỗ tay', code:'=D>', color:'#dff4e9' },
  { id:'wave', name:'Xin chào', code:':-h', color:'#e4f3f4' },
  { id:'cowboy', name:'Cao bồi', code:'<):)', color:'#fff0cb' },
  { id:'daydream', name:'Mơ mộng', code:'8->', color:'#fff0dd' },
  { id:'rolling', name:'Cười lăn lộn', code:'=))', color:'#ffe7c9' },
  { id:'talk', name:'Thôi đủ rồi', code:':-t', color:'#e9e4f8' },
  { id:'drool', name:'Thèm quá', code:'=P~', color:'#e2f1e5' },
  { id:'clown', name:'Chú hề', code:':O)', color:'#ffe3e5' },
  { id:'sick', name:'Buồn nôn', code:':-&', color:'#e3efcf' }
];
export const LEVEL_NAMES = ['Bạn cũ, cảm xúc mới', 'Một thời nick sáng đèn', 'Gửi ngàn thương nhớ', 'Hội bạn không ngủ', 'Ký ức luôn online'];
export function levelConfig(level) {
  const count = Math.min(5 + Math.floor((level - 1) / 2), 8);
  const goalIds = level % 2 ? ['smile','love','laugh'] : ['cool','wink','smile'];
  return { moves: 20, types: EMOTES.slice(0,count).map(e => e.id), goals:Object.fromEntries(goalIds.map((id,i)=>[id, 9 + Math.min(level - 1,8) + (i === 0 ? 3 : 0)])) };
}
export function adjacent(a,b) {
  return a !== b && Math.abs(a % SIZE - b % SIZE) <= 1 && Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) <= 1;
}
export function findChain(board, min = 3, only = null) {
  function walk(path) {
    if (path.length >= min) return path;
    const last = path.at(-1);
    for(let next=0; next<board.length; next++) {
      if(board[next] === board[last] && adjacent(last,next) && !path.includes(next)) {
        const found = walk([...path,next]);
        if(found) return found;
      }
    }
    return null;
  }
  for(let i=0; i<board.length; i++) { if(only&&!only.includes(board[i]))continue;const found=walk([i]); if(found) return found; }
  return null;
}
export function ensureGoalFaces(board,goals,collected) {
  const next=[...board], pending=Object.keys(goals).filter(id=>(collected[id]||0)<goals[id]).sort((a,b)=>(goals[b]-(collected[b]||0))-(goals[a]-(collected[a]||0)));
  if(!pending.length)return next;
  const count=id=>next.filter(face=>face===id).length;
  for(const id of pending)if(!next.includes(id)){
    const replace=next.findIndex(old=>!pending.includes(old)||count(old)>1);
    next[replace]=id;
  }
  if(findChain(next,3,pending))return next;
  // Keep the last copy of every other required face when repairing a dead goal chain.
  for(let row=0;row<SIZE;row++)for(let col=0;col<SIZE-2;col++){
    const cells=[row*SIZE+col,row*SIZE+col+1,row*SIZE+col+2];
    if(pending.slice(1).some(id=>count(id)===cells.filter(i=>next[i]===id).length))continue;
    cells.forEach(i=>next[i]=pending[0]);return next;
  }
  return next;
}
export function createBoard(types, random = Math.random) {
  const board = Array.from({length:SIZE*SIZE},()=>types[Math.floor(random()*types.length)]);
  if(!findChain(board)) board[0] = board[1] = board[2] = types[0];
  return board;
}
export function validChain(board, chain) {
  return chain.length >= 3 && new Set(chain).size === chain.length && chain.every((cell,i)=>Number.isInteger(cell) && cell >= 0 && cell < board.length && board[cell] === board[chain[0]] && (!i || adjacent(chain[i-1],cell)));
}
export function collapse(board, cells, types, random = Math.random) {
  const removed = new Set(cells);
  const next = [...board];
  for(let col=0; col<SIZE; col++) {
    const remaining=[];
    for(let row=SIZE-1; row>=0; row--) if(!removed.has(row*SIZE+col)) remaining.push(board[row*SIZE+col]);
    for(let row=SIZE-1; row>=0; row--) next[row*SIZE+col] = remaining[SIZE-1-row] ?? types[Math.floor(random()*types.length)];
  }
  if(!findChain(next)) return createBoard(types,random);
  return next;
}
export function buzzArea(cell) {
  return Array.from({length:SIZE*SIZE},(_,i)=>i).filter(i=>Math.abs(i%SIZE-cell%SIZE)<=1 && Math.abs(Math.floor(i/SIZE)-Math.floor(cell/SIZE))<=1);
}
export function chainScore(length) { return length * 30 + Math.max(0,length-3) * 20; }
export function newGame(level = 1) {
  const config=levelConfig(level);
  const collected=Object.fromEntries(Object.keys(config.goals).map(id=>[id,0]));
  return { level, ...config, board:ensureGoalFaces(createBoard(config.types),config.goals,collected), collected, score:0, charge:0, buzzes:1, status:'ready' };
}
export function restoreGame(round) {
  if(!round || !Number.isInteger(round.level) || round.level<1 || round.level>10000 || !['playing','paused'].includes(round.status)) return null;
  const config=levelConfig(round.level);
  if(!Array.isArray(round.board) || round.board.length!==SIZE*SIZE || !round.board.every(id=>config.types.includes(id))) return null;
  for(const [key,min,max] of [['moves',1,config.moves],['score',0,1e9],['charge',0,17],['buzzes',0,3]]) {
    if(!Number.isInteger(round[key]) || round[key]<min || round[key]>max)return null;
  }
  if(!round.collected || !Object.keys(config.goals).every(id=>Number.isInteger(round.collected[id]) && round.collected[id]>=0 && round.collected[id]<=SIZE*SIZE*config.moves))return null;
  if(Object.keys(config.goals).every(id=>round.collected[id]>=config.goals[id]))return null;
  return { ...newGame(round.level), ...config, board:[...round.board], moves:round.moves, score:round.score, charge:round.charge, buzzes:round.buzzes, collected:Object.fromEntries(Object.keys(config.goals).map(id=>[id,round.collected[id]])), status:'playing' };
}
export function clearCells(state, cells, isBuzz = false) {
  if(state.status !== 'playing' || (!isBuzz && !validChain(state.board,cells))) return state;
  if(isBuzz && (!state.buzzes || !cells.some(center => {
    const area=buzzArea(center);
    return area.length === cells.length && area.every(i=>cells.includes(i));
  }))) return state;
  if(!cells.length || new Set(cells).size !== cells.length || cells.some(i=>!Number.isInteger(i)||i<0||i>=SIZE*SIZE)) return state;
  const collected={...state.collected};
  for(const i of cells) if(Object.hasOwn(collected,state.board[i])) collected[state.board[i]]++;
  const earned=state.charge + (isBuzz ? 0 : cells.length);
  const moves=state.moves-1;
  const won=Object.keys(state.goals).every(id=>collected[id] >= state.goals[id]);
  return { ...state, board:ensureGoalFaces(collapse(state.board,cells,state.types),state.goals,collected), collected, moves,
    score:state.score+(isBuzz?cells.length*30:chainScore(cells.length))+(won?moves*50:0),
    charge:earned%18, buzzes:Math.min(3,state.buzzes-(isBuzz?1:0)+Math.floor(earned/18)),
    status:won?'won':moves<=0?'lost':'playing' };
}
