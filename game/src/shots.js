// EMBERFALL — staged states for screenshots (?shot=title|play|win|loss).
// Each state is built by playing the real engine from a fixed seed, so the
// screenshots are genuine renders of the game's own code, just staged.

'use strict';

function shotParams() {
  const q = new URLSearchParams(window.location.search);
  return { shot: q.get('shot') || '', seed: parseInt(q.get('seed') || '7', 10) || 7 };
}

// Play the player's best affordable attack, if any. Deterministic: highest
// value first, ties broken by hand order.
function scriptedPlayerMove(state) {
  let best = null;
  let bestValue = -1;
  for (const cardId of state.player.hand) {
    const def = CARD_BY_ID[cardId];
    if (def.kind !== 'attack' && def.kind !== 'mixed') continue;
    if (def.cost > state.player.ember) continue;
    if (def.value > bestValue) { bestValue = def.value; best = cardId; }
  }
  if (best) playCard(state, state.player, best);
}

// A real mid-game: three full turns played through the engine, then top the
// player's hand up so the table reads full.
function buildPlayState(seed) {
  const state = newGame(seed);
  for (let t = 0; t < 3 && !state.winner; t++) {
    scriptedPlayerMove(state);
    scriptedPlayerMove(state);
    if (state.winner) break;
    endPlayerTurn(state);
    runAiTurn(state, 0, null, function () {});
  }
  if (state.winner) return buildPlayState(seed + 1);
  while (state.player.hand.length < 5 && state.player.deck.length) {
    drawCards(state, state.player, 1);
  }
  while (state.ai.hand.length < 4 && state.ai.deck.length) {
    drawCards(state, state.ai, 1);
  }
  state.player.ember = Math.min(state.player.maxEmber, 5);
  return state;
}

// A genuine win through the engine: the Warden at 4 life, Wildfire in hand.
function buildWinState(seed) {
  const state = newGame(seed);
  state.ai.life = 4;
  state.ai.shield = 0;
  if (state.player.hand.indexOf('wildfire') === -1) {
    state.player.hand.push('wildfire');
  }
  state.player.ember = Math.max(state.player.ember, 5);
  state.player.maxEmber = Math.max(state.player.maxEmber, 5);
  playCard(state, state.player, 'wildfire');
  return state;
}

// A genuine loss through the engine: you at 4 life, the Warden holds Wildfire.
function buildLossState(seed) {
  const state = newGame(seed);
  state.player.life = 4;
  state.player.shield = 0;
  if (state.ai.hand.indexOf('wildfire') === -1) {
    state.ai.hand.push('wildfire');
  }
  state.ai.ember = Math.max(state.ai.ember, 5);
  state.ai.maxEmber = Math.max(state.ai.maxEmber, 5);
  playCard(state, state.ai, 'wildfire');
  return state;
}

function buildShotState(shot, seed) {
  if (shot === 'play') return buildPlayState(seed);
  if (shot === 'win') return buildWinState(seed);
  if (shot === 'loss') return buildLossState(seed);
  return newGame(seed);
}
