const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

/* ── 단어 저장소: words.json (앱 데이터 폴더, %APPDATA%\gm6) ──────────────
   {
     version: 1,
     nextId: 다음에 쓸 단어 ID,
     words: [{ id, row, kana, kanji, mean, ex?:{ jp, hira, kr }, list }],   // 파일 순서 = 세트 원본 순서
     bookmarks: [단어 ID],
     lists: [{ name, createdAt }],     // 주제 생성 시각 (홈 최신순 정렬용)
     listOrder: [주제명],              // 홈에서 사용자가 지정한 주제 순서
     folders: [{ name, createdAt, lists: [주제명] }],   // 홈의 폴더 (배열 순서 = 표시 순서). 주제는 최대 한 폴더에만 속함
   }
   단어는 고유 ID 로 구분 → 같은 단어가 여러 주제에 있어도, 단어를 수정해도 북마크가 어긋나지 않음.
   저장은 임시 파일에 쓴 뒤 교체(직전 파일은 .bak 으로 보관) → 저장 중 꺼져도 파일이 깨지지 않음.
   처음 실행 시 words.json 이 없으면 기존 words.csv + localStorage(북마크·주제 정보)를 옮겨 만든다. */
const DATA_ARG = '--gm6-data-dir=';
function dataDir() {
  // main.js 가 app.getPath('userData') 를 넘겨줌. 없으면(테스트용 실행 등) 앱 폴더
  const a = process.argv.find(x => x.startsWith(DATA_ARG));
  return a ? a.slice(DATA_ARG.length) : __dirname;
}
const DB_FILE = path.join(dataDir(), 'words.json');
const BAK_FILE = DB_FILE + '.bak';
const TMP_FILE = DB_FILE + '.tmp';

function emptyDb() {
  return { version: 1, nextId: 1, words: [], bookmarks: [], lists: [], listOrder: [], folders: [] };
}

// 저장할 단어 형태로 정리 (예문은 일본어 문장이 있을 때만)
function cleanWord(w, id) {
  const out = { id, row: w.row || '', kana: String(w.kana), kanji: w.kanji || '', mean: w.mean || '', list: w.list || '' };
  if (w.ex && w.ex.jp) out.ex = { jp: w.ex.jp, hira: w.ex.hira || '', kr: w.ex.kr || '' };
  return out;
}

// 읽어온 내용 검증·보정 (ID 없는 단어는 새 ID, 없는 단어를 가리키는 북마크는 제거)
function normalizeDb(raw) {
  if (!raw || !Array.isArray(raw.words)) throw new Error('words 배열 없음');
  const db = emptyDb();
  let maxId = 0;
  raw.words.forEach(w => { if (Number.isInteger(w && w.id) && w.id > maxId) maxId = w.id; });
  db.nextId = Math.max(Number(raw.nextId) || 1, maxId + 1);
  const used = new Set();
  for (const w of raw.words) {
    if (!w || !w.kana) continue;
    let id = Number.isInteger(w.id) && !used.has(w.id) ? w.id : db.nextId++;
    used.add(id);
    db.words.push(cleanWord(w, id));
  }
  db.bookmarks = [...new Set((raw.bookmarks || []).filter(id => used.has(id)))];
  db.lists = (raw.lists || []).filter(m => m && m.name).map(m => ({ name: String(m.name), createdAt: Number(m.createdAt) || 0 }));
  db.listOrder = (raw.listOrder || []).filter(n => typeof n === 'string' && n);
  db.folders = cleanFolders(raw.folders);
  pruneListInfo(db);
  return db;
}

// 폴더 목록 정리: 이름 없는·중복 이름 폴더 제거, 한 주제가 여러 폴더에 있으면 앞 폴더에만 남김
function cleanFolders(folders) {
  const names = new Set();
  const placed = new Set();
  return (Array.isArray(folders) ? folders : []).filter(f => f && String(f.name || '').trim()).map(f => ({
    name: String(f.name).trim(),
    createdAt: Number(f.createdAt) || 0,
    lists: (Array.isArray(f.lists) ? f.lists : []).filter(n => typeof n === 'string' && n && !placed.has(n) && placed.add(n)),
  })).filter(f => !names.has(f.name) && names.add(f.name));
}

// 단어가 하나도 없는 주제의 정보·순서 제거 (옛 데이터가 남아 이름 변경·최신순 정렬을 방해하지 않도록)
function pruneListInfo(db) {
  const names = new Set(db.words.map(w => w.list).filter(Boolean));
  const seen = new Set();
  db.lists = db.lists.filter(m => names.has(m.name) && !seen.has(m.name) && seen.add(m.name));
  db.listOrder = [...new Set(db.listOrder.filter(n => names.has(n)))];
  db.folders.forEach(f => { f.lists = f.lists.filter(n => names.has(n)); });   // 빈 폴더는 그대로 둠
}

function readDbFile(file) {
  try {
    let text = fs.readFileSync(file, 'utf8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    return normalizeDb(JSON.parse(text));
  } catch (_) {
    return null;
  }
}

// 본 파일이 정상인지 (깨진 파일을 .bak 으로 복사해 정상 백업을 덮어쓰지 않도록)
let mainFileOk = true;

// 안전한 저장: 임시 파일에 쓰고 디스크에 확정(fsync) → 직전 파일을 .bak 으로 복사 → 임시 파일로 교체
function writeDb(db) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const fd = fs.openSync(TMP_FILE, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(db, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  if (mainFileOk && fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, BAK_FILE);
  fs.renameSync(TMP_FILE, DB_FILE);
  mainFileOk = true;
}

/* ── 기존 데이터 옮기기 (words.csv + localStorage) ──────────────────────
   CSV 열: row,kana,kanji,mean,ex_jp,ex_hira,ex_kr,list (따옴표로 감싼 RFC4180 형식).
   원본 words.csv 와 localStorage 값은 지우지 않고 그대로 둔다 (백업 겸용). */
function parseCSV(text) {
  const rows = [];
  let field = '', record = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field); field = '';
    } else if (ch === '\r') {
      // 무시 (CRLF 대응)
    } else if (ch === '\n') {
      record.push(field); rows.push(record); record = []; field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || record.length) { record.push(field); rows.push(record); }
  return rows;
}

// 개발 모드면 앱 폴더, 패키징(빌드)되면 resources 폴더의 words.csv
function legacyCsvPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'words.csv'),
    path.join(__dirname, 'words.csv'),
  ];
  for (const c of candidates) {
    try { if (c && fs.existsSync(c)) return c; } catch (_) {}
  }
  return null;
}

function readLocalJson(key, fallback) {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) || 'null');
    return v == null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function migrateLegacy() {
  const db = emptyDb();
  const file = legacyCsvPath();
  if (file) {
    let text = fs.readFileSync(file, 'utf8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = parseCSV(text);
    rows.shift(); // 헤더 행 제거
    for (const r of rows) {
      const [row, kana, kanji, mean, jp, hira, kr, list] = r;
      if (!kana) continue;                        // かな 가 있는 줄만
      db.words.push(cleanWord({ row, kana, kanji, mean, list, ex: jp ? { jp, hira, kr } : null }, db.nextId++));
    }
  }
  // 북마크: 예전엔 'かな|漢字' 키 → 같은 키를 가진 단어(모든 주제)의 ID 로 변환
  const bmKeys = new Set(readLocalJson('vocabBookmarks', []));
  db.bookmarks = db.words.filter(w => bmKeys.has(`${w.kana}|${w.kanji}`)).map(w => w.id);
  const lists = readLocalJson('vocabLists', []);
  db.lists = Array.isArray(lists) ? lists.filter(m => m && m.name).map(m => ({ name: String(m.name), createdAt: Number(m.createdAt) || 0 })) : [];
  const order = readLocalJson('vocabListOrder', []);
  db.listOrder = Array.isArray(order) ? order.filter(n => typeof n === 'string' && n) : [];
  pruneListInfo(db);
  return db;
}

// 시작 시 한 번 읽음. 이후에는 메모리의 db 를 바꾸고 바뀔 때마다 파일에 저장
function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    const main = readDbFile(DB_FILE);
    if (main) return main;
    mainFileOk = false;
    const bak = readDbFile(BAK_FILE);                         // 본 파일이 깨졌으면 직전 백업
    if (bak) {
      console.error('[gm6] words.json 을 읽을 수 없어 직전 백업(words.json.bak)으로 복구합니다.');
      try { writeDb(bak); } catch (_) {}
      return bak;
    }
    // 둘 다 읽을 수 없으면 깨진 파일을 다른 이름으로 보관하고 빈 저장소로 시작
    try { fs.renameSync(DB_FILE, `${DB_FILE}.broken-${Date.now()}`); } catch (_) {}
    console.error('[gm6] words.json 을 읽을 수 없어 빈 저장소로 시작합니다.');
    const db = emptyDb();
    try { writeDb(db); } catch (_) {}
    return db;
  }
  const db = migrateLegacy();
  try { writeDb(db); } catch (e) { console.error('[gm6] words.json 생성 실패:', e.message); }
  return db;
}

let db;
try {
  db = loadDb();
} catch (e) {
  console.error('[gm6] 단어 저장소 읽기 실패:', e.message);
  db = emptyDb();
}

// 메모리 db 를 바꾼 뒤 저장. 저장에 실패하면 바꾸기 전 상태로 되돌림
function commit(mutate) {
  const before = JSON.stringify(db);
  try {
    const result = mutate() || {};
    writeDb(db);
    return { ok: true, ...result };
  } catch (e) {
    db = JSON.parse(before);
    return { ok: false, error: e.message };
  }
}

/* ── 단어 저장소 조작 (렌더러에서 window.boss 로 호출) ── */
// 여러 단어 추가 (CSV 가져오기·개별 추가). 같은 주제 안의 kana+kanji 중복은 제외. 파일 끝에 순서대로 추가
function addWords(list) {
  if (!Array.isArray(list) || !list.length) return { ok: false, error: '추가할 단어 없음' };
  return commit(() => {
    const existing = new Set(db.words.map(w => `${w.kana}|${w.kanji}|${w.list}`));
    const added = [];
    let skipped = 0;
    for (const w of list) {
      if (!w || !w.kana) { skipped++; continue; }
      const nw = cleanWord(w, db.nextId);
      const key = `${nw.kana}|${nw.kanji}|${nw.list}`;
      if (existing.has(key)) { skipped++; continue; }
      existing.add(key);
      db.nextId++;
      db.words.push(nw);
      added.push(nw);
    }
    return { added: added.length, skipped, words: added };
  });
}

// 단어 수정 (ID 그대로, 같은 자리에서 교체 → 순서·북마크 유지)
function updateWord(id, w) {
  if (!w || !w.kana) return { ok: false, error: 'かな 없음' };
  const i = db.words.findIndex(x => x.id === id);
  if (i < 0) return { ok: false, error: '수정할 단어를 찾지 못함' };
  return commit(() => {
    db.words[i] = cleanWord({ ...w, list: db.words[i].list }, id);
    return { word: db.words[i] };
  });
}

// 단어들 삭제 (ID 목록) — 북마크에서도 제거
function removeIds(ids) {
  const set = new Set(ids);
  db.words = db.words.filter(w => !set.has(w.id));
  db.bookmarks = db.bookmarks.filter(id => !set.has(id));
}
function deleteWord(id) {
  if (!db.words.some(w => w.id === id)) return { ok: false, error: '해당 단어를 찾지 못함' };
  return commit(() => { removeIds([id]); });
}

// 특정 리스트(주제)의 단어 전부 삭제. listName='' 이면 개별 단어 전체. 주제 정보·순서도 함께 정리
function deleteList(listName) {
  const target = listName || '';
  return commit(() => {
    const ids = db.words.filter(w => w.list === target).map(w => w.id);
    removeIds(ids);
    if (target) {
      db.lists = db.lists.filter(m => m.name !== target);
      db.listOrder = db.listOrder.filter(n => n !== target);
      db.folders.forEach(f => { f.lists = f.lists.filter(n => n !== target); });
    }
    return { removed: ids.length };
  });
}

// 리스트(주제) 이름 변경 — 소속 단어·주제 정보(생성 시각 유지)·순서를 함께 바꿈. 이미 있는 이름으로는 불가
function renameList(oldName, newName) {
  const from = String(oldName || '');
  const to = String(newName || '').trim();
  if (!from) return { ok: false, error: '개별 단어는 이름을 바꿀 수 없음' };
  if (!to) return { ok: false, error: '새 이름 없음' };
  if (from === to) return { ok: true, renamed: 0 };
  // 중복 여부는 실제 단어가 있는 주제 기준 (단어 없는 옛 주제 정보는 겹쳐도 지우고 진행)
  if (db.words.some(w => w.list === to)) return { ok: false, error: '이미 있는 주제 이름' };
  if (!db.words.some(w => w.list === from)) return { ok: false, error: '해당 주제를 찾지 못함' };
  return commit(() => {
    let renamed = 0;
    db.words.forEach(w => { if (w.list === from) { w.list = to; renamed++; } });
    db.lists = db.lists.filter(m => m.name !== to);
    db.lists.forEach(m => { if (m.name === from) m.name = to; });
    db.listOrder = db.listOrder.filter(n => n !== to).map(n => (n === from ? to : n));
    db.folders.forEach(f => { f.lists = f.lists.filter(n => n !== to).map(n => (n === from ? to : n)); });
    return { renamed };
  });
}

// 모든 단어 삭제
function clearWords() {
  return commit(() => {
    db.words = []; db.bookmarks = []; db.lists = []; db.listOrder = [];
    db.folders.forEach(f => { f.lists = []; });                // 폴더는 남기고 비움
  });
}

// 북마크 / 주제 정보 / 주제 순서 통째로 저장 (렌더러가 가진 현재 상태)
function setBookmarks(ids) {
  return commit(() => {
    const valid = new Set(db.words.map(w => w.id));
    db.bookmarks = [...new Set((ids || []).filter(id => valid.has(id)))];
  });
}
function setLists(lists) {
  return commit(() => {
    db.lists = (lists || []).filter(m => m && m.name).map(m => ({ name: String(m.name), createdAt: Number(m.createdAt) || 0 }));
  });
}
function setListOrder(names) {
  return commit(() => { db.listOrder = (names || []).filter(n => typeof n === 'string' && n); });
}
// 폴더 전체(이름·순서·소속 주제) 저장. 단어가 없는 주제 이름은 제외
function setFolders(folders) {
  return commit(() => {
    db.folders = cleanFolders(folders);
    pruneListInfo(db);
  });
}

// 렌더러(게임)에서 안전하게 호출할 수 있는 최소한의 다리
contextBridge.exposeInMainWorld('boss', {
  hide: () => ipcRenderer.send('boss:hide'),
  // 세로 늘리기 단계 순환 → Promise<number> (0=기본, 1=좀 더 길게, 2=꽉 채움)
  fitHeight: () => ipcRenderer.invoke('boss:fitHeight'),
  // 전체 단어 JSON 내보내기 (저장 대화상자) → Promise<{ ok, path?, canceled?, error? }>
  exportJson: (text, defaultName) => ipcRenderer.invoke('boss:exportJson', text, defaultName),
  // 메인에서 꽉 채움 상태가 바뀌었을 때(사용자가 직접 크기 조절 등) 알림
  onFitHeight: (cb) => ipcRenderer.on('fitHeight', (_e, on) => cb(on)),
  // 메인 프로세스가 보낸 화면 전환 신호 ('home' | 'vocab' | 'flash' | 'quiz' | 'settings')
  onView: (cb) => ipcRenderer.on('view', (_e, v) => cb(v)),
  // 타이머 시작 (초) → 메인이 본 창 아래에 타이머 창을 띄움
  timerStart: (sec) => ipcRenderer.send('timer:start', sec),
  // 구글 음성(온라인) MP3 받아오기 → Promise<Uint8Array|null>
  tts: (text) => ipcRenderer.invoke('boss:tts', text),
  // words.json 에서 읽어온 시작 시점 데이터 { words, bookmarks, lists, listOrder, folders }
  data: { words: db.words, bookmarks: db.bookmarks, lists: db.lists, listOrder: db.listOrder, folders: db.folders },
  // 저장 파일 위치 (안내 표시용)
  dataFile: DB_FILE,
  // 새 단어 한 개 추가 → { ok, word?, error? } (같은 주제에 이미 있으면 ok:false)
  addWord: (w) => {
    const r = addWords([w]);
    if (!r.ok) return r;
    return r.words.length ? { ok: true, word: r.words[0] } : { ok: false, error: '이미 있는 단어' };
  },
  // 여러 단어 일괄 추가 (CSV 가져오기) → { ok, added, skipped, words(ID 포함), error? }
  addWords: (list) => addWords(list),
  // 단어 삭제 (ID) → { ok, error? }
  deleteWord: (id) => deleteWord(id),
  // 리스트(주제) 전체 삭제. name='' 이면 개별 리스트 → { ok, removed, error? }
  deleteList: (name) => deleteList(name),
  // 리스트(주제) 이름 변경 → { ok, renamed, error? }
  renameList: (oldName, newName) => renameList(oldName, newName),
  // 단어 수정 (ID, 새 값) → { ok, word?, error? }
  updateWord: (id, w) => updateWord(id, w),
  // 전체 삭제 → { ok, error? }
  clearWords: () => clearWords(),
  // 북마크(단어 ID 목록) / 주제 정보 / 주제 순서 저장 → { ok, error? }
  setBookmarks: (ids) => setBookmarks(ids),
  setLists: (lists) => setLists(lists),
  setListOrder: (names) => setListOrder(names),
  // 폴더 [{ name, createdAt, lists }] 저장 → { ok, error? }
  setFolders: (folders) => setFolders(folders),
});
