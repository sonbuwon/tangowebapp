const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');

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
const KEY_INPUT  = 'Alt+5';           // 단어 입력 화면으로 전환
// ───────────────────────────────────────────────────────────────

let win = null;
let tray = null;
let visible = false;

function cornerPosition() {
  const { workArea } = screen.getPrimaryDisplay(); // 작업표시줄 제외 영역
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

// 주 모니터 중앙 좌표 (작업표시줄 제외 영역 기준, 화면 밖으로 나가지 않게 보정)
function centerPosition() {
  const { workArea } = screen.getPrimaryDisplay();
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
      sandbox: false,        // preload 에서 words.csv 읽기(fs) 허용
    },
  });

  win.loadFile('index.html');

  // 닫기 버튼/Alt+F4를 눌러도 종료 대신 숨김 (트레이에 살아있음)
  win.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      hide();
    }
  });
}

function show() {
  if (!win) return;
  win.show();          // 마지막 위치 그대로 복구 (모서리 배치는 최초 생성 시 1회만)
  win.focus();
  visible = true;
}

function hide() {
  if (!win) return;
  win.hide();
  visible = false;
}

function toggle() {
  visible ? hide() : show();
}

// ── 세로 꽉 채우기 토글 ──────────────────────────────────────────
// 켜면 창이 있는 모니터의 작업 영역(작업표시줄 제외) 높이에 맞춰 위아래로 늘리고,
// 다시 누르면 이전 크기·위치로 복구. 사용자가 직접 크기를 바꾸면 상태를 해제.
let fitState = null;        // { x, y, width, height } 복구용 (null 이면 꺼짐)
let settingBounds = false;  // 우리가 setBounds 하는 동안 resize 이벤트 무시용
function toggleFitHeight() {
  if (!win) return false;
  settingBounds = true;
  try {
    if (fitState) {
      win.setBounds(fitState);
      fitState = null;
    } else {
      const cur = win.getBounds();
      const { workArea } = screen.getDisplayMatching(cur);
      fitState = cur;
      win.setBounds({ x: cur.x, y: workArea.y, width: cur.width, height: workArea.height });
    }
  } finally {
    settingBounds = false;
  }
  return !!fitState;
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
    { label: `단어 입력  (${KEY_INPUT})`, click: () => switchView('input') },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', toggle); // 트레이 아이콘 클릭으로도 토글
}

app.whenReady().then(() => {
  createWindow();
  buildTray();

  // 등록 실패(다른 앱이 선점) 시 경고 출력
  const reg = (key, fn) => {
    if (!globalShortcut.register(key, fn)) {
      console.warn(`[gm6] 단축키 등록 실패: ${key} (다른 프로그램이 사용 중일 수 있음)`);
    }
  };
  reg(KEY_TOGGLE, toggle);
  reg(KEY_PANIC, hide);
  reg(KEY_HOME, () => switchView('home'));
  reg(KEY_VOCAB, () => switchView('vocab'));
  reg(KEY_FLASH, () => switchView('flash'));
  reg(KEY_INPUT, () => switchView('input'));
  reg(KEY_QUIZ, () => switchView('quiz'));

  // 렌더러(게임 화면)에서 Esc를 누르면 숨김 요청이 옴
  ipcMain.on('boss:hide', hide);
  // 제목 표시줄 '세로 꽉 채우기' 버튼 → 토글 후 현재 상태(true=켜짐) 반환
  ipcMain.handle('boss:fitHeight', () => toggleFitHeight());
  // 사용자가 직접 크기를 바꾸면 꽉 채움 상태 해제 (버튼 표시도 갱신)
  win.on('resize', () => {
    if (settingBounds || !fitState) return;
    fitState = null;
    win.webContents.send('fitHeight', false);
  });
});

// 트레이 앱이므로 모든 창이 닫혀도 종료하지 않음
app.on('window-all-closed', (e) => { /* keep running in tray */ });

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
