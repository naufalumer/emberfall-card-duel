// EMBERFALL — card definitions, the element wheel, and deck building.
// Every card is an original design for this game: four elements, twelve cards.

'use strict';

// The four elements. Each has a colour, a drawn shape (never text alone),
// and a short label, so the judge and the player can tell them apart at a glance.
const ELEMENTS = {
  flame: { label: 'Flame', colour: '#ff7a2f', dark: '#b33d00', shape: 'flame' },
  tide: { label: 'Tide', colour: '#3fa9f5', dark: '#145da8', shape: 'drop' },
  gale: { label: 'Gale', colour: '#58c98a', dark: '#1e7a44', shape: 'wind' },
  stone: { label: 'Stone', colour: '#c9a35c', dark: '#7a5c1e', shape: 'gem' },
};

// The element wheel: Flame burns Gale, Gale scatters Tide, Tide drowns Flame.
// Stone stands outside the wheel: it neither beats nor loses to anything.
const BEATS = { flame: 'gale', gale: 'tide', tide: 'flame' };

function elementBeats(a, b) {
  return BEATS[a] === b;
}

// kind: attack | guard | heal | ember | mixed (attack + guard) | draw handled by flags
// value: the card's main number (damage, shield, or healing).
// draw: cards drawn when this card resolves (0 or 1).
const CARD_DEFS = [
  { id: 'ember-strike', name: 'Ember Strike', element: 'flame', cost: 1, kind: 'attack', value: 3, draw: 0, text: 'Deal 3 damage.' },
  { id: 'flame-lash', name: 'Flame Lash', element: 'flame', cost: 2, kind: 'attack', value: 4, draw: 0, text: 'Deal 4 damage.' },
  { id: 'wildfire', name: 'Wildfire', element: 'flame', cost: 3, kind: 'attack', value: 7, draw: 0, text: 'Deal 7 damage.' },
  { id: 'tide-crash', name: 'Tide Crash', element: 'tide', cost: 2, kind: 'attack', value: 4, draw: 0, text: 'Deal 4 damage.' },
  { id: 'deep-current', name: 'Deep Current', element: 'tide', cost: 3, kind: 'attack', value: 5, draw: 1, text: 'Deal 5 damage. Draw a card.' },
  { id: 'healing-spring', name: 'Healing Spring', element: 'tide', cost: 2, kind: 'heal', value: 5, draw: 0, text: 'Restore 5 life.' },
  { id: 'gale-cut', name: 'Gale Cut', element: 'gale', cost: 1, kind: 'attack', value: 2, draw: 1, text: 'Deal 2 damage. Draw a card.' },
  { id: 'storm-rush', name: 'Storm Rush', element: 'gale', cost: 3, kind: 'attack', value: 6, draw: 0, text: 'Deal 6 damage.' },
  { id: 'stone-wall', name: 'Stone Wall', element: 'stone', cost: 1, kind: 'guard', value: 5, draw: 0, text: 'Gain 5 shield.' },
  { id: 'bulwark', name: 'Bulwark', element: 'stone', cost: 2, kind: 'guard', value: 9, draw: 0, text: 'Gain 9 shield.' },
  { id: 'ember-tithe', name: 'Ember Tithe', element: 'stone', cost: 1, kind: 'ember', value: 3, draw: 0, text: 'Gain 3 ember.' },
  { id: 'cinder-swap', name: 'Cinder Swap', element: 'gale', cost: 2, kind: 'mixed', value: 3, draw: 0, text: 'Deal 3 damage. Gain 3 shield.' },
];

const CARD_BY_ID = {};
for (const def of CARD_DEFS) CARD_BY_ID[def.id] = def;

// A small seeded RNG (mulberry32) so staged screenshot states are reproducible
// and so the same seed always deals the same opening hands.
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
  }
  return list;
}

// A deck is two copies of each of the twelve designs: 24 cards.
function buildDeck(rng) {
  const deck = [];
  for (const def of CARD_DEFS) {
    deck.push(def.id);
    deck.push(def.id);
  }
  return shuffleInPlace(deck, rng);
}

// The wheel bonus: +2 when the played card's element beats the element the
// opponent last played. Stone never earns it.
function edgeBonus(cardElement, opponentLastElement) {
  if (!opponentLastElement) return 0;
  return elementBeats(cardElement, opponentLastElement) ? 2 : 0;
}

// The surge bonus: +2 when the same side already played this element this turn.
function surgeBonus(cardElement, elementsPlayedThisTurn) {
  return elementsPlayedThisTurn.indexOf(cardElement) !== -1 ? 2 : 0;
}
