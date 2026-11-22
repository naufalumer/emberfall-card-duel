// EMBERFALL — rendering: cards, table, log, and overlays, all plain DOM.
// Suits are told apart by colour AND shape AND name, never by text alone.

'use strict';

// Inline SVG shapes for the four elements, keyed by element id (drawn, not emoji).
const SHAPES = {
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 C13 6 17 8 17 13 a5 5 0 0 1 -10 0 C7 9 10 7 10 4 c1 1.5 2 2.5 2 4 1 -1 1.5 -2.5 0 -6z" fill="currentColor"/></svg>',
  tide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 C12 2 5 12 5 16 a7 7 0 0 0 14 0 C19 12 12 2 12 2z" fill="currentColor"/></svg>',
  gale: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8 h10 a3 3 0 1 0 -3 -3 M3 12 h14 a3 3 0 1 1 -3 3 M3 16 h7 a2.5 2.5 0 1 1 -2.5 2.5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
  stone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L20 9 L12 22 L4 9 z M12 2 L16 9 L12 22 L8 9 z" fill="currentColor" opacity="0.9"/></svg>',
};

const KIND_LABEL = { attack: 'DMG', guard: 'SHIELD', heal: 'HEAL', ember: 'EMBER', mixed: 'DMG+SHIELD' };

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

// One card face. `playable` lifts it and marks it clickable; `faceDown`
// renders the card back (the opponent's hand).
function buildCardFace(def, opts) {
  opts = opts || {};
  const card = el('div', 'card el-' + def.element + (opts.small ? ' small' : '') + (opts.playable ? ' playable' : '') + (opts.disabled ? ' disabled' : ''));
  if (opts.faceDown) {
    card.classList.add('facedown');
    const back = el('div', 'card-back');
    back.innerHTML = SHAPES.stone;
    card.appendChild(back);
    return card;
  }
  const meta = ELEMENTS[def.element];
  const top = el('div', 'card-top');
  const cost = el('span', 'cost', String(def.cost));
  cost.title = def.cost + ' ember to play';
  const elem = el('span', 'element');
  elem.innerHTML = SHAPES[def.element];
  const elemName = el('span', 'element-name', meta.label);
  top.appendChild(cost);
  top.appendChild(elem);
  top.appendChild(elemName);
  card.appendChild(top);

  const mid = el('div', 'card-mid');
  const value = el('div', 'card-value', String(opts.value !== undefined ? opts.value : def.value));
  const kind = el('div', 'card-kind', KIND_LABEL[def.kind]);
  mid.appendChild(value);
  mid.appendChild(kind);
  card.appendChild(mid);

  const name = el('div', 'card-name', def.name);
  const text = el('div', 'card-text', def.text);
  card.appendChild(name);
  card.appendChild(text);
  if (opts.note) card.appendChild(el('div', 'card-note', opts.note));
  if (opts.onClick) card.addEventListener('click', opts.onClick);
  return card;
}

function renderPips(container, filled, max) {
  container.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const pip = el('span', 'pip' + (i < filled ? ' on' : ''));
    container.appendChild(pip);
  }
}

function renderSidePanel(root, side, label, isPlayer) {
  root.innerHTML = '';
  const name = el('div', 'side-name', label);
  root.appendChild(name);
  const life = el('div', 'life');
  const lifeNum = el('span', 'life-num', side.life + ' / ' + START_LIFE);
  const lifeBar = el('div', 'life-bar');
  const lifeFill = el('div', 'life-fill');
  lifeFill.style.width = Math.max(0, (side.life / START_LIFE) * 100) + '%';
  lifeBar.appendChild(lifeFill);
  life.appendChild(lifeNum);
  life.appendChild(lifeBar);
  root.appendChild(life);
  const stats = el('div', 'side-stats');
  stats.appendChild(el('span', 'stat shield-stat', 'Shield ' + side.shield));
  stats.appendChild(el('span', 'stat', 'Ember ' + side.ember + '/' + side.maxEmber));
  stats.appendChild(el('span', 'stat', 'Deck ' + side.deck.length));
  root.appendChild(stats);
  const pips = el('div', 'ember-pips');
  renderPips(pips, side.ember, side.maxEmber);
  root.appendChild(pips);
}

// The table: opponent on top, the played cards and the log in the middle,
// the player's hand along the bottom.
const EmberRender = (function () {
  let state = null;
  let refs = {};
  let onPlayCard = null;
  let onEndTurn = null;
  let animationsOn = true;

  function $(id) { return document.getElementById(id); }

  function collectRefs() {
    refs = {
      app: $('app'),
      title: $('title-screen'),
      table: $('table'),
      end: $('end-screen'),
      endTitle: $('end-title'),
      endText: $('end-text'),
      endStats: $('end-stats'),
      aiPanel: $('ai-panel'),
      aiHand: $('ai-hand'),
      aiLast: $('ai-last'),
      playerPanel: $('player-panel'),
      playerHand: $('player-hand'),
      playerLast: $('player-last'),
      log: $('log'),
      hint: $('hint'),
      endTurn: $('end-turn'),
      turnLabel: $('turn-label'),
      titlePreview: $('title-preview'),
      mute: $('mute-btn'),
    };
  }

  function renderLog() {
    refs.log.innerHTML = '';
    const lines = state.log.slice(-6);
    for (const line of lines) {
      refs.log.appendChild(el('div', 'log-line', line));
    }
  }

  function renderHint() {
    const foeLast = state.ai.lastPlayed;
    const mineLast = state.player.lastPlayed;
    const hints = [];
    if (foeLast && BEATS.flame === foeLast) hints.push('Flame beats the Warden\u2019s ' + ELEMENTS[foeLast].label + ' — your Flame cards deal +2.');
    if (foeLast && BEATS.gale === foeLast) hints.push('Gale beats the Warden\u2019s ' + ELEMENTS[foeLast].label + ' — your Gale cards deal +2.');
    if (foeLast && BEATS.tide === foeLast) hints.push('Tide beats the Warden\u2019s ' + ELEMENTS[foeLast].label + ' — your Tide cards deal +2.');
    if (mineLast) hints.push('The Warden will counter your ' + ELEMENTS[mineLast].label + ' — watch its next card.');
    if (state.player.elementsPlayed.length) {
      const elName = state.player.elementsPlayed[state.player.elementsPlayed.length - 1];
      hints.push('Surge ready: another ' + ELEMENTS[elName].label + ' card this turn gains +2.');
    }
    refs.hint.textContent = hints.length ? hints[hints.length - 1] : 'The wheel: Flame beats Gale, Gale beats Tide, Tide beats Flame. Stone is neutral. Play two of one element in a turn for Surge +2.';
  }

  function renderLastPlayed() {
    refs.aiLast.innerHTML = '';
    refs.playerLast.innerHTML = '';
    const aiTitle = el('div', 'last-label', 'Warden played');
    refs.aiLast.appendChild(aiTitle);
    const plTitle = el('div', 'last-label', 'You played');
    refs.playerLast.appendChild(plTitle);
    if (state.ai.lastPlayedCard) {
      refs.aiLast.appendChild(buildCardFace(CARD_BY_ID[state.ai.lastPlayedCard], { small: true }));
    } else {
      refs.aiLast.appendChild(el('div', 'last-empty', '—'));
    }
    if (state.player.lastPlayedCard) {
      refs.playerLast.appendChild(buildCardFace(CARD_BY_ID[state.player.lastPlayedCard], { small: true }));
    } else {
      refs.playerLast.appendChild(el('div', 'last-empty', '—'));
    }
  }

  function renderHands() {
    refs.aiHand.innerHTML = '';
    for (let i = 0; i < state.ai.hand.length; i++) {
      refs.aiHand.appendChild(buildCardFace(CARD_DEFS[0], { small: true, faceDown: true }));
    }
    refs.aiHand.appendChild(el('span', 'hand-count', state.ai.hand.length + ' cards'));

    refs.playerHand.innerHTML = '';
    state.player.hand.forEach(function (cardId) {
      const def = CARD_BY_ID[cardId];
      const playable = state.phase === 'player' && state.player.ember >= def.cost;
      const note = playable ? '' : (state.phase === 'player' ? 'needs ' + def.cost + ' ember' : '');
      const face = buildCardFace(def, {
        playable: playable,
        disabled: !playable,
        note: note || undefined,
        onClick: function () {
          if (playable && onPlayCard) onPlayCard(cardId);
        },
      });
      refs.playerHand.appendChild(face);
    });
  }

  function renderAll() {
    if (!state) return;
    renderSidePanel(refs.aiPanel, state.ai, 'CINDER WARDEN', false);
    renderSidePanel(refs.playerPanel, state.player, 'YOU', true);
    refs.turnLabel.textContent = state.winner ? (state.winner === 'player' ? 'Victory' : 'Defeat') : ('Turn ' + state.turn + (state.phase === 'player' ? ' — your move' : ' — the Warden moves…'));
    refs.endTurn.disabled = state.phase !== 'player';
    renderLastPlayed();
    renderHands();
    renderHint();
    renderLog();
    if (state.winner) showEnd();
  }

  function showEnd() {
    refs.end.classList.remove('hidden');
    if (state.winner === 'player') {
      refs.endTitle.textContent = 'VICTORY';
      refs.endTitle.className = 'end-title win';
      refs.endText.textContent = 'The Cinder Warden\u2019s ember gutters out. The table is yours.';
    } else {
      refs.endTitle.textContent = 'DEFEAT';
      refs.endTitle.className = 'end-title lose';
      refs.endText.textContent = 'Your ember gutters out. The Warden keeps the table — for now.';
    }
    refs.endStats.innerHTML = '';
    const rows = [
      ['Turns played', String(state.turn)],
      ['Cards played', String(state.stats.cardsPlayed)],
      ['Biggest single hit', String(state.stats.biggestHit)],
      ['Damage you dealt', String(state.player.damageDealt)],
      ['Life remaining', state.player.life + ' / ' + START_LIFE],
    ];
    for (const row of rows) {
      const line = el('div', 'stat-row');
      line.appendChild(el('span', 'stat-key', row[0]));
      line.appendChild(el('span', 'stat-val', row[1]));
      refs.endStats.appendChild(line);
    }
  }

  function hideEnd() {
    refs.end.classList.add('hidden');
  }

  function renderTitlePreview() {
    refs.titlePreview.innerHTML = '';
    const sample = ['wildfire', 'deep-current', 'bulwark'];
    for (const id of sample) {
      refs.titlePreview.appendChild(buildCardFace(CARD_BY_ID[id], {}));
    }
  }

  return {
    init: function (s, callbacks) {
      state = s;
      onPlayCard = callbacks.onPlayCard;
      onEndTurn = callbacks.onEndTurn;
      collectRefs();
      renderTitlePreview();
      refs.endTurn.addEventListener('click', function () { if (onEndTurn) onEndTurn(); });
      refs.mute.addEventListener('click', function () {
        EmberAudio.setEnabled(!EmberAudio.isEnabled());
        refs.mute.textContent = EmberAudio.isEnabled() ? 'Sound: on' : 'Sound: off';
      });
      state.hooks.onEvent = function (event) {
        if (event.type === 'card') {
          const kind = event.outcome.card.kind;
          if (kind === 'attack' || kind === 'mixed') EmberAudio.hit();
          else if (kind === 'guard') EmberAudio.shield();
          else if (kind === 'heal') EmberAudio.heal();
          else if (kind === 'ember') EmberAudio.ember();
          else EmberAudio.play();
        } else if (event.type === 'turn') {
          EmberAudio.turn();
        } else if (event.type === 'end') {
          if (event.winner === 'player') EmberAudio.win();
          else EmberAudio.lose();
        }
        renderAll();
      };
    },
    renderAll: renderAll,
    showTable: function () {
      refs.title.classList.add('hidden');
      refs.table.classList.remove('hidden');
      hideEnd();
      renderAll();
    },
    showTitle: function () {
      refs.table.classList.add('hidden');
      refs.end.classList.add('hidden');
      refs.title.classList.remove('hidden');
    },
    setAnimations: function (on) {
      animationsOn = on;
      document.body.classList.toggle('no-anim', !on);
    },
    getState: function () { return state; },
  };
})();
