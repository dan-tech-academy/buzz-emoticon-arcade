import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, adjacent, validChain, findChain, createBoard, collapse, buzzArea, chainScore, newGame, restoreGame, clearCells, levelConfig } from '../src/engine.js';

function playing() {const game=newGame();game.status='playing';game.board=Array(36).fill('smile');return game;}

test('neighbors include diagonals but never wrap across row boundaries',()=>{
  assert.equal(adjacent(0,7),true);assert.equal(adjacent(0,6),true);assert.equal(adjacent(5,6),false);assert.equal(adjacent(0,0),false);assert.equal(adjacent(0,2),false);
});
test('a chain requires three distinct, matching, adjacent board indices',()=>{
  const board=Array(36).fill('smile');board[2]='love';
  assert.equal(validChain(board,[0,6,7]),true);
  for(const chain of [[0,1],[0,1,2],[0,0,6],[0,6,20],[0,6,-1],[0,6,36],[0,6,7.5]])assert.equal(validChain(board,chain),false);
});
test('hints find a legal chain, and report a dead board',()=>{
  assert.equal(findChain(Array.from({length:36},(_,i)=>String(i))),null);
  const board=Array.from({length:36},(_,i)=>String(i));board[0]=board[7]=board[14]='wink';
  const hint=findChain(board);assert.ok(hint);assert.equal(validChain(board,hint),true);
});
test('generated boards always have 36 valid cells and a playable chain',()=>{
  for(let i=0;i<200;i++) {
    const types=levelConfig(1+i%12).types, board=createBoard(types);
    assert.equal(board.length,SIZE*SIZE);assert.ok(board.every(x=>types.includes(x)));assert.ok(findChain(board));
  }
});
test('dead-board generation repairs a valid starting chain even for deterministic random values',()=>{
  let cursor=0;const board=createBoard(['smile','love','laugh','cool','wink'],()=>((cursor++*7)%99)/100);
  assert.ok(findChain(board));
});
test('gravity preserves the order of unremoved faces in each column',()=>{
  const board=Array(36).fill('smile');board[0]='love';board[6]='laugh';board[12]='cool';board[18]='wink';board[24]='love';board[30]='laugh';
  const next=collapse(board,[18,30],['smile'],()=>0);
  assert.deepEqual([next[0],next[6],next[12],next[18],next[24],next[30]],['smile','smile','love','laugh','cool','love']);
  assert.equal(board[30],'laugh');
});
test('longer chains get a bonus, not just proportional points',()=>{
  assert.equal(chainScore(3),90);assert.equal(chainScore(4),140);assert.equal(chainScore(6),240);
});
test('sending consumes exactly one move and counts only cleared goal faces',()=>{
  const game=playing(), next=clearCells(game,[0,1,2]);
  assert.equal(next.moves,19);assert.equal(next.collected.smile,3);assert.equal(next.collected.love,0);assert.equal(next.score,90);assert.equal(next.charge,3);assert.equal(next.status,'playing');
  assert.equal(game.moves,20);assert.equal(game.collected.smile,0);
});
test('invalid or paused moves are no-ops',()=>{
  const game=playing();assert.equal(clearCells(game,[0,0,1]),game);
  game.status='paused';assert.equal(clearCells(game,[0,1,2]),game);
});
test('collecting 18 faces recharges BUZZ and keeps overflow energy',()=>{
  const game=playing();game.charge=17;
  const next=clearCells(game,[0,1,2]);assert.equal(next.buzzes,2);assert.equal(next.charge,2);
  game.buzzes=3;assert.equal(clearCells(game,[0,1,2]).buzzes,3);
});
test('BUZZ targets a bounded 3×3 neighborhood without wrapping',()=>{
  assert.deepEqual(buzzArea(0),[0,1,6,7]);assert.equal(buzzArea(7).length,9);assert.equal(buzzArea(5).length,4);assert.equal(buzzArea(2).length,6);
});
test('BUZZ clears mixed faces, spends one charge and one move, without recharging itself',()=>{
  const game=playing();game.board[1]='love';game.board[6]='laugh';
  const next=clearCells(game,buzzArea(0),true);
  assert.equal(next.buzzes,0);assert.equal(next.moves,19);assert.equal(next.collected.smile,2);assert.equal(next.collected.love,1);assert.equal(next.collected.laugh,1);assert.equal(next.charge,0);assert.equal(next.score,120);
});
test('BUZZ rejects malformed areas and unavailable charges',()=>{
  const game=playing();assert.equal(clearCells(game,[0,1,2],true),game);assert.equal(clearCells(game,[0,1,6,99],true),game);
  game.buzzes=0;assert.equal(clearCells(game,buzzArea(7),true),game);
});
test('meeting the final goal on the last move wins rather than loses',()=>{
  const game=playing();game.moves=1;game.goals={smile:3};game.collected={smile:0};
  const next=clearCells(game,[0,1,2]);assert.equal(next.status,'won');assert.equal(next.score,90);assert.equal(next.moves,0);
});
test('winning early includes the remaining-move bonus',()=>{
  const game=playing();game.goals={smile:3};game.collected={smile:0};
  assert.equal(clearCells(game,[0,1,2]).score,90+19*50);
});
test('uncompleted goals at zero moves end the round',()=>{
  const game=playing();game.moves=1;assert.equal(clearCells(game,[0,1,2]).status,'lost');
});
test('later rooms only target faces that are actually on their board',()=>{
  for(let level=1;level<=100;level++) {
    const config=levelConfig(level);assert.ok(Object.keys(config.goals).every(id=>config.types.includes(id)));assert.ok(config.types.length<=8);assert.equal(config.moves,20);
  }
});
test('saved rounds restore exact board, progress, score and resources without restoring pause',()=>{
  const game=clearCells(playing(),[0,1,2]);game.status='paused';
  const restored=restoreGame(JSON.parse(JSON.stringify(game)));
  assert.deepEqual(restored,{...game,status:'playing'});
  restored.board[0]=game.board[0]==='smile'?'love':'smile';restored.collected.smile++;
  assert.notDeepEqual(restored.board,game.board);assert.equal(game.collected.smile,3);
});
test('corrupted, completed and incompatible saves do not restore',()=>{
  const game=playing();
  for(const bad of [null,{}, {...game,status:'won'}, {...game,moves:0}, {...game,moves:21}, {...game,score:-1}, {...game,charge:18}, {...game,buzzes:4}, {...game,board:['smile']}, {...game,board:Array(36).fill('missing')}, {...game,collected:{smile:0}}, {...game,collected:{smile:12,love:9,laugh:9}}])assert.equal(restoreGame(bad),null);
});
