// SoundManager: 高品質MP3音源を使用したド派手なSEクラス
class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterCompressor = null;
    this.buffers = {};
    this.isLoaded = false;
    this.activeShuffleSource = null;
    this.heartbeatTimer = null;
    this.heartbeatPitch = 1;
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // マスターコンプレッサーの設定（音割れ防止と全体の迫力アップ）
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.masterCompressor.knee.setValueAtTime(40, this.ctx.currentTime);
    this.masterCompressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.masterCompressor.attack.setValueAtTime(0, this.ctx.currentTime);
    this.masterCompressor.release.setValueAtTime(0.25, this.ctx.currentTime);
    this.masterCompressor.connect(this.ctx.destination);
    
    // 音源ファイルの定義
    const sounds = {
      confirm: 'assets/sounds/confirm.mp3',
      shuffle: 'assets/sounds/shuffle.mp3',
      chance: 'assets/sounds/chance.mp3',
      don: 'assets/sounds/don.mp3',
      win: 'assets/sounds/win.mp3'
    };

    // 並列でダウンロードとデコードを実行
    const loadPromises = Object.entries(sounds).map(async ([key, url]) => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        this.buffers[key] = await this.ctx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.error(`Failed to load sound: ${key}`, e);
      }
    });

    await Promise.all(loadPromises);
    this.isLoaded = true;
    console.log("Sound Assets Loaded.");
  }

  // 音声を再生する内部メソッド
  _playSound(key, options = {}) {
    if (!this.ctx || !this.buffers[key]) return null;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers[key];
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(options.volume || 1.0, this.ctx.currentTime);
    
    source.connect(gainNode);
    gainNode.connect(this.masterCompressor || this.ctx.destination);
    
    if (options.loop) source.loop = true;
    if (options.playbackRate) {
      source.playbackRate.setValueAtTime(options.playbackRate, this.ctx.currentTime);
    }
    
    source.start(0);
    return { source, gainNode };
  }

  playConfirm() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // カチッとした、決断が伝わるソリッドなUI音を合成
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // 硬質で瞬間的なアタックを作るため、高音から急降下させる
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.03);

    // 非常に短いエンベロープで「カチッ」と鳴らす
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterCompressor || this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  // シャッフル中（回転中）の音を開始する
  startShuffle(pitch = 1) {
    if (this.activeShuffleSource) this.stopShuffle();
    this.activeShuffleSource = this._playSound('shuffle', { loop: true, playbackRate: pitch, volume: 0.4 });
  }

  stopShuffle() {
    if (this.activeShuffleSource) {
      this.activeShuffleSource.source.stop();
      this.activeShuffleSource = null;
    }
  }

  updateShufflePitch(pitch) {
    if (this.activeShuffleSource) {
      // 直ちに書き換えるのではなく、0.1秒かけて滑らかに変化させることで「音の途切れ」を防ぐ
      this.activeShuffleSource.source.playbackRate.linearRampToValueAtTime(pitch, this.ctx.currentTime + 0.1);
    }
  }

  playChance() {
    this._playSound('chance', { volume: 0.8 });
  }

  playFanfare() {
    this._playSound('win', { volume: 0.7 });
  }

  playDon() {
    this._playSound('don', { volume: 1.0 });
  }

  // 鼓動（ハートビート）音の合成と再生
  playHeartbeat() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // 鼓動は「ドックン」という2つのパルスで構成
    const playPulse = (time, freq, vol) => {
      // 基本となる重低音 (Sine)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, time);
      osc1.frequency.exponentialRampToValueAtTime(1, time + 0.15);
      gain1.gain.setValueAtTime(vol, time);
      gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      // アタック感（衝撃音）を出すための三角波 (Triangle)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, time);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, time); // 低域のみ残す

      gain2.gain.setValueAtTime(vol * 1.5, time); // 少し強めに設定
      gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      osc1.connect(gain1);
      gain1.connect(this.masterCompressor || this.ctx.destination);

      osc2.connect(filter);
      filter.connect(gain2);
      gain2.connect(this.masterCompressor || this.ctx.destination);

      osc1.start(time);
      osc1.stop(time + 0.2);
      osc2.start(time);
      osc2.stop(time + 0.2);
    };

    // 音量を大幅に引き上げ (1.0 -> 2.5) し、中域の厚みを増強
    playPulse(t, 55, 2.5);        // ドッ
    playPulse(t + 0.15, 45, 2.0); // クン
  }

  startHeartbeat() {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    
    // 最初はゆっくりスタート (1200ms間隔)
    this.currentHeartbeatInterval = 1200;
    
    const trigger = () => {
      this.playHeartbeat();
      
      // 次の鼓動までの時間を徐々に短くしてテンポアップ（最小300msまで）
      this.currentHeartbeatInterval = Math.max(300, this.currentHeartbeatInterval - 100);
      this.heartbeatTimer = setTimeout(trigger, this.currentHeartbeatInterval);
    };
    trigger();
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

const sound = new SoundManager();

// アプリの状態管理
const state = {
  bikes: 0,
  betType: '',
  shuffleInterval: null,
  shuffleCount: 0,
  currentVersion: '1.0.0',
  latestVersion: '1.0.0'
};

// 要素の取得 (Lazy getter を使用して初期化ミスを防ぐ)
const getEl = (id) => document.getElementById(id);

const getScreens = () => ({
  screen0: getEl('screen-0'),
  screen1: getEl('screen-1'),
  screen2: getEl('screen-2'),
  screen3: getEl('screen-3'),
  screenInfo: getEl('screen-info'),
  screenTracks: getEl('screen-tracks')
});

// 音声やバイブレーションも入れられるが、今回はWebAPI（ハプティクス等）を利用
// Capacitor Haptics を利用したネイティブ振動（プレミアムな手応え）
async function vibrate(type = 'light') {
  // Capacitor環境（実機）の場合
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.Haptics) {
    const { Haptics } = Capacitor.Plugins;
    try {
      if (type === 'light') await Haptics.impact({ style: 'LIGHT' });
      else if (type === 'medium') await Haptics.impact({ style: 'MEDIUM' });
      else if (type === 'heavy') {
        // 重い振動はインパクトと長めの振動を組み合わせる
        await Haptics.notification({ type: 'SUCCESS' });
      }
    } catch (e) {
      console.error('Haptics error:', e);
    }
  } else {
    // ブラウザ環境（WebAPI）へのフォールバック
    if (!navigator.vibrate) return;
    if (type === 'light') navigator.vibrate(20);
    if (type === 'medium') navigator.vibrate(50);
    if (type === 'heavy') navigator.vibrate([100, 50, 100]);
  }
}

// ホーム画面からの遷移
function openRoulette() {
  sound.init(); 
  sound.playConfirm();
  vibrate('medium');
  const screens = getScreens();
  switchScreen(screens.screen0, screens.screen1);
}

function openInfo() {
  sound.init();
  sound.playConfirm();
  vibrate('medium');
  const screens = getScreens();
  switchScreen(screens.screen0, screens.screenInfo);
}

function openTracks() {
  sound.init();
  sound.playConfirm();
  vibrate('medium');
  const screens = getScreens();
  switchScreen(screens.screen0, screens.screenTracks);
}

function goHome() {
  sound.playConfirm();
  vibrate('light');
  // 全ての画面を非表示にしてホームを表示
  const screens = getScreens();
  Object.values(screens).forEach(s => {
    if (s) {
      s.classList.add('hidden');
    }
  });
  setTimeout(() => {
    if (screens.screen0) {
      screens.screen0.classList.remove('hidden');
      // 画面を表示するタイミングで最上部へスクロール
      screens.screen0.scrollTop = 0;
      const sc = screens.screen0.querySelector('.scroll-container');
      if (sc) sc.scrollTop = 0;
    }
  }, 500);
}

// 画面1: 台数選択
function selectBikes(num) {
  sound.playConfirm();
  vibrate('medium');
  state.bikes = num;
  const screens = getScreens();
  switchScreen(screens.screen1, screens.screen2);
}

// 画面2: 券種選択
function selectBetType(type) {
  sound.playConfirm();
  vibrate('medium');
  state.betType = type;
  const screens = getScreens();
  switchScreen(screens.screen2, screens.screen3);
  startRoulette();
}

// 画面切り替え共通処理
function switchScreen(from, to) {
  if (from) from.classList.add('hidden');
  setTimeout(() => {
    if (to) {
      to.classList.remove('hidden');
      // 新しい画面を開く際に最上部にスクロールを戻す
      to.scrollTop = 0;
      const scrollContainer = to.querySelector('.scroll-container');
      if (scrollContainer) scrollContainer.scrollTop = 0;
    }
  }, 500); // CSSのtransitionより後か同時に発火させる
}

function goBack(toScreenNum) {
  sound.playConfirm();
  vibrate();
  const screens = getScreens();
  // 以前の簡易的な戻る処理を goHome に誘導、または個別に管理
  if (toScreenNum === 1) {
    switchScreen(screens.screen2, screens.screen1);
  } else {
    goHome();
  }
}

// 抽選処理本体
function startRoulette() {
  const modeRoulette = document.getElementById('roulette-mode');
  const modeResult = document.getElementById('result-mode');
  const pushBtn = document.getElementById('push-btn');
  
  modeRoulette.classList.remove('hidden');
  modeResult.classList.add('hidden');
  pushBtn.classList.add('hidden');
  
  // 予想確定タイトルの表示クラスをリセット
  const resultTitle = document.querySelector('.result-title');
  if (resultTitle) resultTitle.classList.remove('show');

  // リトライ時に結果画面の要素を初期化する
  ['result-message', 'retry-btn', 'start-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.classList.remove('fade-in-anim');
    }
  });

  // ルーレット開始時は背景点滅をさせない (溜めの時間)
  document.querySelector('.bg-effect').classList.remove('bg-flash');
  
  const feverText = document.getElementById('fever-text');
  feverText.classList.remove('mirai-mode');
  feverText.innerText = "激熱";
  feverText.style.color = "#ff0000";
  feverText.style.textShadow = "0 0 20px #ff0000, 0 0 40px #ff6600, 0 0 60px #ffff00";
  feverText.style.animation = 'flashFever 0.5s ease infinite'; // ボタンを押すまで無限に点滅させる

  const bikes = document.querySelectorAll('.bike-img');
  bikes.forEach(bike => {
    // 3台が順位を入れ替えながらデッドヒートするような乱数を付与
    const duration = 0.6 + Math.random() * 0.4; 
    const delay = Math.random() * 0.3;
    bike.style.display = 'block';
    bike.style.animation = `dashBikeRace ${duration}s linear infinite ${delay}s`;
  });
  
  const slotNumbers = document.getElementById('slot-numbers');
  slotNumbers.classList.remove('hidden');
  
  document.querySelector('.bike-animation-area').classList.remove('hidden');
  
  // 券種に応じた枠数（1個、2個、3個）を計算
  let count = 1;
  if (state.betType.includes('2連') || state.betType.includes('ワイド')) count = 2;
  if (state.betType.includes('3連')) count = 3;

  state.shuffleCount = 0;
  sound.startShuffle();
  // スロットの数字シャッフル（実際の車番カラーを反映させて超高速で回す）
  state.shuffleInterval = setInterval(() => {
    state.shuffleCount++;
    // シャッフル音（徐々にピッチを上げる演出）
    const pitch = 1 + (state.shuffleCount / 50);
    sound.updateShufflePitch(pitch);

    let slotsHtml = '';
    for (let i = 0; i < count; i++) {
       const randNum = Math.floor(Math.random() * state.bikes) + 1;
       slotsHtml += `<div class="slot-item color-${randNum}">${randNum}</div>`;
    }
    slotNumbers.innerHTML = slotsHtml;
  }, 60);

  // 3.5秒後に演出を切り替える
  setTimeout(() => {
    feverText.classList.add('mirai-mode');
    feverText.innerText = "未来を・・・";
    feverText.style.color = "#ffffff";
    feverText.style.textShadow = "0 0 20px #000, 0 0 30px #00f3ff, 0 0 60px #00f3ff";
    feverText.style.animation = 'none'; // CSSのアニメーションに任せる
    
    // 鼓動演出の開始（最初ゆっくりで徐々に自律的に加速させる）
    sound.startHeartbeat();
    
    // 1. 一度だけ大きくフラッシュさせる
    const flashEl = document.getElementById('white-flash');
    flashEl.classList.remove('hidden');
    flashEl.classList.add('impact-flash-anim');
    
    // 2. フラッシュの直後から背景の点滅(チカチカ)を開始
    setTimeout(() => {
      document.querySelector('.bg-effect').classList.add('bg-flash');
      flashEl.classList.add('hidden');
      flashEl.classList.remove('impact-flash-anim');
    }, 300);

    // チャンス音（キュイン！）
    sound.playChance();
    
    // PUSHボタンの出現は「未来を・・・」が消えるタイミング(2.2秒後)にする
    setTimeout(() => {
      pushBtn.classList.remove('hidden');
      vibrate('heavy'); // ボタン出現バイブ
    }, 2200);
  }, 3500);
}

// ユーザーがボタンを押して結果を発表
function revealResult() {
  sound.stopShuffle();
  sound.stopHeartbeat();
  vibrate();
  
  // 全ての演出をストップさせる
  clearInterval(state.shuffleInterval);
  document.querySelector('.bg-effect').classList.remove('bg-flash');
  document.querySelectorAll('.bike-img').forEach(bike => {
    bike.style.animation = 'none';
    bike.style.display = 'none'; // 停止中は非表示化
  });
  
  const feverText = document.getElementById('fever-text');
  feverText.classList.remove('mirai-mode');
  feverText.style.animation = 'none';
  feverText.innerText = '';
  
  document.getElementById('push-btn').classList.add('hidden');

  // フラッシュ中はスロットの数字とバイクアニメーション枠を隠して、背景のみの純粋なフラッシュ演出にする
  document.getElementById('slot-numbers').classList.add('hidden');
  document.querySelector('.bike-animation-area').classList.add('hidden');

  // パチンコ風「確定ボタン」フラッシュ3回演出
  const flashEl = document.getElementById('white-flash');
  flashEl.classList.remove('hidden');
  flashEl.classList.remove('impact-flash-anim');
  flashEl.classList.remove('flash-out');
  void flashEl.offsetWidth; // リファローしてアニメーション状態リセット
  flashEl.classList.add('flash-three-times');
  
  // フラッシュに合わせてドン！3回
  sound.playDon();
  setTimeout(() => sound.playDon(), 400);
  setTimeout(() => sound.playDon(), 800);
  
  // フラッシュ演出完了後に結果画面表示
  setTimeout(() => {
    const modeRoulette = document.getElementById('roulette-mode');
    modeRoulette.classList.add('hidden');
    
    flashEl.classList.remove('flash-three-times');
    flashEl.classList.add('hidden');
    
    showResult();
  }, 1200);
}

function showResult() {
  const modeResult = document.getElementById('result-mode');
  modeResult.classList.remove('hidden');
  
  // 確定ファンファーレ
  sound.playFanfare();
  vibrate('heavy');

  const resultBox = document.getElementById('result-box');
  resultBox.innerHTML = ''; // クリア

  // 買い目の計算
  const numbers = generateResult(state.bikes, state.betType);
  
  // フラッシュ演出終了後に「予想確定」が出現するのを少し待ってから「ドン！ドン！ドン！」と出すためのディレイ
  const baseDelayBase = 1200; // ms (タイトル表示を待つため遅延を増やす)
  const interval = 600;      // ms

  // HTMLへ生成
  numbers.forEach((num, index) => {
    const item = document.createElement('div');
    item.className = `result-number-item pop-in color-${num}`;
    
    // アニメーション遅延 (秒)
    const delaySec = (baseDelayBase + (index * interval)) / 1000;
    item.style.animationDelay = `${delaySec}s`;
    
    // 券種に応じて表示するラベルテキストを切り替える
    const labelStr = (state.betType.includes('複') || state.betType.includes('ワイド')) ? `${index + 1}台目` : `${index + 1}着`;
    item.innerHTML = `<span>${num}</span><div class="result-label">${labelStr}</div>`;
    
    resultBox.appendChild(item);

    // ドン！音の予約 (SEのタイミングをアニメーションに合わせる)
    setTimeout(() => {
      sound.playDon();
      vibrate('medium');
    }, baseDelayBase + (index * interval));

    // 最後の数字以外ならハイフンを入れる(- か =)
    if (index < numbers.length - 1) {
      const hyphen = document.createElement('div');
      hyphen.className = 'result-hyphen';
      hyphen.innerText = (state.betType.includes('複') || state.betType.includes('ワイド')) ? '=' : '-';
      hyphen.style.animationDelay = `${delaySec + 0.2}s`;
      resultBox.appendChild(hyphen);
    }
  });

  // 1. 車番が全て出揃ったタイミングで「予想確定」タイトル、メッセージ、ボタンを同時に表示
  const titleShowTime = baseDelayBase + (numbers.length * interval);
  setTimeout(() => {
    const resultTitle = document.querySelector('.result-title');
    if (resultTitle) resultTitle.classList.add('show');
    vibrate('heavy');

    ['result-message', 'retry-btn', 'start-btn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('hidden');
        el.classList.add('fade-in-anim');
      }
    });
  }, titleShowTime);
}

function generateResult(maxNum, type) {
  let pool = [];
  for (let i = 1; i <= maxNum; i++) pool.push(i);

  let picks = [];
  let count = 1;
  
  if (type.includes('2連') || type.includes('ワイド')) count = 2;
  if (type.includes('3連')) count = 3;

  for (let c = 0; c < count; c++) {
    const rIndex = Math.floor(Math.random() * pool.length);
    picks.push(pool[rIndex]);
    pool.splice(rIndex, 1);
  }

  // 「複」や「ワイド」なら昇順ソートする
  if (type.includes('複') || type.includes('ワイド')) {
    picks.sort((a, b) => a - b);
  }

  return picks;
}

function retry() {
  sound.playConfirm();
  vibrate('light');
  startRoulette();
}

/** --- Brand Splash & Update Check --- **/
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function showBrandSplash() {
  const splash = document.getElementById('brand-splash');
  const logo = document.getElementById('brand-logo');
  if (!splash || !logo) return;

  // ロゴのフェードイン・アウト演出
  await wait(100);
  logo.classList.add('fade-in');
  await wait(1500); // 1.0s fade-in + 0.5s static
  logo.classList.remove('fade-in');
  await wait(1000); // 1.0s fade-out

  // 「タップしてスタート」テキストを表示
  const tapText = document.createElement('p');
  tapText.textContent = 'タップしてスタート';
  tapText.style.cssText = 'color:#999;font-size:1rem;position:absolute;bottom:25%;left:50%;transform:translateX(-50%);animation:fadeInTap 1s ease infinite alternate;';
  splash.appendChild(tapText);

  // ユーザーのタップを待ってからホーム画面へ遷移
  await new Promise(resolve => {
    const onTap = (e) => {
      e.preventDefault();
      e.stopPropagation();
      splash.removeEventListener('click', onTap, true);
      splash.removeEventListener('touchend', onTap, true);
      resolve();
    };
    splash.addEventListener('click', onTap, true);
    splash.addEventListener('touchend', onTap, true);
  });

  // スプラッシュをフェードアウトして削除（pointer-eventsで下層への伝播を完全にブロック）
  splash.style.pointerEvents = 'none';
  splash.classList.add('fade-out');
  await wait(1000);
  splash.remove();
}

function checkUpdate() {
  if (state.currentVersion !== state.latestVersion) {
    document.getElementById('update-overlay').classList.remove('hidden');
  }
}

// アプリ起動時の初期化
document.addEventListener('DOMContentLoaded', () => {
  showBrandSplash();
  setTimeout(checkUpdate, 2000);

  document.getElementById('update-now-btn').onclick = () => {
    const url = /iPhone|iPad|iPod/.test(navigator.userAgent)
      ? 'https://apps.apple.com/app/id6761675839'
      : 'https://play.google.com/store/apps/details?id=com.jirachi.autorace';
    window.open(url, '_blank');
  };

  document.getElementById('update-later-btn').onclick = () => {
    document.getElementById('update-overlay').classList.add('hidden');
  };
});
