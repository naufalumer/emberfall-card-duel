// EMBERFALL — sound: every effect is synthesized with WebAudio, no audio files.
// The context is created lazily on the first user gesture; staged screenshot
// states never touch it, so screenshots stay silent.

'use strict';

const EmberAudio = (function () {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  function tone(freq, dur, type, gain, when, slideTo) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + (when || 0);
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp);
    amp.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, gain, when, lowpass) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + (when || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const amp = c.createGain();
    amp.gain.setValueAtTime(gain || 0.1, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = src;
    if (lowpass) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      node = f;
    }
    node.connect(amp);
    amp.connect(c.destination);
    src.start(t0);
  }

  // Named effects, one per game moment.
  return {
    unlock: unlock,
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },
    deal: function () { noise(0.12, 0.08, 0, 4000); },
    play: function () { tone(520, 0.12, 'triangle', 0.1, 0, 780); },
    hit: function () { tone(140, 0.18, 'sawtooth', 0.12, 0, 70); noise(0.1, 0.1, 0, 900); },
    shield: function () { tone(340, 0.2, 'sine', 0.1, 0, 520); },
    heal: function () { tone(660, 0.25, 'sine', 0.08, 0, 990); },
    ember: function () { tone(880, 0.1, 'square', 0.05, 0); tone(1320, 0.14, 'square', 0.04, 0.08); },
    turn: function () { tone(440, 0.1, 'triangle', 0.08, 0, 660); },
    win: function () {
      const notes = [523, 659, 784, 1047];
      notes.forEach(function (f, i) { tone(f, 0.35, 'triangle', 0.11, i * 0.13); });
      tone(1319, 0.6, 'triangle', 0.09, 0.55);
    },
    lose: function () {
      const notes = [392, 330, 262, 196];
      notes.forEach(function (f, i) { tone(f, 0.4, 'sine', 0.1, i * 0.16); });
    },
  };
})();
