import { STAGES } from './engine.js';

// Equipment and checkpoint autosaves cannot move the shared resume stage back.
// Only an explicit restart/replay may select an earlier stage.
export function mergeProgress(previous, game, intent = 'keep') {
  return {
    owned: [...new Set([...previous.owned, ...game.owned])],
    equipped: game.equipped,
    level: intent === 'restart' ? game.level : intent === 'advance'
      ? Math.max(previous.level, Math.min(STAGES.length - 1, game.level + 1))
      : previous.level,
    best: Math.max(previous.best, game.score)
  };
}
