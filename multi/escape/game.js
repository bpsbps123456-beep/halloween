/* 동암초 탈출 — 진행, 방 수수께끼, 복도 몰래 지나가기, 현관 탈출 */
(function () {
  'use strict';

  const E = window.EscapeCore;
  const SC = window.EscapeScenes;
  const W = 960;
  const H = 540;
  const GAME = 'escape';
  const SAVE = 'escape:run';
  const SETTINGS = 'escape:settings';
  const ROUTE = E.route();

  const $ = (id) => document.getElementById(id);
  const canvas = $('scene');
  const view = HG.fitStage($('stageArea'), $('stage'), canvas, W, H);
  const ctx = view.ctx;
  const puzzle = $('puzzle');

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (tag === 'button') n.type = 'button';
    return n;
  }

  /* ---------------- 선생님 설정: 주소(#t-…)가 먼저, 없으면 이 기기에 저장된 것 ---------------- */
  function linkSettings() {
    const m = /^#t-([A-Za-z0-9_-]+)$/.exec(location.hash);
    return m ? E.decodeSettings(m[1]) : null;
  }
  let settings = linkSettings() || E.normalizeSettings(HG.store.get(SETTINGS, null));
  const shortName = (s) => s.replace('초등학교', '초');

  /* ---------------- 상태 ---------------- */
  const game = {
    mode: 'title', // title | play | done
    view: 'title', // 그림: title | map | room | hall | exit | outside
    run: null,
    team: '1모둠',
    seed: 0,
    stage: 0,
    startedAt: 0,
    penalty: 0,
    hints: 0,
    caught: 0,
    finalTime: 0,
    t: 0,
    sub: null, // 지금 단계의 방·복도·현관
    paused: false,
    roomHints: 0,
    sparks: [],
  };

  const elapsed = () => (game.mode === 'done' ? game.finalTime : (Date.now() - game.startedAt) / 1000 + game.penalty);

  function save() {
    if (game.mode !== 'play') return;
    HG.store.set(SAVE, {
      v: 1,
      seed: game.seed,
      team: game.team,
      settings,
      startedAt: game.startedAt,
      penalty: game.penalty,
      hints: game.hints,
      caught: game.caught,
      stage: game.stage,
      at: Date.now(),
    });
  }
  function loadSave() {
    const s = HG.store.get(SAVE, null);
    if (!s || s.v !== 1 || typeof s.stage !== 'number' || Date.now() - s.at > 3 * 3600 * 1000) return null;
    return s;
  }

  /* ---------------- 화면 전환 ---------------- */
  const overlays = ['titleScreen', 'mapScreen', 'rewardScreen', 'noteScreen', 'caughtScreen', 'resultScreen', 'boardScreen', 'teacherScreen'];
  function showOverlay(id) {
    overlays.forEach((o) => ($(o).hidden = o !== id));
    game.paused = !!id && id !== 'titleScreen' && id !== 'caughtScreen';
  }
  function blurActive() {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }

  const places = () => game.run.steps.map((s) => s.place).concat([E.EXIT.place]);
  const roomsDone = () => ROUTE.slice(0, game.stage).filter((r) => r.kind === 'room').length;
  function where(place) {
    const at = E.locate(place);
    return at ? E.BUILDINGS[at.building].name + ' ' + at.floor + '층 ' + place : place;
  }

  let mapDone = null;
  function showMap(title, text, button, then) {
    game.view = 'map';
    $('mapTitle').textContent = title;
    $('mapText').textContent = text;
    $('mapGo').textContent = button;
    mapDone = then;
    $('hud').hidden = game.mode !== 'play';
    $('roomScreen').hidden = true;
    $('hallScreen').hidden = true;
    showOverlay('mapScreen');
    $('mapGo').focus();
  }
  $('mapGo').addEventListener('click', () => {
    const then = mapDone;
    mapDone = null;
    showOverlay(null);
    blurActive();
    if (then) then();
  });
  $('mapBtn').addEventListener('click', () => {
    $('mapBtn').blur();
    if (game.mode !== 'play' || mapDone) return;
    const back = game.view;
    showMap('학교 지도 · 대피 안내도', '빨간 화살표가 탈출 경로예요. 숫자는 지나갈 차례!', '닫기', () => {
      game.view = back;
      if (back === 'room' || back === 'exit') $('roomScreen').hidden = false;
      if (back === 'hall') $('hallScreen').hidden = false;
    });
  });

  /* ---------------- 유령 '부'의 말풍선 ---------------- */
  let bubbleTimer = 0;
  function say(text, ms) {
    const b = $('bubble');
    b.textContent = '👻 ' + text;
    b.hidden = false;
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => (b.hidden = true), ms || 4200);
  }

  /* ---------------- 시작 / 이어하기 ---------------- */
  function paintTitle() {
    $('titleName').textContent = shortName(settings.school) + ' 탈출';
    document.querySelector('.game-bar h1').firstChild.textContent = shortName(settings.school) + ' 탈출';
    $('titleStory').textContent =
      '할로윈 밤, ' + settings.myClass + ' 교실에서 깜빡 잠들었다 깨어 보니 학교 문이 모두 잠겼어요! 장난꾸러기 유령 ‘부’가 교실마다 숫자를 숨겨 두었대요. ' +
      '복도를 순찰하는 경비 아저씨를 피해 수수께끼를 풀고, 숫자를 모아 중앙 현관 자물쇠를 열어요.';
    const saved = loadSave();
    const rb = $('resumeBtn');
    rb.hidden = !saved;
    if (saved) {
      const st = ROUTE[saved.stage];
      const label = st.kind === 'hall' ? '복도' : st.kind === 'exit' ? E.EXIT.place : E.STEPS.find((s) => s.id === st.id).place || E.normalizeSettings(saved.settings).myClass;
      rb.textContent = '이어서 하기 (' + saved.team + ' · ' + label + ')';
    }
  }

  function goTitle() {
    stopSub();
    HG.sound.stopMusic();
    game.mode = 'title';
    game.view = 'title';
    $('hud').hidden = true;
    $('mapBtn').hidden = true;
    $('roomScreen').hidden = true;
    $('hallScreen').hidden = true;
    paintTitle();
    showOverlay('titleScreen');
  }

  function begin(team, seed, from) {
    game.sparks.length = 0;
    game.team = team;
    game.seed = seed;
    game.run = E.createRun(seed, settings);
    game.mode = 'play';
    $('hudTeam').textContent = team;
    $('mapBtn').hidden = false;
    HG.sound.play('start');
    if (from) {
      game.startedAt = from.startedAt;
      game.penalty = from.penalty;
      game.hints = from.hints;
      game.caught = from.caught;
      enterStage(from.stage);
      return;
    }
    game.startedAt = Date.now();
    game.penalty = 0;
    game.hints = 0;
    game.caught = 0;
    game.stage = 0;
    save();
    showMap('탈출 경로', settings.myClass + ' 교실에서 시작해 ' + where(E.EXIT.place) + '으로 탈출해요. 대피 안내도처럼 빨간 화살표를 따라가요!', '출발!', () => enterStage(0));
  }

  $('teamForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const team = $('teamInput').value.trim() || '1모둠';
    HG.store.set('escape:team', team);
    blurActive();
    begin(team, (Math.random() * 1e9) | 0);
  });
  $('resumeBtn').addEventListener('click', () => {
    const s = loadSave();
    if (!s) return goTitle();
    settings = E.normalizeSettings(s.settings);
    blurActive();
    begin(s.team, s.seed, s);
  });

  /* ---------------- 단계 진행 ---------------- */
  function stopSub() {
    if (game.sub && game.sub.destroy) game.sub.destroy();
    game.sub = null;
    puzzle.textContent = '';
    $('bubble').hidden = true;
  }

  function enterStage(i) {
    stopSub();
    game.stage = i;
    save();
    const st = ROUTE[i];
    if (st.kind === 'room') startRoom(st.id);
    else if (st.kind === 'hall') {
      const def = E.HALLS.find((d) => d.id === st.id);
      const next = ROUTE[i + 1];
      const nextPlace = next.kind === 'room' ? game.run.steps.find((s) => s.id === next.id).place : E.EXIT.place;
      HG.sound.pauseMusic();
      showMap('다음 목적지: ' + where(nextPlace), def.intro, '복도로 나가기', () => startHall(def));
    } else startExit();
  }

  function nextStage() {
    enterStage(game.stage + 1);
  }

  /* ---------------- 방 공통 ---------------- */
  const HINTS_PER_ROOM = 2;
  function paintHintBtn() {
    const left = HINTS_PER_ROOM - game.roomHints;
    const b = $('hintBtn');
    b.textContent = left > 0 ? '💡 힌트 (+30초) · ' + left + '번 남음' : '💡 힌트를 다 썼어요';
    b.disabled = left <= 0;
  }
  $('hintBtn').addEventListener('click', () => {
    $('hintBtn').blur();
    if (!game.sub || !game.sub.hint || game.roomHints >= HINTS_PER_ROOM) return;
    game.roomHints++;
    game.hints++;
    game.penalty += E.HINT_PENALTY;
    save();
    HG.sound.play('boo');
    say(game.sub.hint(game.roomHints), 7000);
    paintHintBtn();
  });

  function openRoomScreen(where2, title, goal) {
    $('roomWhere').textContent = where2;
    $('roomTitle').textContent = title;
    $('roomGoal').textContent = goal;
    $('roomScreen').hidden = false;
    $('hallScreen').hidden = true;
    $('hud').hidden = false;
    game.roomHints = 0;
    paintHintBtn();
  }

  function startRoom(id) {
    const step = game.run.steps.find((s) => s.id === id);
    game.view = 'room';
    showOverlay(null);
    openRoomScreen(where(step.place), step.icon + ' ' + step.title, step.goal);
    $('hudPlace').textContent = step.place;
    HG.sound.music(SONG);
    game.sub = ROOMS[id](step);
  }

  function solved(step) {
    if (!game.sub || game.sub.solved) return;
    game.sub.solved = true;
    $('hintBtn').disabled = true;
    HG.sound.play('clear');
    const digit = game.run.digits[step.id];
    setTimeout(() => {
      if (!game.sub) return;
      $('rewardTitle').textContent = step.place + ' 통과!';
      $('rewardDigit').textContent = String(digit);
      $('rewardNote').textContent = '📒 숫자 수첩의 ' + step.icon + ' 칸에 적어 두었어요';
      showOverlay('rewardScreen');
      $('rewardNext').focus();
    }, 900);
  }
  $('rewardNext').addEventListener('click', () => {
    showOverlay(null);
    blurActive();
    nextStage();
  });

  /* ---------------- 방 1: 교실 숨은 호박 ---------------- */
  const ROOMS = {};
  ROOMS.classroom = (step) => {
    const spots = game.run.puzzles.classroom.spots;
    const st = { spots, found: new Set(), flash: 0, digit: null, school: game.run.school, myClass: game.run.myClass };
    const chip = el('div', 'chip-big', '🎃 0 / ' + spots.length + ' · 호박을 눌러요');
    puzzle.append(chip);
    say('교실에 호박 ' + spots.length + '개가 숨어 있어. 다 찾으면 칠판에 숫자가 나타날 거야!');
    return {
      draw: (t) => SC.classroom(ctx, t, st),
      step: (dt) => {
        if (st.flash > 0) st.flash -= dt;
      },
      tap(x, y) {
        if (st.digit != null) return;
        for (const i of spots) {
          const sp = E.SPOTS[i];
          if (!st.found.has(i) && Math.hypot(sp.x - x, sp.y - y) < 34) {
            st.found.add(i);
            HG.sound.play('candy');
            chip.textContent = '🎃 ' + st.found.size + ' / ' + spots.length;
            if (st.found.size === spots.length) {
              st.digit = game.run.digits.classroom;
              say('칠판에 숫자가 나타났어!');
              solved(step);
            }
            return;
          }
        }
      },
      hint(level) {
        const left = spots.filter((i) => !st.found.has(i)).map((i) => E.SPOTS[i].area);
        if (level === 1) return '아직 못 찾은 호박은 ' + left.join(', ') + ' 쪽에 있어!';
        st.flash = 3;
        return '반짝이는 동그라미를 잘 봐!';
      },
    };
  };

  /* ---------------- 방 2: 과학실 마녀의 물약 ---------------- */
  const RECIPE = { 보라: '빨강 + 파랑', 초록: '노랑 + 파랑', 주황: '빨강 + 노랑', 갈색: '빨강 + 파랑 + 노랑' };
  ROOMS.science = (step) => {
    const targets = game.run.puzzles.science.targets;
    let k = 0;
    const st = { target: targets[0], selected: [], cauldron: null, puff: 0 };
    const chip = el('div', 'chip-big');
    const paint = () => (chip.textContent = '🧪 ' + k + ' / ' + targets.length + ' · 고른 병: ' + (st.selected.join(', ') || '없음'));
    SC.BOTTLES.forEach((b) => {
      const btn = el('button', 'bottle-btn');
      btn.style.left = (b.x - 35) / 16 + 'em';
      btn.style.top = 238 / 16 + 'em';
      btn.setAttribute('aria-label', b.color + ' 물약 고르기');
      btn.addEventListener('click', () => {
        const i = st.selected.indexOf(b.color);
        if (i >= 0) st.selected.splice(i, 1);
        else st.selected.push(b.color);
        HG.sound.play('click');
        paint();
      });
      puzzle.append(btn);
    });
    const pour = el('button', 'btn pour-btn', '🫕 솥에 붓기');
    pour.style.left = 16.1 + 'em';
    pour.style.top = 24.6 + 'em';
    pour.addEventListener('click', () => {
      if (!st.target) return;
      if (st.selected.length < 2) {
        HG.sound.play('wrong');
        say('물약을 두 병 이상 골라야 해!');
        return;
      }
      const result = E.mix(st.selected);
      st.selected = [];
      st.cauldron = result;
      if (result && result === st.target) {
        k++;
        HG.sound.play('gold');
        if (k === targets.length) {
          st.target = null;
          say('물약 완성! 숫자 카드가 솥에서 떠올랐어!');
          solved(step);
        } else {
          st.target = targets[k];
          say('성공! 이번엔 ' + st.target + ' 물약을 만들어 봐.');
        }
      } else {
        st.puff = 1;
        HG.sound.play('wrong');
        say((result ? result + ' 물약이 됐어.' : '펑!') + ' 다시 해 보자.');
        setTimeout(() => {
          if (st.target) st.cauldron = null;
        }, 900);
      }
      paint();
    });
    puzzle.append(pour, chip);
    paint();
    say('칠판에 적힌 색을 만들려면 어떤 물약을 섞어야 할까?');
    return {
      draw: (t) => SC.science(ctx, t, st),
      step: (dt) => {
        if (st.puff > 0) st.puff = Math.max(0, st.puff - dt * 1.4);
      },
      hint(level) {
        if (level === 1) return '미술 시간 물감 섞기를 떠올려 봐. 세 가지 색을 모두 섞으면 어두운 색이 돼!';
        return st.target ? st.target + ' 물약은 ' + RECIPE[st.target] + '!' : '이미 다 만들었어!';
      },
    };
  };

  /* ---------------- 방 3: 도서관 초성 책장 ---------------- */
  ROOMS.library = (step) => {
    const words = game.run.puzzles.library.words;
    let k = 0;
    let picked = [];
    let picture = false;
    const card = el('div', 'card');
    puzzle.append(card);
    function render() {
      const w = words[k];
      card.textContent = '';
      card.append(el('p', 'step', '책 ' + (k + 1) + ' / ' + words.length));
      card.append(el('p', 'cho', w.cho));
      if (picture) card.append(el('p', 'picture', w.emoji));
      const slots = el('div', 'slots');
      Array.from(w.word).forEach((_, i) => {
        const s = el('button', 'slot', picked[i] ? picked[i].ch : '');
        s.setAttribute('aria-label', i + 1 + '번째 글자 칸');
        s.addEventListener('click', () => {
          if (!picked[i]) return;
          picked = picked.slice(0, i);
          render();
        });
        slots.append(s);
      });
      card.append(slots);
      const tiles = el('div', 'tiles');
      w.tiles.forEach((ch, idx) => {
        const tb = el('button', 'tile', ch);
        tb.disabled = picked.some((p) => p.idx === idx);
        tb.addEventListener('click', () => pick(ch, idx));
        tiles.append(tb);
      });
      card.append(tiles);
    }
    function pick(ch, idx) {
      const w = words[k];
      picked.push({ ch, idx });
      HG.sound.play('click');
      if (picked.length < w.word.length) return render();
      if (picked.map((p) => p.ch).join('') === w.word) {
        HG.sound.play('candy');
        k++;
        picked = [];
        picture = false;
        if (k === words.length) {
          card.textContent = '';
          card.append(el('p', 'cho', '📚 다 맞혔어요!'));
          say('책장 뒤에서 숫자 카드가 나왔어!');
          solved(step);
          return;
        }
        say('딩동댕! 다음 책도 풀어 보자.');
        render();
      } else {
        HG.sound.play('wrong');
        render();
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        setTimeout(() => {
          picked = [];
          render();
        }, 500);
      }
    }
    render();
    say('초성(첫 자음)을 보고 낱말을 떠올려 봐. 할로윈, 학교, 안전에 관한 말이야!');
    return {
      draw: (t) => SC.library(ctx, t),
      hint(level) {
        const w = words[k];
        if (!w) return '이미 다 풀었어!';
        if (level === 1) {
          picture = true;
          render();
          return '그림 힌트를 보여 줄게: ' + w.emoji;
        }
        const first = Array.from(w.word)[0];
        picked = [{ ch: first, idx: w.tiles.indexOf(first) }];
        render();
        return '첫 글자는 「' + first + '」야!';
      },
    };
  };

  /* ---------------- 방 4: 방송실 유령 방송 ---------------- */
  ROOMS.broadcast = (step) => {
    const { seq, rounds } = game.run.puzzles.broadcast;
    let r = 0;
    let pos = 0;
    let playing = true;
    let slow = 1;
    const timers = [];
    const st = { onAir: false };
    const card = el('div', 'card');
    const stepLine = el('p', 'step');
    const status = el('p', 'q', '잘 보고 들어요…');
    const pads = el('div', 'pads');
    const buttons = E.PADS.map((p, i) => {
      const b = el('button', 'pad');
      b.style.background = p.color;
      b.append(el('span', null, p.icon), document.createTextNode(p.name));
      b.setAttribute('aria-label', p.name + ' 버튼');
      b.addEventListener('click', () => press(i));
      pads.append(b);
      return b;
    });
    const again = el('button', 'btn btn-quiet', '🔁 다시 듣기');
    again.addEventListener('click', () => !playing && play());
    card.append(stepLine, status, pads, again);
    puzzle.append(card);
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    function light(i) {
      const b = buttons[i];
      b.classList.add('lit');
      HG.sound.note(E.PADS[i].midi, 0.35);
      later(() => b.classList.remove('lit'), 260 * slow);
    }
    function play() {
      playing = true;
      pos = 0;
      st.onAir = true;
      stepLine.textContent = '라운드 ' + (r + 1) + ' / ' + rounds.length + ' · 버튼 ' + rounds[r] + '개';
      status.textContent = '👻 유령이 방송 버튼을 눌러요. 잘 보고 들어요!';
      buttons.forEach((b) => (b.disabled = true));
      for (let i = 0; i < rounds[r]; i++) later(() => light(seq[i]), (500 + i * 620) * slow);
      later(() => {
        playing = false;
        st.onAir = false;
        buttons.forEach((b) => (b.disabled = false));
        status.textContent = '이제 똑같은 차례로 눌러요!';
      }, (500 + rounds[r] * 620) * slow);
    }
    function press(i) {
      if (playing) return;
      light(i);
      if (i !== seq[pos]) {
        HG.sound.play('wrong');
        status.textContent = '삐-! 순서가 달라요. 다시 들려줄게요.';
        playing = true;
        later(play, 1100);
        return;
      }
      pos++;
      if (pos < rounds[r]) return;
      r++;
      if (r === rounds.length) {
        playing = true;
        status.textContent = '📢 방송 성공!';
        buttons.forEach((b) => (b.disabled = true));
        say('방송실 스피커에서 숫자가 들렸어!');
        solved(step);
        return;
      }
      HG.sound.play('candy');
      status.textContent = '좋아요! 다음 라운드는 하나 더 길어요.';
      playing = true;
      later(play, 1100);
    }
    later(play, 900);
    say('유령이 누른 버튼을 기억해서 똑같이 눌러야 해. 모둠 친구들과 나눠서 외워 봐!');
    return {
      draw: (t) => SC.broadcast(ctx, t, st),
      destroy: () => timers.forEach(clearTimeout),
      hint(level) {
        if (level === 1) {
          slow = 1.6;
          if (!playing) play();
          return '이제 천천히 들려줄게. 이름을 소리 내어 말하면서 외워 봐!';
        }
        const icons = seq.slice(0, rounds[Math.min(r, rounds.length - 1)]).map((i) => E.PADS[i].icon);
        return '이번 라운드 순서: ' + icons.join(' → ');
      },
    };
  };

  /* ---------------- 방 5: 교무실 우리 학교 퀴즈 ---------------- */
  ROOMS.office = (step) => {
    const quiz = game.run.puzzles.office;
    const qs = quiz.questions;
    let k = 0;
    const card = el('div', 'card');
    puzzle.append(card);
    let out = new Set();
    function next() {
      HG.sound.play('candy');
      k++;
      out = new Set();
      if (k === qs.length) {
        card.textContent = '';
        card.append(el('p', 'cho', '📝 다 맞혔어요!'));
        say('교무실 서랍에서 숫자 카드를 찾았어!');
        solved(step);
        return;
      }
      render();
    }
    function wrongAnswer() {
      HG.sound.play('wrong');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
      say('땡! 다시 생각해 보자.');
    }
    function render() {
      const q = qs[k];
      card.textContent = '';
      card.append(el('p', 'step', '문제 ' + (k + 1) + ' / ' + qs.length), el('p', 'q', q.q));
      if (!quiz.custom) {
        const box = el('div', 'options');
        q.options.forEach((opt, i) => {
          const b = el('button', 'option' + (out.has(i) ? ' out' : ''), opt);
          b.disabled = out.has(i);
          b.addEventListener('click', () => {
            if (i === q.a) next();
            else {
              out.add(i);
              wrongAnswer();
              render();
            }
          });
          box.append(b);
        });
        card.append(box);
      } else {
        const row = el('form', 'answer-row');
        const input = el('input');
        input.maxLength = 40;
        input.placeholder = '답을 써요';
        input.setAttribute('aria-label', '답');
        const ok = el('button', 'btn', '확인');
        ok.type = 'submit';
        row.append(input, ok);
        row.addEventListener('submit', (e) => {
          e.preventDefault();
          if (E.checkAnswer(input.value, q.a)) next();
          else wrongAnswer();
        });
        card.append(row);
      }
    }
    render();
    say(quiz.custom ? '선생님이 낸 우리 학교 문제야!' : '대피 안내도를 떠올려 봐. 우리 학교 이야기야!');
    return {
      draw: (t) => SC.office(ctx, t),
      hint(level) {
        const q = qs[k];
        if (!q) return '이미 다 풀었어!';
        if (quiz.custom) {
          const ans = String(q.a).split(/[,，/]/)[0].trim();
          return level === 1 ? '첫 글자는 「' + Array.from(ans)[0] + '」야.' : '정답은 「' + ans + '」!';
        }
        if (level === 1) {
          const wrong = q.options.map((_, i) => i).filter((i) => i !== q.a && !out.has(i));
          if (wrong.length) out.add(wrong[0]);
          render();
          return '틀린 답 하나를 지워 줄게!';
        }
        return '정답은 「' + q.options[q.a] + '」!';
      },
    };
  };

  /* ---------------- 방 6: 보건실 약상자 ---------------- */
  ROOMS.nurse = (step) => {
    const { a, b, c } = game.run.puzzles.nurse;
    let entry = '';
    const card = el('div', 'card');
    const eqs = el('div', 'eqs');
    eqs.append(
      el('p', null, '🩹 + 🩹 + 🩹 = ' + 3 * a),
      el('p', null, '🩹 × 💊 = ' + a * b),
      el('p', null, '💊 + 🌡️ × 2 = ' + (b + 2 * c))
    );
    const ask = el('p', 'ask', '🌡️ = ?');
    eqs.append(ask);
    const pad = el('div', 'numpad');
    const paint = () => (ask.textContent = '🌡️ = ' + (entry || '?'));
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach((d) => {
      const n = el('button', 'num', d);
      n.addEventListener('click', () => {
        entry = (entry + d).slice(-2);
        HG.sound.play('click');
        paint();
      });
      pad.append(n);
    });
    const del = el('button', 'btn btn-quiet', '⌫ 지우기');
    del.addEventListener('click', () => {
      entry = '';
      paint();
    });
    const ok = el('button', 'btn', '확인');
    ok.addEventListener('click', () => {
      if (Number(entry) === c) {
        say('정답! 약상자가 열렸어!');
        ask.textContent = '🌡️ = ' + c + ' ✓';
        solved(step);
      } else {
        HG.sound.play('wrong');
        entry = '';
        paint();
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        say('땡! 곱셈을 먼저 했는지 확인해 봐.');
      }
    });
    const row = el('div', 'row');
    row.append(del, ok);
    card.append(el('p', 'step', '약상자 자물쇠 메모'), eqs, pad, row);
    puzzle.append(card);
    say('그림 하나하나가 숫자야. 곱셈이 섞여 있으니 조심!');
    return {
      draw: (t) => SC.nurse(ctx, t),
      hint(level) {
        if (level === 1) return '곱셈(×)은 덧셈(+)보다 먼저 계산해! 첫 줄에서 🩹 하나가 몇인지 먼저 구해 봐.';
        return '🩹 = ' + a + ', 💊 = ' + b + ' 이야!';
      },
    };
  };

  /* ---------------- 복도: 경비원 피해 몰래 가기 ---------------- */
  const hallInput = { left: false, right: false, hide: false };
  function startHall(def) {
    game.view = 'hall';
    showOverlay(null);
    $('roomScreen').hidden = true;
    $('hallScreen').hidden = false;
    $('hud').hidden = false;
    const at = E.BUILDINGS[def.building].name + ' ' + def.floor + '층 복도';
    $('hudPlace').textContent = at;
    $('hallBubble').textContent = '👻 ' + def.intro;
    hallInput.left = hallInput.right = hallInput.hide = false;
    const h = E.createHall(def, game.seed + game.stage * 7919);
    let heart = 0;
    let steps = 0;
    let caughtT = 0;
    const camFor = (x) => Math.min(Math.max(x - W / 2, 0), Math.max(0, h.length - W));
    let camX = camFor(h.player.x);
    game.sub = {
      hall: h,
      draw(t) {
        camX += (camFor(h.player.x) - camX) * 0.2;
        SC.hall(ctx, t, h, camX);
      },
      step(dt) {
        if (caughtT > 0) {
          caughtT -= dt;
          if (caughtT <= 0) {
            showOverlay(null);
            $('hallBubble').textContent = '👻 다시 해 보자! 손전등 불빛이 안 닿는 곳으로, 숨을 곳에서 숨을 곳으로!';
          }
          return;
        }
        const move = (hallInput.right ? 1 : 0) - (hallInput.left ? 1 : 0);
        E.stepHall(h, { move, hide: hallInput.hide }, dt);
        hallInput.hide = false;
        const hidden = h.player.hidden >= 0;
        $('hideBtn').setAttribute('aria-pressed', String(hidden));
        $('hideBtn').textContent = hidden ? '나가기' : '숨기';
        $('hideBtn').classList.toggle('far', !hidden && E.spotNear(h, h.player.x) < 0);
        for (const e of h.events) {
          if (e.type === 'spotted') {
            HG.sound.play('whistle');
            $('hallBubble').textContent = '👮 “거기 누구냐!” 빨리 숨어!';
          } else if (e.type === 'lost') {
            $('hallBubble').textContent = '👻 휴… 경비 아저씨가 놓쳤어!';
          } else if (e.type === 'enterRoom') {
            HG.sound.play('creak');
            $('hallBubble').textContent = '👻 경비 아저씨가 교실에 들어갔어! 지금이야!';
          } else if (e.type === 'exitRoom') {
            HG.sound.play('creak');
          } else if (e.type === 'look') {
            $('hallBubble').textContent = '👻 앗, 뒤를 돌아봤어! 조심!';
          } else if (e.type === 'hide' || e.type === 'unhide') {
            HG.sound.play('click');
          } else if (e.type === 'caught') {
            game.caught++;
            game.penalty += E.CAUGHT_PENALTY;
            save();
            HG.sound.play('hit');
            showOverlay('caughtScreen');
            caughtT = 1.8;
          } else if (e.type === 'goal') {
            HG.sound.play('unlock');
            nextStage();
            return;
          }
        }
        h.events.length = 0;
        // 가까이 오면 두근두근, 발소리
        const g = h.guard;
        const dist = Math.abs(g.x - h.player.x);
        const facing = Math.sign(h.player.x - g.x) === g.face;
        if (E.inCorridor(g) && dist < g.cone + 260 && (facing || g.state === 'chase')) {
          heart -= dt;
          if (heart <= 0) {
            HG.sound.play('heart');
            heart = 0.35 + (dist / (g.cone + 260)) * 0.6;
          }
        }
        if (E.inCorridor(g) && (g.state === 'walk' || g.state === 'chase') && dist < 700) {
          steps -= dt;
          if (steps <= 0) {
            HG.sound.play('step');
            steps = g.state === 'chase' ? 0.25 : 0.5;
          }
        }
      },
      destroy() {
        $('hallScreen').hidden = true;
      },
    };
  }

  function holdButton(btn, key) {
    const on = (e) => {
      e.preventDefault();
      hallInput[key] = true;
      btn.classList.add('on');
      if (btn.setPointerCapture) {
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (err) {
          /* 포인터 고정이 안 되는 브라우저도 있어요 */
        }
      }
    };
    const off = () => {
      hallInput[key] = false;
      btn.classList.remove('on');
    };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('lostpointercapture', off);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  holdButton($('leftBtn'), 'left');
  holdButton($('rightBtn'), 'right');
  $('hideBtn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hallInput.hide = true;
  });
  $('hideBtn').addEventListener('keydown', (e) => {
    if (e.code === 'Enter') hallInput.hide = true;
  });

  /* ---------------- 중앙 현관: 자물쇠 + 다 같이 문 밀기 ---------------- */
  function startExit() {
    game.view = 'exit';
    showOverlay(null);
    openRoomScreen(where(E.EXIT.place), '🚪 ' + E.EXIT.title, '숫자 수첩을 보고, 자물쇠 위 그림 순서대로 숫자를 맞춰요.');
    $('hudPlace').textContent = E.EXIT.place;
    HG.sound.music(SONG);
    const lockIds = game.run.lock;
    const values = lockIds.map(() => 0);
    const st = { open: 0, unlocked: false, shake: 0, push: 0, pushing: false, opening: false };
    const card = el('div', 'card');
    puzzle.append(card);
    const icon = (id) => game.run.steps.find((s) => s.id === id).icon;
    function renderLock() {
      card.textContent = '';
      card.append(el('p', 'step', '자물쇠 · ' + lockIds.length + '자리'));
      const lock = el('div', 'lock');
      lockIds.forEach((id, i) => {
        const d = el('div', 'dial');
        const up = el('button', null, '▲');
        const down = el('button', null, '▼');
        const num = el('div', 'digit', String(values[i]));
        up.setAttribute('aria-label', i + 1 + '번째 숫자 올리기');
        down.setAttribute('aria-label', i + 1 + '번째 숫자 내리기');
        up.addEventListener('click', () => {
          values[i] = (values[i] + 1) % 10;
          num.textContent = String(values[i]);
          HG.sound.play('tick');
        });
        down.addEventListener('click', () => {
          values[i] = (values[i] + 9) % 10;
          num.textContent = String(values[i]);
          HG.sound.play('tick');
        });
        d.append(el('span', 'icon', icon(id)), up, num, down);
        lock.append(d);
      });
      const open = el('button', 'btn', '🔓 열기');
      open.addEventListener('click', tryOpen);
      card.append(lock, open);
    }
    function tryOpen() {
      if (E.checkLock(game.run, values)) {
        st.unlocked = true;
        HG.sound.play('unlock');
        startPush();
      } else {
        HG.sound.play('wrong');
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        say('철컥… 숫자가 그림 순서와 맞지 않아. 수첩을 다시 봐!');
      }
    }
    let meter = null;
    function startPush() {
      st.pushing = true;
      $('hintBtn').disabled = true;
      card.textContent = '';
      card.append(el('p', 'q', '자물쇠가 풀렸어요! 그런데 문이 너무 무거워요…'), el('p', 'cho', '다 같이 문을 밀어요!'), el('p', 'step', '화면을 마구 두드려요! (컴퓨터는 Space)'));
      const m = el('div', 'meter');
      meter = el('i');
      m.append(meter);
      card.append(m);
      say('모둠 친구들 모두 손가락으로 화면을 두드려!');
    }
    renderLock();
    say('수첩의 숫자를 자물쇠 그림 순서대로 맞춰 봐!');
    game.sub = {
      draw: (t) => SC.entrance(ctx, t, st),
      push() {
        if (!st.pushing || st.opening) return;
        st.push = Math.min(1, st.push + 0.075);
        st.shake = 1;
        HG.sound.play('step');
      },
      step(dt) {
        if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 3);
        if (st.pushing && !st.opening) {
          st.push = Math.max(0, st.push - dt * 0.22);
          if (meter) meter.style.width = st.push * 100 + '%';
          if (st.push >= 1) {
            st.opening = true;
            HG.sound.play('creak');
            card.hidden = true;
          }
        }
        if (st.opening) {
          st.open = Math.min(1, st.open + dt * 0.8);
          if (st.open >= 1 && game.mode === 'play') finish();
        }
      },
      hint(level) {
        if (level === 1) return '수첩의 숫자를, 자물쇠 위에 놓인 그림 순서대로 맞춰. 그림이 같은 방 숫자야!';
        lockIds.slice(0, 3).forEach((id, i) => (values[i] = game.run.digits[id]));
        renderLock();
        return '앞의 세 자리는 맞춰 줬어!';
      },
    };
  }

  /* ---------------- 탈출 성공 ---------------- */
  const boardFormat = (row) => E.formatTime(row.score) + (row.hints ? ' · 💡' + row.hints : '') + (row.caught ? ' · 👮' + row.caught : '');

  function finish() {
    game.finalTime = Math.round(elapsed() * 10) / 10;
    game.mode = 'done';
    HG.store.set(SAVE, null);
    stopSub();
    HG.sound.stopMusic();
    HG.sound.play('clear');
    game.view = 'outside';
    $('roomScreen').hidden = true;
    $('mapBtn').hidden = true;
    $('resultTitle').textContent = game.team + ' 탈출 성공!';
    $('resultTime').textContent = E.formatTime(game.finalTime);
    const stats = $('resultStats');
    stats.textContent = '';
    [
      ['힌트', game.hints + '번'],
      ['경비원에게 잡힘', game.caught + '번'],
      ['더해진 시간', E.formatTime(game.penalty)],
    ].forEach(([k, v]) => {
      const span = el('span');
      const b = el('b', null, v);
      span.append(k + ' ', b);
      stats.append(span);
    });
    HG.best.submit(GAME, game.finalTime, true);
    HG.setupResultBoard({
      game: GAME,
      score: game.finalTime,
      asc: true,
      name: game.team,
      extra: { hints: game.hints, caught: game.caught },
      form: $('nameForm'),
      input: $('nameInput'),
      list: $('resultBoard'),
      format: boardFormat,
      onSaved: () => $('againBtn').focus(),
    });
    setTimeout(() => showOverlay('resultScreen'), 1600);
  }

  $('againBtn').addEventListener('click', () => {
    blurActive();
    begin(game.team, (Math.random() * 1e9) | 0);
  });
  $('homeBtn').addEventListener('click', goTitle);

  /* ---------------- 수첩·명예의 전당·선생님 설정 ---------------- */
  let noteBack = null;
  $('noteBtn').addEventListener('click', () => {
    $('noteBtn').blur();
    if (game.mode !== 'play') return;
    const list = $('noteList');
    list.textContent = '';
    const doneIds = new Set(ROUTE.slice(0, game.stage).filter((r) => r.kind === 'room').map((r) => r.id));
    if (game.sub && game.sub.solved) doneIds.add(ROUTE[game.stage].id);
    game.run.steps.forEach((s) => {
      const li = el('li');
      li.append(el('span', null, s.icon), el('span', null, s.place), el('b', null, doneIds.has(s.id) ? String(game.run.digits[s.id]) : '?'));
      list.append(li);
    });
    noteBack = overlays.find((o) => !$(o).hidden) || null;
    showOverlay('noteScreen');
    $('noteClose').focus();
  });
  $('noteClose').addEventListener('click', () => {
    showOverlay(noteBack);
    noteBack = null;
    blurActive();
  });

  $('boardBtn').addEventListener('click', () => {
    HG.renderBoard($('boardList'), GAME, boardFormat, -1);
    showOverlay('boardScreen');
    $('boardClose').focus();
  });
  $('boardClose').addEventListener('click', () => showOverlay('titleScreen'));

  const tClass = $('tClass');
  E.CLASSES.forEach((c) => {
    const o = el('option', null, c);
    o.value = c;
    tClass.append(o);
  });
  function fillTeacher(s) {
    $('tSchool').value = s.school;
    tClass.value = s.myClass;
    [1, 2, 3].forEach((n) => {
      const q = s.quiz[n - 1];
      $('tQ' + n).value = q ? q.q : '';
      $('tA' + n).value = q ? q.a : '';
    });
  }
  $('teacherBtn').addEventListener('click', () => {
    fillTeacher(settings);
    $('tShare').hidden = true;
    showOverlay('teacherScreen');
    $('tSchool').focus();
  });
  $('tClose').addEventListener('click', goTitle);
  $('tReset').addEventListener('click', () => fillTeacher(E.normalizeSettings({})));
  $('teacherForm').addEventListener('submit', (e) => {
    e.preventDefault();
    settings = E.normalizeSettings({
      school: $('tSchool').value,
      myClass: tClass.value,
      quiz: [1, 2, 3].map((n) => ({ q: $('tQ' + n).value, a: $('tA' + n).value })),
    });
    HG.store.set(SETTINGS, settings);
    const code = E.encodeSettings(settings);
    try {
      history.replaceState(null, '', '#t-' + code); // 새로고침해도 방금 설정 그대로
    } catch (err) {
      /* 주소를 못 바꾸는 곳에서는 이 기기 저장만 써요 */
    }
    HG.sound.play('gold');
    paintTitle();
    const web = /^https?:$/.test(location.protocol) && !/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
    $('tShare').hidden = false;
    $('tQr').hidden = !web;
    if (!web) {
      $('tLink').textContent = '저장했어요! 이 기기에서는 바로 선생님 설정으로 해요. 학생 기기용 주소와 QR은 인터넷 주소(GitHub Pages)로 열었을 때 나와요.';
      return;
    }
    const url = location.origin + location.pathname + '#t-' + code;
    $('tLink').textContent = url;
    drawQr($('tQr'), url);
  });

  function drawQr(c, text) {
    const g = c.getContext('2d');
    const done = () => {
      const qr = window.qrcode(0, 'L');
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      const cell = Math.max(1, Math.floor(c.width / (n + 6)));
      const off = Math.floor((c.width - cell * n) / 2);
      g.fillStyle = '#fffaf0';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#120d1c';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect(off + k * cell, off + r * cell, cell, cell);
    };
    if (window.qrcode) return done();
    const tag = document.createElement('script');
    tag.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    tag.onload = () => window.qrcode && done();
    tag.onerror = () => (c.hidden = true);
    document.head.appendChild(tag);
  }

  /* ---------------- 조작 ---------------- */
  canvas.addEventListener('pointerdown', (e) => {
    if (game.paused || !game.sub) return;
    const p = view.toLocal(e.clientX, e.clientY);
    if (game.sub.tap) game.sub.tap(p.x, p.y);
    if (game.sub.push) game.sub.push();
  });
  $('stage').addEventListener('pointerdown', (e) => {
    // 문 밀기는 버튼이 아닌 곳 어디를 두드려도 돼요
    if (e.target !== canvas && !e.target.closest('button, input, select, a') && game.sub && game.sub.push && !game.paused) game.sub.push();
  });

  window.addEventListener('keydown', (e) => {
    if (HG.isTyping(e)) return;
    if (e.code === 'KeyM') {
      HG.sound.toggle();
      return;
    }
    if (e.code === 'Escape') {
      if (!$('noteScreen').hidden) $('noteClose').click();
      else if (!$('boardScreen').hidden) $('boardClose').click();
      else if (!$('teacherScreen').hidden) $('tClose').click();
      else if (!$('mapScreen').hidden && $('mapGo').textContent === '닫기') $('mapGo').click();
      return;
    }
    if (game.view === 'hall' && !game.paused) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        hallInput.left = true;
        e.preventDefault();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        hallInput.right = true;
        e.preventDefault();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) hallInput.hide = true;
      }
      return;
    }
    if (game.view === 'exit' && e.code === 'Space' && game.sub && game.sub.push && !game.paused && !e.target.closest('button')) {
      e.preventDefault();
      if (!e.repeat) game.sub.push();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') hallInput.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') hallInput.right = false;
  });
  window.addEventListener('blur', () => {
    hallInput.left = hallInput.right = false;
  });

  /* ---------------- 배경음: 오르골처럼 으스스하게 ---------------- */
  const MEL = [69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 76, 0, 74, 0, 72, 0, 67, 0, 71, 0, 74, 0, 71, 0, 67, 0, 74, 0, 72, 0, 71, 0];
  const SONG = {
    bpm: 84,
    play(step, when, dur, m) {
      const s = step % 32;
      if (MEL[s]) {
        m.tone({ type: 'triangle', f: m.N(MEL[s]), dur: dur * 3, vol: 0.09, when });
        m.tone({ type: 'sine', f: m.N(MEL[s] + 12), dur: dur * 2, vol: 0.025, when });
      }
      if (s % 16 === 0) m.tone({ type: 'sine', f: m.N(s ? 43 : 45), dur: dur * 15, vol: 0.06, when, attack: 0.4 });
    },
  };

  /* ---------------- 그리기 ---------------- */
  function update(dt) {
    game.t += dt;
    if (game.sub && game.sub.step && !game.paused) game.sub.step(dt);
    if (game.view === 'outside') {
      if (Math.random() < dt * 2.2) {
        const x = 120 + Math.random() * 720;
        const y = 70 + Math.random() * 160;
        const c = ['#ff8a1f', '#ffd166', '#9ff0d8', '#ff6fae', '#b48cff'][Math.floor(Math.random() * 5)];
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * Math.PI * 2;
          const v = 90 + Math.random() * 80;
          game.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2 + Math.random() * 0.4, c });
        }
      }
    }
    for (let i = game.sparks.length - 1; i >= 0; i--) {
      const p = game.sparks[i];
      p.vy += 60 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) game.sparks.splice(i, 1);
    }
  }

  function render() {
    view.begin();
    const t = game.t;
    switch (game.view) {
      case 'map':
        SC.map(ctx, t, places(), roomsDone());
        break;
      case 'room':
      case 'hall':
      case 'exit':
        if (game.sub) game.sub.draw(t);
        break;
      case 'outside':
        SC.outside(ctx, t, { school: game.run.school, sparks: game.sparks });
        break;
      default:
        SC.title(ctx, t, settings.school);
    }
    if (game.mode !== 'title') $('hudTime').textContent = '⏱ ' + E.formatTime(elapsed());
  }

  $('teamInput').value = HG.store.get('escape:team', '1모둠');
  HG.bindMuteButton($('muteBtn'));
  HG.bindFullscreenButton($('fullBtn'));
  goTitle();
  HG.loop(update, render);

  // 자동 검사용 창 (게임에는 쓰이지 않아요)
  window.__escape = { game, ROUTE, hallInput };
})();
