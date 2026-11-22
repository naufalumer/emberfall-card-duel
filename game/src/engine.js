// EMBERFALL — the game engine: state, turns, combat, and the AI opponent.
// No DOM here: the engine only mutates state and calls the hooks the renderer
// registers (onEvent) so play, animation, and sound stay separate.

'use strict';

const START_LIFE = 30;
const START_HAND = 4;
const MAX_HAND = 7;
const MAX_EMBER = 10;

function makeSide(deck) {
  return {
    life: START_LIFE,
    shield: 0,
    ember: 0,
    maxEmber: 0,
    deck: deck.slice(),
    hand: [],
    discard: [],
    lastPlayed: null, // element id of the last card this side played, or null
    lastPlayedCard: null, // id of the last card this side played, or null
    elementsPlayed: [], // elements this side played this turn (for surge)
    damageDealt: 0,
  };
}

function newGame(seed) {
  const rng = makeRng(seed);
  const state = {
    seed: seed,
    rng: rng,
    turn: 1,
    phase: 'player', // 'player' | 'ai' | 'over'
    player: makeSide(buildDeck(rng)),
    ai: makeSide(buildDeck(rng)),
    log: [],
    winner: null, // 'player' | 'ai' | null
    stats: { cardsPlayed: 0, biggestHit: 0 },
    hooks: { onEvent: null },
  };
  drawCards(state, state.player, START_HAND);
  drawCards(state, state.ai, START_HAND);
  state.player.maxEmber = 3;
  state.player.ember = 3;
  state.ai.maxEmber = 3;
  state.ai.ember = 3;
  logLine(state, 'The duel begins. You hold the first turn — 3 ember, 4 cards.');
  return state;
}

function logLine(state, text) {
  state.log.push(text);
  if (state.log.length > 40) state.log.shift();
}

function drawCards(state, side, n) {
  for (let i = 0; i < n; i++) {
    if (side.deck.length === 0) {
      if (side.discard.length === 0) return;
      side.deck = shuffleInPlace(side.discard, state.rng);
      side.discard = [];
      logLine(state, side === state.player ? 'Your discard is shuffled back into your deck.' : 'The Warden reshuffles its discard into its deck.');
    }
    if (side.hand.length >= MAX_HAND) {
      side.discard.push(side.deck.pop());
      logLine(state, side === state.player ? 'Your hand is full — the drawn card burns away.' : 'The Warden burns a drawn card; its hand is full.');
      continue;
    }
    side.hand.push(side.deck.pop());
  }
}

function emit(state, event) {
  if (state.hooks.onEvent) state.hooks.onEvent(event);
}

// The number a card actually does, after wheel edge and surge.
// Ember Tithe is the one card the bonuses never touch.
function resolvedValue(state, side, def) {
  if (def.kind === 'ember') return def.value;
  const foe = side === state.player ? state.ai : state.player;
  const edge = edgeBonus(def.element, foe.lastPlayed);
  const surge = surgeBonus(def.element, side.elementsPlayed);
  return { value: def.value + edge + surge, edge: edge, surge: surge };
}

function canPlay(state, side, cardId) {
  if (state.phase === 'over') return false;
  const def = CARD_BY_ID[cardId];
  return def && side.ember >= def.cost && side.hand.indexOf(cardId) !== -1;
}

// Apply one card. Returns a plain description of what happened for the log
// and the animations, or null when the card cannot be played.
function playCard(state, side, cardId) {
  const def = CARD_BY_ID[cardId];
  if (!def) return null;
  if (side.ember < def.cost) return null;
  const handIndex = side.hand.indexOf(cardId);
  if (handIndex === -1) return null;
  const foe = side === state.player ? state.ai : state.player;
  const who = side === state.player ? 'You' : 'The Warden';
  const resolved = resolvedValue(state, side, def);
  const bonusText = [];
  if (resolved.edge) bonusText.push('wheel +2');
  if (resolved.surge) bonusText.push('surge +2');

  side.ember -= def.cost;
  side.hand.splice(handIndex, 1);
  side.discard.push(cardId);
  side.elementsPlayed.push(def.element);
  side.lastPlayed = def.element;
  side.lastPlayedCard = cardId;
  state.stats.cardsPlayed++;

  let outcome = { card: def, value: resolved.value, edge: resolved.edge, surge: resolved.surge, damage: 0, shield: 0, healed: 0, ember: 0, drawn: 0 };

  if (def.kind === 'attack' || def.kind === 'mixed') {
    let damage = resolved.value;
    const absorbed = Math.min(foe.shield, damage);
    foe.shield -= absorbed;
    damage -= absorbed;
    foe.life = Math.max(0, foe.life - damage);
    side.damageDealt += damage;
    if (damage > state.stats.biggestHit) state.stats.biggestHit = damage;
    outcome.damage = damage;
    outcome.absorbed = absorbed;
    logLine(state, who + ' play' + (side === state.player ? '' : 's') + ' ' + def.name + ' — ' + damage + ' damage' + (absorbed ? ' (' + absorbed + ' stopped by shield)' : '') + (bonusText.length ? ' [' + bonusText.join(', ') + ']' : '') + '.');
  }
  if (def.kind === 'guard' || def.kind === 'mixed') {
    const shield = resolved.value;
    side.shield += shield;
    outcome.shield = shield;
    logLine(state, who + (side === state.player ? ' gain ' : ' gains ') + shield + ' shield from ' + def.name + (bonusText.length ? ' [' + bonusText.join(', ') + ']' : '') + '.');
  }
  if (def.kind === 'heal') {
    const healed = Math.min(resolved.value, START_LIFE - side.life);
    side.life += healed;
    outcome.healed = healed;
    logLine(state, who + ' restore' + (side === state.player ? '' : 's') + ' ' + healed + ' life with ' + def.name + (bonusText.length ? ' [' + bonusText.join(', ') + ']' : '') + '.');
  }
  if (def.kind === 'ember') {
    side.ember += def.value;
    outcome.ember = def.value;
    logLine(state, who + (side === state.player ? ' gain ' : ' gains ') + def.value + ' ember from ' + def.name + '.');
  }
  if (def.draw) {
    drawCards(state, side, def.draw);
    outcome.drawn = def.draw;
  }

  emit(state, { type: 'card', side: side === state.player ? 'player' : 'ai', outcome: outcome });
  checkEnd(state);
  return outcome;
}

function checkEnd(state) {
  if (state.winner) return;
  if (state.ai.life <= 0) {
    state.winner = 'player';
    state.phase = 'over';
    logLine(state, 'The Warden falls. Victory is yours.');
    emit(state, { type: 'end', winner: 'player' });
  } else if (state.player.life <= 0) {
    state.winner = 'ai';
    state.phase = 'over';
    logLine(state, 'Your ember gutters out. The Warden stands.');
    emit(state, { type: 'end', winner: 'ai' });
  }
}

// --- The AI: Cinder Warden -------------------------------------------------
// Readable, not random: it guards when hurt, heals when low, spends ember on
// the hardest hit it can afford, and prefers the element that beats the card
// you last played — so its choices can be read and countered next turn.
function aiCardScore(state, side, def) {
  const foe = state.player;
  const resolved = resolvedValue(state, side, def);
  let score = 0;
  if (def.kind === 'attack') score = resolved.value * 2 + (def.draw ? 1.5 : 0);
  if (def.kind === 'mixed') score = resolved.value * 2 + 3;
  if (def.kind === 'guard') score = side.life <= 12 ? resolved.value * 2.2 : resolved.value * 0.7;
  if (def.kind === 'heal') score = side.life <= 10 ? resolved.value * 2.4 : resolved.value * 0.4;
  if (def.kind === 'ember') score = side.ember + def.value <= 6 ? 2 : 0.5;
  if (def.cost > side.ember) score = -100;
  // Prefer the counter to the player's last card: the wheel is the tell.
  if (foe.lastPlayed && elementBeats(def.element, foe.lastPlayed)) score += 2;
  // A cheap card that draws keeps the engine turning.
  if (def.draw) score += 1;
  return score;
}

// One AI step: play its single best affordable card, or null when it is done.
function aiStep(state) {
  const side = state.ai;
  let best = null;
  let bestScore = 0.5;
  for (const cardId of side.hand) {
    const def = CARD_BY_ID[cardId];
    const score = aiCardScore(state, side, def);
    if (score > bestScore) { bestScore = score; best = cardId; }
  }
  if (!best) return null;
  return playCard(state, side, best);
}

// --- Turn flow --------------------------------------------------------------
function endPlayerTurn(state) {
  if (state.phase !== 'player' || state.winner) return false;
  state.phase = 'ai';
  logLine(state, '— The Warden takes its turn —');
  emit(state, { type: 'turn', phase: 'ai' });
  return true;
}

function startPlayerTurn(state) {
  state.turn++;
  state.player.maxEmber = Math.min(MAX_EMBER, state.player.maxEmber + 1);
  state.player.ember = state.player.maxEmber;
  state.ai.maxEmber = Math.min(MAX_EMBER, state.ai.maxEmber + 1);
  state.ai.ember = state.ai.maxEmber;
  state.player.elementsPlayed = [];
  state.ai.elementsPlayed = [];
  drawCards(state, state.player, 1);
  state.phase = 'player';
  logLine(state, 'Turn ' + state.turn + ' — your ember refills to ' + state.player.ember + '. Draw a card.');
  emit(state, { type: 'turn', phase: 'player' });
}

// Runs the AI turn step by step with a delay between cards so the player can
// follow it. `step` is called with each outcome; `done` when the AI is finished
// and the player's next turn has begun. Pass delay 0 for instant (tests, shots).
function runAiTurn(state, delay, step, done) {
  function next() {
    if (state.winner) { done(); return; }
    const outcome = aiStep(state);
    if (outcome) {
      if (step) step(outcome);
      if (delay > 0) setTimeout(next, delay);
      else next();
      return;
    }
    logLine(state, 'The Warden ends its turn.');
    startPlayerTurn(state);
    done();
  }
  if (delay > 0) setTimeout(next, delay);
  else next();
}
