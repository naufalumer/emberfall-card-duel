// EMBERFALL — boot: wire the engine to the renderer and the buttons.
// With ?shot= in the URL the game opens straight into that staged state
// (title, play, win, loss) with animations and sound off, for screenshots.

'use strict';

(function () {
  const params = shotParams();
  const staged = params.shot !== '';
  if (staged) EmberAudio.setEnabled(false);

  const seed = staged ? params.seed : (Date.now() % 2147483647);
  const state = buildShotState(params.shot, seed);
  window.__emberfall = { state: state, shot: params.shot, seed: seed };

  let aiRunning = false;

  function endTurnClicked() {
    if (aiRunning || state.phase !== 'player' || state.winner) return;
    aiRunning = true;
    EmberRender.renderAll();
    if (!endPlayerTurn(state)) { aiRunning = false; return; }
    EmberRender.renderAll();
    runAiTurn(state, 650, function () { EmberRender.renderAll(); }, function () {
      aiRunning = false;
      EmberRender.renderAll();
    });
  }

  EmberRender.init(state, {
    onPlayCard: function (cardId) {
      if (aiRunning || state.phase !== 'player' || state.winner) return;
      EmberAudio.unlock();
      const outcome = playCard(state, state.player, cardId);
      if (outcome) {
        EmberAudio.deal();
        EmberRender.renderAll();
      }
    },
    onEndTurn: endTurnClicked,
  });

  if (staged) {
    EmberRender.setAnimations(false);
    if (params.shot === 'title') {
      EmberRender.showTitle();
    } else {
      EmberRender.showTable();
      if (state.winner) EmberRender.renderAll();
    }
    document.title = 'Emberfall — ' + params.shot;
    return;
  }

  EmberRender.showTitle();
  document.getElementById('begin-btn').addEventListener('click', function () {
    EmberAudio.unlock();
    EmberAudio.deal();
    EmberRender.showTable();
  });
  document.getElementById('again-btn').addEventListener('click', function () {
    window.location.href = window.location.pathname;
  });
})();
