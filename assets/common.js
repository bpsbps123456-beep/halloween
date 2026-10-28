/* 할로윈 게임 파티 — 공통 기능
   - 기록 저장(이 브라우저에만 저장)과 명예의 전당
   - 효과음·배경음 (Web Audio로 직접 합성, 소리 파일 없음)
   - 화면 크기 맞춤, 고정 시간 게임 루프, 캔버스 글자 도우미 */
(function () {
  'use strict';

  const HG = (window.HG = window.HG || {});

  /* ---------------- 저장 ---------------- */
  const PREFIX = 'halloween-party:';

  HG.store = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
  };

  /* ---------------- 명예의 전당 (게임별 상위 10명) ---------------- */
  const BOARD_SIZE = 10;

  HG.board = {
    list(game) {
      const rows = HG.store.get('board:' + game, []);
      return Array.isArray(rows) ? rows.filter((r) => r && typeof r.score === 'number') : [];
    },
    /** asc = true 이면 작은 점수(빠른 시간)가 1등입니다. */
    qualifies(game, score, asc) {
      if (!(score > 0)) return false;
      const rows = this.list(game);
      if (rows.length < BOARD_SIZE) return true;
      const last = rows[rows.length - 1].score;
      return asc ? score < last : score > last;
    },
    /** 기록을 넣고 순위(0부터)를 돌려줍니다. 10위 밖이면 -1. */
    add(game, name, score, extra, asc) {
      const rows = this.list(game);
      const entry = Object.assign({}, extra || {}, {
        name: String(name || '').trim().slice(0, 8) || '이름 없음',
        score,
        at: Date.now(),
      });
      rows.push(entry);
      rows.sort((a, b) => (asc ? a.score - b.score : b.score - a.score) || a.at - b.at);
      const top = rows.slice(0, BOARD_SIZE);
      HG.store.set('board:' + game, top);
      return top.indexOf(entry);
    },
    best(game) {
      const rows = this.list(game);
      return rows.length ? rows[0] : null;
    },
  };

  /** 이 기기 최고 기록 (이름을 안 적어도 남습니다) */
  HG.best = {
    get(game) {
      const v = HG.store.get('best:' + game, 0);
      return typeof v === 'number' ? v : 0;
    },
    submit(game, score, asc) {
      const prev = this.get(game);
      if (prev === 0 || (asc ? score < prev : score > prev)) {
        HG.store.set('best:' + game, score);
        return true;
      }
      return false;
    },
  };

  /** <ol> 안에 명예의 전당을 그립니다. format(row)는 오른쪽 칸 글자. */
  HG.renderBoard = function (ol, game, format, highlightIndex) {
    ol.textContent = '';
    const rows = HG.board.list(game);
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = '아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!';
      ol.appendChild(li);
      return;
    }
    rows.forEach((row, i) => {
      const li = document.createElement('li');
      if (i === highlightIndex) li.className = 'me';
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = row.name;
      const what = document.createElement('span');
      what.className = 'what';
      what.textContent = format(row);
      li.append(who, what);
      ol.appendChild(li);
    });
  };

  /** 결과 화면: 10위 안이면 이름을 받아 명예의 전당에 올립니다. */
  HG.setupResultBoard = function (o) {
    const qualifies = HG.board.qualifies(o.game, o.score, o.asc);
    o.form.hidden = !qualifies;
    HG.renderBoard(o.list, o.game, o.format, -1);
    o.form.onsubmit = (e) => {
      e.preventDefault();
      const name = o.input.value.trim();
      if (!name) {
        o.input.focus();
        return;
      }
      HG.store.set('lastName', name);
      const rank = HG.board.add(o.game, name, o.score, o.extra, o.asc);
      o.form.hidden = true;
      HG.renderBoard(o.list, o.game, o.format, rank);
      HG.sound.play('gold');
      if (o.onSaved) o.onSaved(rank);
    };
    if (qualifies) {
      o.input.value = o.name != null ? o.name : HG.store.get('lastName', '');
      // 마우스가 있는 컴퓨터에서만 바로 입력할 수 있게 둡니다 (태블릿은 자판이 갑자기 뜨지 않게)
      if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
        setTimeout(() => {
          o.input.focus();
          o.input.select();
        }, 60);
      }
    }
    return qualifies;
  };

  /* ---------------- 소리 ---------------- */
  HG.sound = (function () {
    let ctx = null;
    let master = null;
    let sfxBus = null;
    let musicBus = null;
    let noiseBuf = null;
    let muted = !!HG.store.get('muted', false);
    const listeners = [];

    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
          ctx = new AC();
        } catch (e) {
          return null;
        }
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.9;
        master.connect(ctx.destination);
        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.6;
        sfxBus.connect(master);
        musicBus = ctx.createGain();
        musicBus.gain.value = 0.2;
        musicBus.connect(master);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }

    // 브라우저는 사용자가 한 번 누른 뒤에야 소리를 허락합니다.
    ['pointerdown', 'keydown', 'touchend'].forEach((type) =>
      window.addEventListener(type, ensure, { capture: true, passive: true })
    );

    const N = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
    // play(name, { vol, pan }) 로 효과음 하나의 크기와 좌우 방향을 바꿔요
    let sfxScale = 1;
    let sfxPan = 0;
    function output(c, o) {
      const bus = o.bus || sfxBus;
      if (o.bus || !sfxPan || !c.createStereoPanner) return bus;
      const p = c.createStereoPanner();
      p.pan.value = sfxPan;
      p.connect(bus);
      return p;
    }

    function tone(o) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      const t0 = o.when != null ? o.when : c.currentTime + (o.at || 0);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
      if (o.vib) {
        const lfo = c.createOscillator();
        const depth = c.createGain();
        lfo.frequency.value = o.vib.rate;
        depth.gain.value = o.vib.depth;
        lfo.connect(depth);
        depth.connect(osc.frequency);
        lfo.start(t0);
        lfo.stop(t0 + o.dur + 0.05);
      }
      const vol = Math.max(0.0002, (o.vol == null ? 0.2 : o.vol) * (o.bus ? 1 : sfxScale));
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.004));
      if (o.hold) {
        // 삐- 처럼 끝까지 같은 크기로
        g.gain.setValueAtTime(vol, t0 + Math.max(o.attack || 0.004, o.dur - 0.03));
        g.gain.linearRampToValueAtTime(0.0001, t0 + o.dur);
      } else g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(g);
      const bus = output(c, o);
      if (o.lowpass) {
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = o.lowpass;
        g.connect(f);
        f.connect(bus);
      } else {
        g.connect(bus);
      }
      osc.start(t0);
      osc.stop(t0 + o.dur + 0.05);
    }

    function noise(o) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t0 = o.when != null ? o.when : c.currentTime + (o.at || 0);
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      const f = c.createBiquadFilter();
      f.type = o.type || 'bandpass';
      f.frequency.setValueAtTime(o.f || 1000, t0);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
      f.Q.value = o.q || 1;
      const g = c.createGain();
      const vol = Math.max(0.0002, (o.vol == null ? 0.2 : o.vol) * (o.bus ? 1 : sfxScale));
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      src.connect(f);
      f.connect(g);
      g.connect(output(c, o));
      src.start(t0, Math.random() * 0.5);
      src.stop(t0 + o.dur + 0.05);
    }

    const SFX = {
      click: () => tone({ type: 'triangle', f: 880, dur: 0.05, vol: 0.12 }),
      start: () =>
        [72, 76, 79, 84].forEach((m, i) =>
          tone({ type: 'triangle', f: N(m), dur: 0.16, vol: 0.16, at: i * 0.07 })
        ),
      tick: () => tone({ type: 'triangle', f: 660, dur: 0.07, vol: 0.14 }),
      go: () => tone({ type: 'triangle', f: 990, dur: 0.18, vol: 0.16 }),
      jump: () => tone({ type: 'square', f: 330, to: 660, dur: 0.12, vol: 0.06, lowpass: 2400 }),
      web: () => {
        noise({ f: 3200, to: 900, dur: 0.12, vol: 0.22, q: 1.5 });
        tone({ type: 'triangle', f: 1400, to: 500, dur: 0.1, vol: 0.08 });
      },
      miss: () => noise({ f: 1200, to: 500, dur: 0.1, vol: 0.08, q: 2 }),
      flip: () => noise({ f: 600, to: 2600, dur: 0.24, vol: 0.12, q: 1 }),
      land: () => tone({ type: 'sine', f: 150, to: 70, dur: 0.08, vol: 0.16 }),
      candy: () => {
        tone({ type: 'triangle', f: N(88), dur: 0.08, vol: 0.11 });
        tone({ type: 'triangle', f: N(95), dur: 0.1, vol: 0.09, at: 0.05 });
      },
      gold: () =>
        [84, 88, 91, 96].forEach((m, i) =>
          tone({ type: 'square', f: N(m), dur: 0.1, vol: 0.05, at: i * 0.045, lowpass: 5000 })
        ),
      bonk: () => tone({ type: 'square', f: 180, to: 90, dur: 0.12, vol: 0.12, lowpass: 900 }),
      fall: () => tone({ type: 'sine', f: 900, to: 120, dur: 0.7, vol: 0.15, vib: { rate: 9, depth: 18 } }),
      clear: () =>
        [[72, 0], [76, 0.1], [79, 0.2], [84, 0.32], [79, 0.46], [84, 0.56]].forEach(([m, t]) => {
          tone({ type: 'square', f: N(m), dur: 0.16, vol: 0.06, at: t, lowpass: 3000 });
          tone({ type: 'triangle', f: N(m - 12), dur: 0.18, vol: 0.1, at: t });
        }),
      gameover: () =>
        [67, 66, 65, 64].forEach((m, i) =>
          tone({
            type: 'sawtooth',
            f: N(m - 12),
            dur: i === 3 ? 0.75 : 0.28,
            vol: 0.08,
            at: i * 0.3,
            lowpass: 1200,
            vib: i === 3 ? { rate: 6, depth: 4 } : null,
          })
        ),
      hit: () => {
        noise({ type: 'lowpass', f: 1800, dur: 0.25, vol: 0.3 });
        tone({ type: 'square', f: 220, to: 55, dur: 0.35, vol: 0.12, lowpass: 1200 });
      },
      whoosh: () => noise({ f: 700, to: 2600, dur: 0.18, vol: 0.07, q: 2 }),
      boo: () => tone({ type: 'sine', f: 330, to: 220, dur: 1.1, vol: 0.18, attack: 0.15, vib: { rate: 5, depth: 25 } }),
      whistle: () => {
        tone({ type: 'square', f: 2300, dur: 0.18, vol: 0.06, lowpass: 4000, vib: { rate: 40, depth: 120 } });
        tone({ type: 'square', f: 2300, dur: 0.45, vol: 0.06, at: 0.22, lowpass: 4000, vib: { rate: 40, depth: 120 } });
      },
      step: () => noise({ type: 'lowpass', f: 500, dur: 0.06, vol: 0.12 }),
      heart: () => {
        tone({ type: 'sine', f: 70, to: 45, dur: 0.12, vol: 0.4 });
        tone({ type: 'sine', f: 65, to: 42, dur: 0.12, vol: 0.3, at: 0.18 });
      },
      // 드르륵: 미닫이문 여는 소리
      slide: () => {
        noise({ f: 420, to: 260, dur: 0.5, vol: 0.13, q: 3 });
        tone({ type: 'sawtooth', f: 70, to: 58, dur: 0.45, vol: 0.04, lowpass: 400, vib: { rate: 30, depth: 8 } });
      },
      // 철컹! 쇠문이 닫히는 소리
      clang: () => {
        tone({ type: 'square', f: 196, to: 180, dur: 0.9, vol: 0.06, lowpass: 2200 });
        tone({ type: 'triangle', f: 523, dur: 1.4, vol: 0.07 });
        tone({ type: 'triangle', f: 847, dur: 1.0, vol: 0.045 });
        noise({ f: 2600, to: 700, dur: 0.3, vol: 0.14, q: 1 });
      },
      creak: () => tone({ type: 'sawtooth', f: 180, to: 320, dur: 0.35, vol: 0.05, lowpass: 900, vib: { rate: 18, depth: 20 } }),
      unlock: () => {
        noise({ type: 'highpass', f: 3000, dur: 0.05, vol: 0.15 });
        tone({ type: 'triangle', f: 880, dur: 0.08, vol: 0.12, at: 0.06 });
        tone({ type: 'triangle', f: 1320, dur: 0.12, vol: 0.12, at: 0.13 });
      },
      wrong: () => tone({ type: 'square', f: 160, dur: 0.25, vol: 0.08, lowpass: 900 }),
    };

    /* 배경음: 16분음표 단위로 조금씩 앞서 예약합니다. */
    let song = null;
    let timer = null;
    let step = 0;
    let next = 0;
    let tempo = 1;
    const music = {
      N,
      tone: (o) => tone(Object.assign({ bus: musicBus }, o)),
      noise: (o) => noise(Object.assign({ bus: musicBus }, o)),
    };

    function pump() {
      if (!ctx || !song || muted) return;
      const stepDur = 60 / (song.bpm * tempo) / 4;
      if (next < ctx.currentTime - 0.1) next = ctx.currentTime + 0.05; // 탭을 다녀오면 밀린 음은 버립니다
      while (next < ctx.currentTime + 0.15) {
        song.play(step, next, stepDur, music);
        step++;
        next += stepDur;
      }
    }

    function startTimer() {
      if (timer || !song || muted) return;
      const c = ensure();
      if (!c) return;
      next = c.currentTime + 0.08;
      timer = setInterval(pump, 30);
    }

    function stopTimer() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    return {
      /** 음 하나 (midi 번호) */
      note(midi, dur, type) {
        tone({ type: type || 'triangle', f: N(midi), dur: dur || 0.4, vol: 0.18 });
        tone({ type: 'sine', f: N(midi + 12), dur: (dur || 0.4) * 0.6, vol: 0.04 });
      },
      play(name, opts) {
        if (muted || !SFX[name]) return;
        sfxScale = opts && opts.vol != null ? opts.vol : 1;
        sfxPan = (opts && opts.pan) || 0;
        try {
          SFX[name]();
        } catch (e) {
          /* 소리가 안 나도 게임은 계속됩니다 */
        } finally {
          sfxScale = 1;
          sfxPan = 0;
        }
      },
      /** 같은 크기로 이어지는 삐- 소리 (모스 부호) */
      beep(dur, f) {
        if (muted) return;
        tone({ type: 'sine', f: f || 800, dur, vol: 0.22, attack: 0.008, hold: true });
      },
      music(newSong) {
        stopTimer();
        song = newSong;
        step = 0;
        tempo = 1;
        startTimer();
      },
      stopMusic() {
        stopTimer();
        song = null;
      },
      pauseMusic() {
        stopTimer();
      },
      resumeMusic() {
        startTimer();
      },
      setTempo(x) {
        tempo = x;
      },
      get muted() {
        return muted;
      },
      setMuted(m) {
        muted = !!m;
        HG.store.set('muted', muted);
        if (master) master.gain.value = muted ? 0 : 0.9;
        if (muted) stopTimer();
        else startTimer();
        listeners.forEach((fn) => fn(muted));
      },
      toggle() {
        this.setMuted(!muted);
      },
      onChange(fn) {
        listeners.push(fn);
      },
    };
  })();

  /* ---------------- 버튼 도우미 ---------------- */
  HG.bindMuteButton = function (btn) {
    const paint = (m) => {
      btn.textContent = m ? '🔇' : '🔊';
      btn.setAttribute('aria-label', m ? '소리 켜기' : '소리 끄기');
      btn.title = m ? '소리 켜기 (M)' : '소리 끄기 (M)';
    };
    paint(HG.sound.muted);
    HG.sound.onChange(paint);
    btn.addEventListener('click', () => {
      HG.sound.toggle();
      btn.blur();
    });
  };

  HG.bindFullscreenButton = function (btn, target) {
    const el = target || document.documentElement;
    if (!document.fullscreenEnabled || !el.requestFullscreen) {
      btn.hidden = true;
      return;
    }
    btn.addEventListener('click', () => {
      btn.blur();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else el.requestFullscreen().catch(() => {});
    });
  };

  /* ---------------- 화면 맞춤 ----------------
     W×H 가상 화면을 area 안에 비율 그대로 최대한 크게 놓습니다. */
  HG.fitStage = function (area, stage, canvas, W, H) {
    const ctx = canvas.getContext('2d');
    const view = { ctx, W, H, scale: 1, dpr: 1 };

    function resize() {
      const r = area.getBoundingClientRect();
      const scale = Math.max(0.1, Math.min(r.width / W, r.height / H));
      const cssW = Math.max(1, Math.floor(W * scale));
      const cssH = Math.max(1, Math.floor(H * scale));
      stage.style.width = cssW + 'px';
      stage.style.height = cssH + 'px';
      stage.style.fontSize = Math.max(9, 16 * scale).toFixed(2) + 'px';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      view.scale = cssW / W;
      view.dpr = dpr;
    }

    view.begin = function () {
      ctx.setTransform(view.scale * view.dpr, 0, 0, view.scale * view.dpr, 0, 0);
    };
    view.toLocal = function (clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
    };
    view.resize = resize;

    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(area);
    resize();
    return view;
  };

  /* ---------------- 게임 루프 ----------------
     update(dt)는 1/120초마다 같은 간격으로, render()는 화면마다 한 번. */
  HG.loop = function (update, render, hz) {
    const dt = 1 / (hz || 120);
    let acc = 0;
    let last = performance.now();
    function frame(now) {
      let elapsed = (now - last) / 1000;
      last = now;
      if (elapsed > 0.1) elapsed = 0.1;
      if (elapsed < 0) elapsed = 0;
      acc += elapsed;
      let steps = 0;
      while (acc >= dt && steps < 24) {
        update(dt);
        acc -= dt;
        steps++;
      }
      render(elapsed);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  /* ---------------- 캔버스 글자 ---------------- */
  HG.FONT_UI = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  HG.FONT_DISPLAY = '"Kirang Haerang", "Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

  HG.text = function (ctx, str, x, y, o) {
    o = o || {};
    ctx.font = (o.size || 20) + 'px ' + (o.font || HG.FONT_UI);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.baseline || 'middle';
    if (o.stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.strokeWidth || 4;
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || '#f6f1ff';
    ctx.fillText(str, x, y);
  };

  // 캔버스가 웹폰트를 쓰려면 미리 불러 두어야 합니다.
  if (document.fonts && document.fonts.load) {
    document.fonts.load('20px "Jua"').catch(() => {});
    document.fonts.load('20px "Kirang Haerang"').catch(() => {});
  }

  /** 게임 키가 입력창 글자 입력을 방해하지 않게 합니다. */
  HG.isTyping = function (e) {
    const t = e.target;
    return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
  };

  HG.formatNumber = (n) => Math.round(n).toLocaleString('ko-KR');
})();
