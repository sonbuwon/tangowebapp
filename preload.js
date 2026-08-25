const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

/* ── words.csv 읽기 / 파싱 ───────────────────────────────────────
   CSV 열: row,kana,kanji,mean,ex_jp,ex_hira,ex_kr,list
   list = 소속 리스트(주제명). 빈 값이면 '개별 리스트'.
   (mean·예문에 쉼표가 들어가므로 따옴표로 감싼 RFC4180 형식) */
const HEADER = 'row,kana,kanji,mean,ex_jp,ex_hira,ex_kr,list';
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

// 개발 모드면 __dirname, 패키징(빌드)되면 resources 폴더의 words.csv 사용
function csvPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'words.csv'), // 빌드: extraResources 로 복사된 편집 가능한 파일
    path.join(__dirname, 'words.csv'),                   // 개발 모드
  ];
  for (const c of candidates) {
    try { if (c && fs.existsSync(c)) return c; } catch (_) {}
  }
  return candidates[1];
}

function loadWords() {
  try {
    let text = fs.readFileSync(csvPath(), 'utf8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // BOM 제거
    const rows = parseCSV(text);
    rows.shift(); // 헤더 행 제거
    return rows
      .filter(r => r[0] !== undefined && r[0] !== '')
      .map(r => {
        const [row, kana, kanji, mean, jp, hira, kr, list] = r;
        const w = { row, kana, kanji: kanji || '', mean: mean || '', list: list || '' };
        if (jp) w.ex = { jp, hira: hira || '', kr: kr || '' };
        return w;
      });
  } catch (e) {
    console.error('[gm6] words.csv 읽기 실패:', e.message);
    return [];
  }
}

/* ── words.csv 에 단어 한 줄 추가 ────────────────────────────────
   ex_jp/ex_hira/ex_kr 는 빈 값. 같은 row 블록 끝에 삽입해 정렬 유지. */
function csvEscape(v) {
  v = v == null ? '' : String(v);
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
// 단어 한 줄(8열) 생성. ex 3열은 비움, list 는 소속 리스트명
function wordLine(w) {
  return [w.row, w.kana, w.kanji || '', w.mean || '', '', '', '', w.list || ''].map(csvEscape).join(',');
}
function addWordToCsv(w) {
  try {
    if (!w || !w.kana) return { ok: false, error: 'かな 없음' };
    const file = csvPath();
    let text = fs.readFileSync(file, 'utf8');
    let bom = '';
    if (text.charCodeAt(0) === 0xFEFF) { bom = '﻿'; text = text.slice(1); }
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    while (lines.length && lines[lines.length - 1] === '') lines.pop(); // 끝 빈 줄 제거
    const line = wordLine(w);
    // 같은 row 의 마지막 줄 뒤(없으면 맨 끝)에 삽입
    let insertAt = lines.length;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].startsWith(w.row + ',')) insertAt = i + 1;
    }
    lines.splice(insertAt, 0, line);
    fs.writeFileSync(file, bom + lines.join(eol) + eol, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ── words.csv 에 여러 단어 일괄 추가 (CSV 가져오기용, 중복 제외) ── */
function addWordsToCsv(list) {
  try {
    if (!Array.isArray(list) || !list.length) return { ok: false, error: '추가할 단어 없음' };
    const file = csvPath();
    let text = fs.readFileSync(file, 'utf8');
    let bom = '';
    if (text.charCodeAt(0) === 0xFEFF) { bom = '﻿'; text = text.slice(1); }
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    const existing = new Set();
    for (let i = 1; i < lines.length; i++) {
      const p = lines[i].split(',');
      existing.add(p[1] + '|' + (p[2] || ''));
    }
    let added = 0, skipped = 0;
    for (const w of list) {
      if (!w || !w.kana) { skipped++; continue; }
      const key = w.kana + '|' + (w.kanji || '');
      if (existing.has(key)) { skipped++; continue; }
      existing.add(key);
      const line = wordLine(w);
      let insertAt = lines.length;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].startsWith(w.row + ',')) insertAt = i + 1;
      }
      lines.splice(insertAt, 0, line);
      added++;
    }
    fs.writeFileSync(file, bom + lines.join(eol) + eol, 'utf8');
    return { ok: true, added, skipped };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ── words.csv 에서 단어 한 개 삭제 (kana + kanji 로 매칭) ───────── */
function deleteWordFromCsv(key) {
  try {
    if (!key || !key.kana) return { ok: false, error: 'かな 없음' };
    const file = csvPath();
    let text = fs.readFileSync(file, 'utf8');
    let bom = '';
    if (text.charCodeAt(0) === 0xFEFF) { bom = '﻿'; text = text.slice(1); }
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    let removed = 0;
    const kept = lines.filter((l, i) => {
      if (i === 0) return true;                       // 헤더 유지
      const p = l.split(',');                          // kana=col2, kanji=col3 (뜻 앞이라 안전)
      if (p[1] === key.kana && (p[2] || '') === (key.kanji || '')) { removed++; return false; }
      return true;
    });
    if (!removed) return { ok: false, error: '해당 단어를 찾지 못함' };
    fs.writeFileSync(file, bom + kept.join(eol) + eol, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ── words.csv 에서 특정 리스트(주제)의 단어 전부 삭제 ──────────────
   listName='' 이면 개별 리스트(소속 없는 단어) 전체 삭제.
   list 열(col7)은 뜻 뒤라 따옴표 영향 → 전체를 파싱 후 재직렬화. */
function deleteListFromCsv(listName) {
  try {
    const file = csvPath();
    let text = fs.readFileSync(file, 'utf8');
    let bom = '';
    if (text.charCodeAt(0) === 0xFEFF) { bom = '﻿'; text = text.slice(1); }
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const records = parseCSV(text);
    if (!records.length) return { ok: true, removed: 0 };
    const target = listName || '';
    const kept = [records[0]];                         // 헤더 유지
    let removed = 0;
    for (let i = 1; i < records.length; i++) {
      const rec = records[i];
      if (!rec.length || (rec.length === 1 && rec[0] === '')) continue; // 빈 줄
      if ((rec[7] || '') === target) { removed++; continue; }
      kept.push(rec);
    }
    const out = kept.map(r => r.map(csvEscape).join(',')).join(eol) + eol;
    fs.writeFileSync(file, bom + out, 'utf8');
    return { ok: true, removed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ── words.csv 의 단어 수정 (oldKey 줄 제거 후 새 값으로 재삽입) ──── */
function updateWordInCsv(oldKey, w) {
  try {
    if (!oldKey || !oldKey.kana) return { ok: false, error: '원본 키 없음' };
    if (!w || !w.kana) return { ok: false, error: 'かな 없음' };
    const file = csvPath();
    let text = fs.readFileSync(file, 'utf8');
    let bom = '';
    if (text.charCodeAt(0) === 0xFEFF) { bom = '﻿'; text = text.slice(1); }
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    let lines = text.split(/\r?\n/);
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    let removed = 0;
    lines = lines.filter((l, i) => {
      if (i === 0) return true;
      const p = l.split(',');
      if (p[1] === oldKey.kana && (p[2] || '') === (oldKey.kanji || '')) { removed++; return false; }
      return true;
    });
    if (!removed) return { ok: false, error: '수정할 단어를 찾지 못함' };
    const line = wordLine(w);
    let insertAt = lines.length;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].startsWith(w.row + ',')) insertAt = i + 1;
    }
    lines.splice(insertAt, 0, line);
    fs.writeFileSync(file, bom + lines.join(eol) + eol, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ── words.csv 의 모든 단어 삭제 (헤더만 남김) ─────────────────── */
function clearAllWords() {
  try {
    const file = csvPath();
    let text = fs.readFileSync(file, 'utf8');
    let bom = '';
    if (text.charCodeAt(0) === 0xFEFF) { bom = '﻿'; text = text.slice(1); }
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(file, bom + HEADER + eol, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// 렌더러(게임)에서 안전하게 호출할 수 있는 최소한의 다리
contextBridge.exposeInMainWorld('boss', {
  hide: () => ipcRenderer.send('boss:hide'),
  // 메인 프로세스가 보낸 화면 전환 신호 ('vocab' | 'input' | 'sentences')
  onView: (cb) => ipcRenderer.on('view', (_e, v) => cb(v)),
  // words.csv 에서 읽어온 단어 목록
  words: loadWords(),
  // 새 단어를 words.csv 에 추가 → { ok, error? }
  addWord: (w) => addWordToCsv(w),
  // 여러 단어 일괄 추가 (CSV 가져오기) → { ok, added, skipped, error? }
  addWords: (list) => addWordsToCsv(list),
  // 단어 삭제 (kana+kanji) → { ok, error? }
  deleteWord: (key) => deleteWordFromCsv(key),
  // 리스트(주제) 전체 삭제. name='' 이면 개별 리스트 → { ok, removed, error? }
  deleteList: (name) => deleteListFromCsv(name),
  // 단어 수정 (원본 kana+kanji → 새 값) → { ok, error? }
  updateWord: (oldKey, w) => updateWordInCsv(oldKey, w),
  // 전체 삭제 (헤더만 남김) → { ok, error? }
  clearWords: () => clearAllWords(),
});
