const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, screen, dialog, net } = require('electron');
const path = require('path');
const fs = require('fs');
const ime = require('./ime');

// ── 설정 (여기 숫자/키만 바꾸면 동작이 바뀝니다) ──────────────────
const WIN_W = 440;          // 창 너비(px)
const WIN_H = 596;          // 창 높이(px)  (795 × 3/4)
const MARGIN = 24;          // 화면 모서리에서 띄울 간격(px)
const CORNER = 'bottom-right'; // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

const KEY_TOGGLE = 'Alt+Q';           // 보스키: 어디서든 켜기/숨기기
const KEY_PANIC  = 'Control+Alt+H';   // 패닉키: 무조건 즉시 숨기기
const KEY_HOME   = 'Alt+1';           // 홈(리스트) 화면으로 전환
const KEY_VOCAB  = 'Alt+2';           // 단어장(목록) 화면으로 전환
const KEY_FLASH  = 'Alt+3';           // 플래시카드 모드로 전환
const KEY_QUIZ   = 'Alt+4';           // 시험 화면으로 전환
const KEY_INPUT  = 'Alt+5';           // 설정 메뉴 화면으로 전환 (단어 관련 / 설정)

const AUTO_IME = true;      // 창 포커스 시 일본어(히라가나), 숨김·다른 창·종료 시 한국어 입력기로 자동 전환

const TIMER_H = 56;         // 타이머 창 높이(px) — 너비는 본 창과 같음
const TIMER_GAP = 8;        // 본 창과 타이머 창 사이 간격(px)
// ───────────────────────────────────────────────────────────────

// 구글 음성 요청 1회당 글자 수 제한(약 200자) → 문장부호 기준으로 나눔
const TTS_MAX = 180;
function splitTtsText(text) {
  const out = [];
  let cur = '';
  for (const piece of text.trim().split(/(?<=[。、！？!?\s])/)) {
    if ((cur + piece).length > TTS_MAX && cur) { out.push(cur); cur = ''; }
    cur += piece;
    while (cur.length > TTS_MAX) { out.push(cur.slice(0, TTS_MAX)); cur = cur.slice(TTS_MAX); }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

let win = null;
let tray = null;
let visible = false;
let targetDisplay = null;   // 창을 띄울 모니터 (시작 시 선택, 기본은 주 모니터)

function startDisplay() {
  return targetDisplay || screen.getPrimaryDisplay();
}

// 모니터 선택은 start.js(npm start)가 터미널에서 물어본 뒤 --display-id=<id> 로 넘겨줌.
// (Electron 프로세스는 Windows 콘솔에서 키보드 입력을 못 받는 경우가 있어 Node 스크립트에서 처리)
// 인자가 없거나(패키징된 exe 등) 해당 모니터가 없으면 주 모니터 사용.
function pickDisplayFromArgs() {
  const arg = process.argv.find(a => a.startsWith('--display-id='));
  if (!arg) return null;
  const id = Number(arg.split('=')[1]);
  return screen.getAllDisplays().find(d => d.id === id) || null;
}

// start.js 가 모니터 목록을 알아내기 위해 --list-displays 로 실행하면 JSON 한 줄만 출력하고 종료
function printDisplays() {
  const primaryId = screen.getPrimaryDisplay().id;
  const list = screen.getAllDisplays().map(d => ({ id: d.id, bounds: d.bounds, primary: d.id === primaryId }));
  process.stdout.write('DISPLAYS:' + JSON.stringify(list) + '\n');
}

function cornerPosition() {
  const { workArea } = startDisplay(); // 작업표시줄 제외 영역
  const right = workArea.x + workArea.width - WIN_W - MARGIN;
  const left = workArea.x + MARGIN;
  const bottom = workArea.y + workArea.height - WIN_H - MARGIN;
  const top = workArea.y + MARGIN;
  switch (CORNER) {
    case 'bottom-left': return { x: left, y: bottom };
    case 'top-right': return { x: right, y: top };
    case 'top-left': return { x: left, y: top };
    default: return { x: right, y: bottom };
  }
}

// 선택한 모니터(기본: 주 모니터) 중앙 좌표 (작업표시줄 제외 영역 기준, 화면 밖으로 나가지 않게 보정)
function centerPosition() {
  const { workArea } = startDisplay();
  return {
    x: Math.max(workArea.x, Math.round(workArea.x + (workArea.width - WIN_W) / 2)),
    y: Math.max(workArea.y, Math.round(workArea.y + (workArea.height - WIN_H) / 2)),
  };
}

function createWindow() {
  const { x, y } = centerPosition();   // 처음 띄울 때 화면 중앙에 배치
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x, y,
    frame: false,          // 테두리/제목표시줄 없음
    resizable: true,       // 크기 변경 허용
    minWidth: WIN_W,       // 너비는 고정 → 좌우는 못 늘림
    maxWidth: WIN_W,
    minHeight: 200,        // 높이만 상하로 조절 가능
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,     // 작업표시줄에 표시 안 함
    show: false,           // 시작 시 숨김 상태
    alwaysOnTop: true,     // 켜져 있는 동안 항상 화면 최상단 (Esc·Alt+Q로만 숨김)
    backgroundColor: '#15161a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,        // preload 에서 words.json 읽기/쓰기(fs) 허용
      // 단어 저장소(words.json) 위치 = 앱 데이터 폴더 (%APPDATA%\gm6) — portable 빌드에서도 유지됨
      additionalArguments: [`--gm6-data-dir=${app.getPath('userData')}`],
    },
  });

  win.loadFile('index.html');

  // start.js 에서 모니터를 고르고(번호 입력/엔터) 실행했으면 로드가 끝나는 대로 그 모니터에 바로 표시
  if (process.argv.includes('--show')) win.once('ready-to-show', show);

  // 입력기 자동 전환: 포커스 → 일본어, 포커스 잃음(숨김 포함) → 한국어
  // show() 의 포커스 재시도로 focus/blur 가 잠깐 오갈 수 있어 마지막 상태만 반영
  if (AUTO_IME) {
    winHwnd = ime.hwndOf(win);
    win.on('focus', () => scheduleIme('ja'));
    win.on('blur', () => scheduleIme('ko'));
  }

  // 타이머 창은 본 창과 한 몸: 움직이거나 크기가 바뀌면 바로 따라감,
  // 이동·크기 조절이 끝났을 때 아래 공간이 모자라면 본 창을 위로 밀어 올림
  win.on('move', positionTimer);
  win.on('resize', positionTimer);
  win.on('moved', () => { fitMainForTimer(); positionTimer(); });
  win.on('resized', () => { fitMainForTimer(); positionTimer(); });

  // 닫기 버튼/Alt+F4를 눌러도 종료 대신 숨김 (트레이에 살아있음)
  win.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      hide();
    }
  });
}

let winHwnd = '';           // 입력기 전환용 창 핸들
let imeTimer = null;
// 렌더러의 입력칸(input·textarea 등)에 포커스가 있는지. 있을 때만 IME 를 열어(히라가나) 두고
// 없으면 닫아(직접 입력) 플래시카드·시험 화면의 S·D·B 등 단축키가 IME 에 먹히지 않게 한다
let editableFocused = false;
function scheduleIme(lang) {
  clearTimeout(imeTimer);
  imeTimer = setTimeout(() => ime.set(lang, winHwnd, editableFocused), 120);
}
function setImeEditable(on) {
  editableFocused = !!on;
  if (!AUTO_IME || !win || win.isDestroyed() || !win.isFocused()) return;   // 창이 뒤에 있으면 focus 때 반영
  ime.set('open', winHwnd, editableFocused);
}

// 창 + 내부 웹페이지까지 키보드 포커스를 확실히 가져옴
// (다른 프로그램을 쓰다 돌아오면 창은 보여도 키 입력이 안 먹히는 문제 방지)
function grabFocus() {
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  win.setAlwaysOnTop(true, 'screen-saver'); // 최상단으로 끌어올림
  win.moveTop();
  win.focus();
  win.webContents.focus();                   // 창만이 아니라 페이지(렌더러)에도 포커스
}

function show() {
  if (!win) return;
  win.show();          // 마지막 위치 그대로 복구 (모서리 배치는 최초 생성 시 1회만)
  visible = true;
  showTimerWin();      // 타이머가 켜져 있으면 함께 표시
  grabFocus();
  // Windows 가 포커스 이동을 막는 경우가 있어 잠깐 뒤에 몇 번 더 확인·재시도
  [50, 150, 300].forEach((ms) => setTimeout(() => {
    if (visible && win && !win.isDestroyed() && !(win.isFocused() && win.webContents.isFocused())) {
      win.setAlwaysOnTop(false);               // 최상단 속성을 껐다 켜면 Windows 가 전면 전환을 허용
      grabFocus();
    }
  }, ms));
}

// all = true (패닉키) 면 타이머 창까지 무조건 숨김.
// 그 외(Esc·Alt+Q·트레이)에는 타이머가 동작 중이면 타이머 창은 그대로 보이게 둠
// (일시정지·정지·완료 상태면 함께 숨김, 시간은 숨겨져도 계속 흐름)
function hide(all = false) {
  if (!win) return;
  win.hide();
  if (timerWin) {
    if (all === true || timer.state !== 'running') timerWin.hide();
    else setTimerAlone(true);   // 타이머 창만 남음 → 마우스로 옮길 수 있게
  }
  visible = false;
}

// ── 타이머 (Alt+5 → 타이머) ──────────────────────────────────────
// 본 창 아래 TIMER_GAP 만큼 띄운 작은 창. 포커스를 가져가지 않아 본 창 키 입력·입력기 전환에 영향 없음.
// 시간은 메인 프로세스에서 종료 시각 기준으로 계산 → 창이 숨겨져 있어도 정확함.
// state: 'running' | 'paused' | 'stopped'(설정 시간으로 되돌려 멈춤) | 'done'(00:00:00)
let timerWin = null;
const timer = { duration: 0, remaining: 0, endAt: 0, state: 'stopped' };
let timerTick = null;   // 종료 시각에 'done' 으로 바꾸는 setTimeout

function timerReserve() { return timerWin ? TIMER_H + TIMER_GAP : 0; }

// 본 창 아래에 타이머 자리가 없으면 본 창을 위로 밀어 올림 (그래도 모자라면 높이를 줄임)
function fitMainForTimer() {
  if (!timerWin || !win || win.isDestroyed()) return;
  const b = win.getBounds();
  const { workArea } = screen.getDisplayMatching(b);
  const bottom = workArea.y + workArea.height - timerReserve();   // 본 창이 내려올 수 있는 한계
  const height = Math.min(b.height, Math.max(200, bottom - workArea.y));
  const y = Math.max(workArea.y, Math.min(b.y, bottom - height));
  if (y === b.y && height === b.height) return;
  settingBounds = true;   // 세로 늘리기 상태가 풀리지 않게
  try { win.setBounds({ x: b.x, y, width: b.width, height }); } finally { settingBounds = false; }
}

function positionTimer() {
  if (!timerWin || !win || win.isDestroyed()) return;
  const b = win.getBounds();
  timerWin.setBounds({ x: b.x, y: b.y + b.height + TIMER_GAP, width: b.width, height: TIMER_H });
}

// 타이머 창만 남았을 때(본 창 숨김 + 타이머 동작 중)만 끌어서 옮길 수 있음.
// 본 창이 다시 보이면 고정으로 돌아가고 본 창 아래 원래 자리로 다시 붙음
let timerAlone = false;
function setTimerAlone(alone) {
  timerAlone = alone;
  if (!timerWin || timerWin.isDestroyed()) return;
  timerWin.setMovable(alone);
  timerWin.webContents.send('timer:alone', alone);   // 창 전체를 끌기 영역으로 (버튼 제외)
}

function showTimerWin() {
  if (!timerWin || !visible) return;
  setTimerAlone(false);
  fitMainForTimer();
  positionTimer();
  timerWin.setAlwaysOnTop(true, 'screen-saver');
  timerWin.showInactive();   // 포커스는 본 창에 그대로
}

function createTimerWin() {
  timerWin = new BrowserWindow({
    width: WIN_W,
    height: TIMER_H,
    frame: false,
    resizable: false,
    movable: false,        // 따로 옮길 수 없음 (본 창을 따라서만 움직임)
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,      // 클릭해도 본 창의 포커스를 뺏지 않음
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#1a1c20',
    webPreferences: {
      preload: path.join(__dirname, 'timer-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  timerWin.loadFile('timer.html');
  timerWin.webContents.on('did-finish-load', () => {
    sendTimerState();
    timerWin.webContents.send('timer:alone', timerAlone);
  });
  timerWin.on('closed', () => { timerWin = null; });
}

function timerRemaining() {
  return timer.state === 'running' ? Math.max(0, timer.endAt - Date.now()) : timer.remaining;
}

// 타이머 창에 상태 전송 (상태가 바뀔 때만).
// 동작 중에는 종료 시각(endAt)을 보내 타이머 창이 밀리초까지 직접 계산·표시
function sendTimerState() {
  if (!timerWin || timerWin.isDestroyed()) return;
  timerWin.webContents.send('timer:state', {
    remaining: timerRemaining(),
    endAt: timer.state === 'running' ? timer.endAt : 0,
    state: timer.state,
  });
}

// 동작 중이면 종료 시각에 'done'(00:00:00.00 에서 멈춤, 다른 알림 없음) 으로 전환
function runTimerTick() {
  clearTimeout(timerTick);
  timerTick = null;
  if (timer.state !== 'running') return;
  timerTick = setTimeout(() => {
    timerTick = null;
    if (timer.state !== 'running') return;
    if (timerRemaining() > 0) { runTimerTick(); return; }   // 타이머가 조금 일찍 깨어난 경우 다시 대기
    timer.state = 'done';
    timer.remaining = 0;
    sendTimerState();
  }, timerRemaining());
}

function setTimerState(state) {
  if (state === 'running') {
    timer.endAt = Date.now() + timer.remaining;
  } else if (timer.state === 'running') {
    timer.remaining = timerRemaining();
  }
  timer.state = state;
  runTimerTick();
  sendTimerState();
}

function startTimer(sec) {
  const ms = Math.round(Number(sec) || 0) * 1000;
  if (ms <= 0) return;
  timer.duration = ms;
  timer.remaining = ms;
  timer.state = 'stopped';
  if (!timerWin) createTimerWin();
  setTimerState('running');
  showTimerWin();
}

function closeTimer() {
  clearTimeout(timerTick);
  timerTick = null;
  timer.state = 'stopped';
  timerAlone = false;
  if (timerWin && !timerWin.isDestroyed()) timerWin.destroy();
  timerWin = null;
}

// 타이머 창 버튼
function timerAction(action) {
  if (!timerWin) return;
  if (action === 'toggle') {                 // 일시정지 ↔ 계속
    if (timer.state === 'running') setTimerState('paused');
    else if (timer.remaining > 0) setTimerState('running');
  } else if (action === 'restart') {         // 설정한 시간부터 다시
    timer.remaining = timer.duration;
    timer.state = 'stopped';
    setTimerState('running');
  } else if (action === 'stop') {            // 1회: 설정 시간으로 되돌려 멈춤 / 정지 상태에서 1회 더: 타이머 끄기
    if (timer.state === 'stopped') { closeTimer(); return; }
    timer.state = 'stopped';
    timer.remaining = timer.duration;
    runTimerTick();
    sendTimerState();
  }
}

function toggle() {
  visible ? hide() : show();
}

// ── 세로 늘리기 3단계 순환 ────────────────────────────────────────
// 기본 → (1회) 좀 더 길게 → (2회) 작업 영역(작업표시줄 제외) 꽉 채우기 → (3회) 그 자리에서 기본 크기로 복구.
// 사용자가 직접 크기를 바꾸면 상태를 해제.
const FIT_MID_RATIO = 0.5;  // 1단계 높이: 기본 높이와 꽉 찬 높이 사이의 비율 (0.5 = 딱 중간)
let fitState = null;        // { x, y, width, height } 기본 크기 복구용 (null 이면 꺼짐)
let fitLevel = 0;           // 0 = 기본, 1 = 좀 더 길게, 2 = 꽉 채움
let settingBounds = false;  // 우리가 setBounds 하는 동안 resize 이벤트 무시용
function toggleFitHeight() {
  if (!win) return 0;
  settingBounds = true;
  try {
    if (fitLevel === 2) {
      // 위치는 지금 자리(왼쪽·위 모서리) 그대로, 크기만 기본(늘리기 전) 크기로 복구
      const cur = win.getBounds();
      win.setBounds({ x: cur.x, y: cur.y, width: fitState.width, height: fitState.height });
      fitState = null;
      fitLevel = 0;
    } else {
      const cur = win.getBounds();
      if (fitLevel === 0) fitState = cur;
      const area = screen.getDisplayMatching(cur).workArea;
      // 타이머가 켜져 있으면 아래 타이머 창 자리(높이 + 간격)를 빼고 늘림
      const workArea = { y: area.y, height: area.height - timerReserve() };
      if (fitLevel === 0) {
        const h = Math.round(cur.height + (workArea.height - cur.height) * FIT_MID_RATIO);
        // 가로 위치는 그대로, 세로는 작업 영역 중앙에 맞춰 위아래로 늘림
        const y = Math.max(workArea.y, Math.round(workArea.y + (workArea.height - h) / 2));
        win.setBounds({ x: cur.x, y, width: cur.width, height: h });
        fitLevel = 1;
      } else {
        win.setBounds({ x: cur.x, y: workArea.y, width: cur.width, height: workArea.height });
        fitLevel = 2;
      }
    }
  } finally {
    settingBounds = false;
  }
  return fitLevel;
}

// 화면 전환: 창을 띄우고 렌더러에 전환 신호 전송
function switchView(view) {
  show();
  if (win) win.webContents.send('view', view);
}

function buildTray() {
  // 아이콘 파일이 있으면 사용, 없으면 빈 아이콘으로 폴백
  let icon = path.join(__dirname, 'icon.png');
  tray = new Tray(icon);
  tray.setToolTip('System');
  const menu = Menu.buildFromTemplate([
    { label: `열기 / 숨기기  (${KEY_TOGGLE})`, click: toggle },
    { type: 'separator' },
    { label: `홈  (${KEY_HOME})`, click: () => switchView('home') },
    { label: `단어장  (${KEY_VOCAB})`, click: () => switchView('vocab') },
    { label: `플래시카드  (${KEY_FLASH})`, click: () => switchView('flash') },
    { label: `시험  (${KEY_QUIZ})`, click: () => switchView('quiz') },
    { label: `설정  (${KEY_INPUT})`, click: () => switchView('settings') },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', toggle); // 트레이 아이콘 클릭으로도 토글
}

app.whenReady().then(() => {
  if (process.argv.includes('--list-displays')) {
    printDisplays();
    app.exit(0);
    return;
  }
  targetDisplay = pickDisplayFromArgs();
  if (AUTO_IME) ime.start();   // 도우미 준비(수 초)는 백그라운드로, 그 전 명령은 대기 후 처리
  createWindow();
  buildTray();

  // 등록 실패(다른 앱이 선점) 시 경고 출력
  const reg = (key, fn) => {
    if (!globalShortcut.register(key, fn)) {
      console.warn(`[gm6] Failed to register shortcut: ${key} (it may be in use by another program)`);
    }
  };
  reg(KEY_TOGGLE, toggle);
  reg(KEY_PANIC, () => hide(true));
  reg(KEY_HOME, () => switchView('home'));
  reg(KEY_VOCAB, () => switchView('vocab'));
  reg(KEY_FLASH, () => switchView('flash'));
  reg(KEY_INPUT, () => switchView('settings'));
  reg(KEY_QUIZ, () => switchView('quiz'));

  // 렌더러(게임 화면)에서 Esc를 누르면 숨김 요청이 옴
  ipcMain.on('boss:hide', () => hide());   // 이벤트 객체가 all 인자로 넘어가지 않게
  // 렌더러에서 입력칸 포커스가 바뀌었을 때 (true=입력칸에 포커스 → IME 열림)
  ipcMain.on('ime:editable', (_e, on) => setImeEditable(on));
  // 제목 표시줄 '세로 늘리기' 버튼 → 다음 단계로 바꾼 뒤 현재 단계(0=기본, 1=좀 더 길게, 2=꽉 채움) 반환
  ipcMain.handle('boss:fitHeight', () => toggleFitHeight());
  // 타이머: 본 창 설정 화면의 '시작' (초 단위) / 타이머 창 버튼 ('toggle' | 'restart' | 'stop')
  ipcMain.on('timer:start', (_e, sec) => startTimer(sec));
  ipcMain.on('timer:action', (_e, action) => timerAction(action));
  // 전체 단어 JSON 내보내기: 저장 위치를 물어본 뒤 파일로 기록 → { ok, path } / { ok:false, canceled } / { ok:false, error }
  ipcMain.handle('boss:exportJson', async (_e, text, defaultName) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: '단어 JSON 내보내기',
        defaultPath: path.join(app.getPath('documents'), defaultName || 'words.json'),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePath) return { ok: false, canceled: true };
      fs.writeFileSync(filePath, text, 'utf8');
      return { ok: true, path: filePath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  // 구글 음성(온라인): 구글 번역 '듣기' 음성을 받아 MP3 바이트로 반환 → Uint8Array / 실패 시 null
  // (비공식 주소라 막히거나 바뀔 수 있음 → 렌더러에서 윈도우 음성으로 대체)
  ipcMain.handle('boss:tts', async (_e, text) => {
    try {
      const parts = splitTtsText(String(text || ''));
      if (!parts.length) return null;
      const bufs = [];
      for (const q of parts) {
        const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=' + encodeURIComponent(q);
        const res = await net.fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        bufs.push(Buffer.from(await res.arrayBuffer()));
      }
      return Buffer.concat(bufs);                // MP3 조각은 이어 붙여도 그대로 재생됨
    } catch (_) {
      return null;
    }
  });
  // 사용자가 직접 크기를 바꾸면 꽉 채움 상태 해제 (버튼 표시도 갱신)
  win.on('resize', () => {
    if (settingBounds || !fitState) return;
    fitState = null;
    fitLevel = 0;
    win.webContents.send('fitHeight', 0);
  });
});

// 트레이 앱이므로 모든 창이 닫혀도 종료하지 않음
app.on('window-all-closed', (e) => { /* keep running in tray */ });

// 종료 시: 한국어 입력기로 되돌린 뒤(최대 1.5초 대기) 실제 종료
let imeRestored = false;
app.on('before-quit', (e) => {
  if (imeRestored || !ime.running()) return;
  e.preventDefault();
  imeRestored = true;
  clearTimeout(imeTimer);
  ime.set('ko', winHwnd).finally(() => { ime.stop(); app.quit(); });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  ime.stop();
});
