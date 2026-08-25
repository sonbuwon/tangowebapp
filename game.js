/* 데이터: words.csv 에서 로드 (preload.js 가 읽어 window.boss.words 로 전달)
   각 항목: { row(오십음 행), kana(히라가나), kanji, mean(한국어 뜻),
            ex?:{ jp(한자문장), hira(히라가나문장), kr(한국어해석) } }
   ▶ 단어 추가/수정은 words.csv 파일을 편집하세요. */
// window.boss.words 는 contextBridge 로 노출된 읽기 전용 배열 → slice() 로 수정 가능한 사본 사용
const WORDS = ((window.boss && window.boss.words) || []).slice();

/* 상태 */
let curMode = "list";
let hideMean = false;
let hideKana = false;
let curRow = "all";        // 행 필터: all / あ / か / ...
let bookmarkOnly = false;  // 북마크만 보기
let currentList = null;    // 선택된 리스트: null=전체, ""=개별 리스트, "제목"=CSV 리스트

/* ===== 리스트 메타(생성시각) — 홈 최신순 정렬용 (localStorage) ===== */
const LISTS_KEY = "vocabLists";
function loadLists() {
  try { return JSON.parse(localStorage.getItem(LISTS_KEY) || "[]"); }
  catch { return []; }
}
function saveLists(a) { localStorage.setItem(LISTS_KEY, JSON.stringify(a)); }
function recordList(name) {                 // CSV 가져오기 시 신규 리스트 기록
  if (!name) return;
  const a = loadLists();
  if (!a.some(x => x.name === name)) { a.push({ name, createdAt: Date.now() }); saveLists(a); }
}

/* ===== 리스트 표시 순서 (사용자가 홈에서 직접 지정, localStorage) ===== */
const ORDER_KEY = "vocabListOrder";
function loadOrder() {
  try { const a = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]"); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function saveOrder(a) { localStorage.setItem(ORDER_KEY, JSON.stringify(a)); }

/* 홈·시험 범위에 공통으로 쓰는 CSV 리스트 정렬.
   순서를 지정한 리스트가 먼저(지정한 순서대로), 아직 지정 안 한 리스트는 그 위에 최신순. */
function orderedListNames() {
  const metaMap = new Map(loadLists().map(m => [m.name, m.createdAt || 0]));
  const names = new Set();
  WORDS.forEach(w => { const l = w.list || ""; if (l) names.add(l); });
  const rank = new Map(loadOrder().map((n, i) => [n, i]));
  return [...names]
    .map(n => ({ name: n, createdAt: metaMap.get(n) || 0, rank: rank.has(n) ? rank.get(n) : -1 }))
    .sort((a, b) => a.rank - b.rank || b.createdAt - a.createdAt || a.name.localeCompare(b.name))
    .map(x => x.name);
}

/* ===== 북마크 (localStorage 저장) ===== */
const BM_KEY = "vocabBookmarks";
function loadBookmarks() {
  try { return new Set(JSON.parse(localStorage.getItem(BM_KEY) || "[]")); }
  catch { return new Set(); }
}
let bookmarks = loadBookmarks();
function wordKey(w) { return `${w.kana}|${w.kanji || ""}`; }
function isBookmarked(w) { return bookmarks.has(wordKey(w)); }
function toggleBookmark(w) {
  const k = wordKey(w);
  if (bookmarks.has(k)) bookmarks.delete(k); else bookmarks.add(k);
  localStorage.setItem(BM_KEY, JSON.stringify([...bookmarks]));
}

/* 행 / 북마크 / 리스트 필터 적용 */
function filteredWords() {
  return WORDS.filter(w =>
    (curRow === "all" || w.row === curRow) &&
    (!bookmarkOnly || isBookmarked(w)) &&
    (currentList === null || (w.list || "") === currentList)
  );
}

/* ===== 목록 모드 ===== */
function renderList() {
  const words = filteredWords();
  document.getElementById("listCount").textContent = `${words.length}개 단어`;
  const body = document.getElementById("listBody");
  body.innerHTML = "";
  if (words.length === 0) {
    body.innerHTML = `<div class="empty-state">${bookmarkOnly ? "북마크한 단어가 없습니다." : "단어가 없습니다."}</div>`;
    return;
  }
  const grid = document.createElement("div");
  grid.className = "grid";
  words.forEach(w => grid.appendChild(makeCard(w)));
  body.appendChild(grid);
}
function makeCard(w) {
  const c = document.createElement("div");
  c.className = "card";
  const blur = 'style="filter:blur(5px);transition:.2s;"';
  const meanStyle = hideMean ? blur : '';
  const kanaStyle = hideKana ? blur : '';
  const marked = isBookmarked(w);
  c.innerHTML = `
    <button class="bm-btn ${marked ? "on" : ""}" title="북마크">${marked ? "★" : "☆"}</button>
    <div class="head">
      ${w.kanji ? `<span class="kanji">${w.kanji}</span>` : ""}
      <span class="kana" ${kanaStyle}>${w.kana}</span>
    </div>
    <div class="mean" ${meanStyle}>${w.mean}</div>`;
  // 북마크 버튼
  const bm = c.querySelector(".bm-btn");
  bm.onclick = (e) => {
    e.stopPropagation();
    toggleBookmark(w);
    const now = isBookmarked(w);
    bm.classList.toggle("on", now);
    bm.textContent = now ? "★" : "☆";
    // 북마크만 보기 상태에서 해제하면 목록에서 즉시 사라지도록
    if (bookmarkOnly && !now) renderList();
  };
  // 가려진 상태에서 카드를 누르면 해당 뜻·히라가나를 드러냄
  c.onclick = () => {
    if (hideMean) c.querySelector(".mean").style.filter = "none";
    if (hideKana) c.querySelector(".kana").style.filter = "none";
  };
  return c;
}

/* ===== 플래시카드 모드 ===== */
let deck = [];
let idx = 0;
function buildDeck() { deck = filteredWords(); idx = 0; }
function renderFlash() {
  buildDeck();
  showCard();
}
function showCard() {
  const fc = document.getElementById("flashcard");
  const bm = document.getElementById("fcBookmark");
  if (deck.length === 0) {
    fc.classList.remove("flipped");
    document.getElementById("fcKana").textContent = "단어 없음";
    document.getElementById("fcKanji").textContent = "";
    document.getElementById("fcMean").textContent = bookmarkOnly ? "북마크한 단어가 없습니다." : "";
    document.getElementById("fcProgress").textContent = "0 / 0";
    bm.style.display = "none";
    return;
  }
  bm.style.display = "flex";
  const w = deck[idx];
  fc.classList.remove("flipped");
  document.getElementById("fcKana").textContent = w.kanji || w.kana;  // 앞면: 한자 우선
  document.getElementById("fcKanji").textContent = w.kana;            // 뒷면: 히라가나 읽는 법
  document.getElementById("fcMean").textContent = w.mean;
  document.getElementById("fcProgress").textContent = `${idx + 1} / ${deck.length}`;
  const marked = isBookmarked(w);
  bm.classList.toggle("on", marked);
  bm.textContent = marked ? "★" : "☆";
}
function flip() { if (deck.length) document.getElementById("flashcard").classList.toggle("flipped"); }
function prev() { if (!deck.length) return; idx = (idx - 1 + deck.length) % deck.length; showCard(); }
function next() { if (!deck.length) return; idx = (idx + 1) % deck.length; showCard(); }
function shuffleDeck() {
  if (!deck.length) return;
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  idx = 0;
  showCard();
}
document.getElementById("flashcard").onclick = flip;
document.getElementById("shuffleBtn").onclick = shuffleDeck;
document.getElementById("prevBtn").onclick = prev;   // 이전 카드
document.getElementById("nextBtn").onclick = next;   // 다음 카드
// 플래시카드 북마크 버튼
document.getElementById("fcBookmark").onclick = (e) => {
  e.stopPropagation();
  if (!deck.length) return;
  const w = deck[idx];
  toggleBookmark(w);
  const now = isBookmarked(w);
  const bm = document.getElementById("fcBookmark");
  bm.classList.toggle("on", now);
  bm.textContent = now ? "★" : "☆";
};

/* ===== 행 / 북마크 필터 ===== */
document.querySelectorAll(".row-btn[data-row]").forEach(b => {
  b.onclick = () => {
    curRow = b.dataset.row;
    document.querySelectorAll(".row-btn[data-row]").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    render();
  };
});
document.getElementById("bmFilter").onclick = () => {
  bookmarkOnly = !bookmarkOnly;
  document.getElementById("bmFilter").classList.toggle("active", bookmarkOnly);
  render();
};

/* ===== 모드 전환 / 뜻 가리기 ===== */
function setMode(mode) {
  curMode = mode;
  document.querySelectorAll(".mode-btn").forEach(x =>
    x.classList.toggle("active", x.dataset.mode === mode));
  document.getElementById("list").style.display = mode === "list" ? "block" : "none";
  document.getElementById("flash").style.display = mode === "flash" ? "block" : "none";
  render();
}
document.querySelectorAll(".mode-btn").forEach(b => {
  b.onclick = () => setMode(b.dataset.mode);
});
document.getElementById("hideMean").onclick = () => {
  hideMean = !hideMean;
  const btn = document.getElementById("hideMean");
  btn.classList.toggle("on", hideMean);
  btn.textContent = hideMean ? "뜻 보이기" : "뜻 가리기";
  if (curMode === "list") renderList();
};
document.getElementById("hideKana").onclick = () => {
  hideKana = !hideKana;
  const btn = document.getElementById("hideKana");
  btn.classList.toggle("on", hideKana);
  btn.textContent = hideKana ? "히라가나 보이기" : "히라가나 가리기";
  if (curMode === "list") renderList();
};

/* ===== 키보드 ===== */
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {            // Esc → 창 즉시 숨김 (Electron)
    window.boss?.hide();
    return;
  }
  // Alt+1~5 → 화면 전환 (전역 단축키가 막혀도 창이 떠 있으면 동작)
  if (e.altKey && ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].includes(e.code)) {
    e.preventDefault();
    setView({ Digit1: "home", Digit2: "vocab", Digit3: "flash", Digit4: "input", Digit5: "quiz" }[e.code]);
    return;
  }
  // 아래 플래시카드 조작키는 단어장 화면·플래시카드 모드에서만
  if (curView !== "vocab" || curMode !== "flash") return;
  if (e.key === "ArrowRight") next();
  if (e.key === "ArrowLeft") prev();
  if (e.key === "ArrowUp") { e.preventDefault(); flip(); }
  if (e.key === "b" || e.key === "B") document.getElementById("fcBookmark").click();
  if (e.ctrlKey && (e.key === "q" || e.key === "Q")) { e.preventDefault(); shuffleDeck(); }  // Ctrl+Q → 섞기
});

/* 상단 ✕ → 창 숨김 */
document.getElementById("hideBtn").addEventListener("click", () => window.boss?.hide());

/* ===== 단어 입력 화면 ===== */
const wordForm = document.getElementById("wordForm");
const inRow = document.getElementById("inRow");
const inKana = document.getElementById("inKana");
const inKanji = document.getElementById("inKanji");
const inMean = document.getElementById("inMean");
const addMsg = document.getElementById("addMsg");
const addBtn = document.getElementById("addBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const editHint = document.getElementById("editHint");

let editingKey = null;   // 수정 중인 원본 단어 { kana, kanji } / null 이면 추가 모드

/* ── かな 첫 글자로 오십음 행 자동 분류 ─────────────────────────── */
const ROW_MEMBERS = {
  "あ": "あいうえおぁぃぅぇぉゔ",
  "か": "かきくけこがぎぐげご",
  "さ": "さしすせそざじずぜぞ",
  "た": "たちつてとだぢづでどっ",
  "な": "なにぬねの",
  "は": "はひふへほばびぶべぼぱぴぷぺぽ",
  "ま": "まみむめも",
  "や": "やゆよゃゅょ",
  "ら": "らりるれろ",
  "わ": "わをんゐゑ",
};
function rowFromKana(kana) {
  if (!kana) return null;
  let c = kana[0];
  const code = c.charCodeAt(0);
  if (code >= 0x30A1 && code <= 0x30F6) c = String.fromCharCode(code - 0x60); // 카타카나 → 히라가나
  for (const row in ROW_MEMBERS) if (ROW_MEMBERS[row].includes(c)) return row;
  return null;
}
// かな 입력 시 행 선택을 자동 갱신
inKana.addEventListener("input", () => {
  const r = rowFromKana(inKana.value.trim());
  if (r) inRow.value = r;
});

function showAddMsg(text, ok) {
  addMsg.textContent = text;
  addMsg.className = ok ? "ok" : "err";
}

// 폼을 추가 모드로 되돌림 (입력값 비우고 라벨 복구)
function resetForm() {
  editingKey = null;
  inKana.value = ""; inKanji.value = ""; inMean.value = "";
  addBtn.textContent = "추가";
  cancelEditBtn.style.display = "none";
  editHint.style.display = "none";
}

wordForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const kana = inKana.value.trim();
  const w = {
    row: rowFromKana(kana) || inRow.value,   // かな 첫 글자로 행 자동 분류
    kana,
    kanji: inKanji.value.trim(),
    mean: inMean.value.trim(),
    list: "",                                // 개별 추가 → 개별 리스트
  };
  if (!w.kana) { showAddMsg("かな를 입력하세요.", false); inKana.focus(); return; }
  if (!w.mean) { showAddMsg("뜻(mean)을 입력하세요.", false); inMean.focus(); return; }

  if (editingKey) {
    // 수정 모드: 자기 자신을 제외한 중복 검사
    const dup = WORDS.some(x =>
      x.kana === w.kana && (x.kanji || "") === w.kanji &&
      !(x.kana === editingKey.kana && (x.kanji || "") === (editingKey.kanji || "")));
    if (dup) { showAddMsg("이미 있는 단어입니다.", false); return; }
    const orig = WORDS.find(x => x.kana === editingKey.kana && (x.kanji || "") === (editingKey.kanji || ""));
    w.list = orig ? (orig.list || "") : "";   // 수정 시 소속 리스트 유지
    const res = window.boss?.updateWord(editingKey, w);
    if (!res || !res.ok) {
      showAddMsg("수정 실패: " + ((res && res.error) || "알 수 없음"), false);
      return;
    }
    const i = WORDS.findIndex(x => x.kana === editingKey.kana && (x.kanji || "") === (editingKey.kanji || ""));
    if (i >= 0) WORDS[i] = w;           // 메모리 목록 갱신
    // 북마크 키가 바뀌었으면 이전(migrate)
    const oldBK = editingKey.kana + "|" + (editingKey.kanji || "");
    if (bookmarks.has(oldBK)) {
      bookmarks.delete(oldBK); bookmarks.add(wordKey(w));
      localStorage.setItem(BM_KEY, JSON.stringify([...bookmarks]));
    }
    showAddMsg(`수정됨 ✓  ${w.kanji || w.kana} — ${w.mean}`, true);
    resetForm();
    renderManageList();
    return;
  }

  // 추가 모드
  if (WORDS.some(x => x.kana === w.kana && (x.kanji || "") === w.kanji)) {
    showAddMsg("이미 있는 단어입니다.", false); return;
  }
  const res = window.boss?.addWord(w);
  if (!res || !res.ok) {
    showAddMsg("저장 실패: " + ((res && res.error) || "알 수 없음"), false);
    return;
  }
  WORDS.push(w);                       // 메모리 목록에도 즉시 반영 (단어장 화면 진입 시 render)
  showAddMsg(`추가됨 ✓  ${w.kanji || w.kana} — ${w.mean}`, true);
  inKana.value = ""; inKanji.value = ""; inMean.value = "";  // 행은 유지
  inKana.focus();
  if (managePanel.style.display !== "none") renderManageList();  // 관리 목록 열려 있으면 갱신
});

cancelEditBtn.onclick = () => { resetForm(); showAddMsg("", true); };

/* ===== CSV 파일에서 가져오기 (일본어단어, 히라가나, 한국어뜻) ===== */
const csvFile = document.getElementById("csvFile");
const importBtn = document.getElementById("importBtn");
importBtn.onclick = () => csvFile.click();
csvFile.onchange = () => {
  const file = csvFile.files[0];
  if (!file) return;
  // 리스트(주제)명 = 파일명(확장자 제거)
  const title = file.name.replace(/\.csv$/i, "");
  const reader = new FileReader();
  reader.onload = () => {
    const buf = new Uint8Array(reader.result);
    let text;
    // UTF-8(BOM) → UTF-8, 아니면 UTF-8 시도 후 깨지면 CP949(euc-kr) 폴백 (한국 엑셀 대비)
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      text = new TextDecoder("utf-8").decode(buf);
    } else {
      const u = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      text = u.includes("�") ? new TextDecoder("euc-kr").decode(buf) : u;
    }
    importCsvText(text, title);
    csvFile.value = "";                 // 같은 파일 다시 선택 가능하도록 초기화
  };
  reader.onerror = () => { showAddMsg("파일을 읽지 못했습니다.", false); csvFile.value = ""; };
  reader.readAsArrayBuffer(file);
};

function parseCsvText(text) {
  const rows = []; let f = "", rec = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { rec.push(f); f = ""; }
    else if (ch === "\r") { /* skip */ }
    else if (ch === "\n") { rec.push(f); rows.push(rec); rec = []; f = ""; }
    else f += ch;
  }
  if (f !== "" || rec.length) { rec.push(f); rows.push(rec); }
  return rows;
}
function isHeaderRow(cells) {
  const kw = ["일본어", "히라가나", "한국어", "뜻", "단어", "kana", "kanji", "mean"];
  return cells.some(c => kw.some(k => (c || "").toLowerCase().includes(k.toLowerCase())));
}
function importCsvText(text, title) {
  const listName = (title || "").trim();
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = parseCsvText(text);
  const candidates = [];
  let headerChecked = false;
  for (const cells of rows) {
    const c0 = (cells[0] || "").trim(), c1 = (cells[1] || "").trim(), c2 = (cells[2] || "").trim();
    if (!c0 && !c1 && !c2) continue;                    // 빈 줄
    if (!headerChecked) { headerChecked = true; if (isHeaderRow(cells)) continue; } // 첫 줄이 헤더면 skip
    // 히라가나 칸이 실제 읽기면 kana=히라가나·한자=일본어, 없거나 '-' 면 kana=일본어·한자 없음
    let kana, kanji;
    if (c1 && c1 !== "-") { kana = c1; kanji = c0; } else { kana = c0; kanji = ""; }
    if (!kana) continue;
    candidates.push({ row: rowFromKana(kana) || "", kana, kanji, mean: c2, list: listName });
  }
  if (!candidates.length) { showAddMsg("가져올 단어가 없습니다.", false); return; }
  // 기존/자체 중복 제외
  const seen = new Set(WORDS.map(w => w.kana + "|" + (w.kanji || "")));
  const fresh = [];
  for (const w of candidates) {
    const k = w.kana + "|" + (w.kanji || "");
    if (seen.has(k)) continue;
    seen.add(k); fresh.push(w);
  }
  if (!fresh.length) { showAddMsg("모두 이미 있는 단어입니다.", false); return; }
  const res = window.boss?.addWords(fresh);
  if (!res || !res.ok) {
    showAddMsg("CSV 추가 실패: " + ((res && res.error) || "알 수 없음"), false);
    return;
  }
  fresh.forEach(w => WORDS.push(w));
  if (listName) recordList(listName);                  // 홈 최신순 정렬용 기록
  const dupCount = candidates.length - fresh.length;
  showAddMsg(`"${listName || "개별 리스트"}"에 ${res.added}개 추가${dupCount ? `, ${dupCount}개 중복 제외` : ""} ✓`, true);
  if (managePanel.style.display !== "none") renderManageList();
}

/* ===== 단어 관리 (목록 + 삭제) ===== */
const manageBtn = document.getElementById("manageBtn");
const managePanel = document.getElementById("managePanel");
const manageList = document.getElementById("manageList");
const manageCount = document.getElementById("manageCount");
const clearAllBtn = document.getElementById("clearAllBtn");

manageBtn.onclick = () => {
  const open = managePanel.style.display === "none";
  managePanel.style.display = open ? "block" : "none";
  manageBtn.textContent = open ? "단어 관리 닫기" : "단어 관리";
  if (open) renderManageList();
};

// 개별 전체 삭제 (개별 리스트 단어만, 되돌릴 수 없으므로 확인)
clearAllBtn.onclick = () => {
  const indivCount = WORDS.filter(w => !(w.list || "")).length;
  if (indivCount === 0) { showAddMsg("삭제할 개별 단어가 없습니다.", false); return; }
  if (!confirm(`개별 리스트 ${indivCount}개 단어를 모두 삭제할까요?\n(CSV 주제는 홈에서 삭제)\n되돌릴 수 없습니다.`)) return;
  const res = window.boss?.deleteList("");           // 소속 없는 개별 단어만 삭제
  if (!res || !res.ok) {
    showAddMsg("개별 전체 삭제 실패: " + ((res && res.error) || "알 수 없음"), false);
    return;
  }
  for (let i = WORDS.length - 1; i >= 0; i--) {
    if (!(WORDS[i].list || "")) { bookmarks.delete(wordKey(WORDS[i])); WORDS.splice(i, 1); }
  }
  localStorage.setItem(BM_KEY, JSON.stringify([...bookmarks]));
  if (currentList === "") currentList = null;
  resetForm();                         // 수정 중이었으면 해제
  showAddMsg("개별 전체 삭제됨 ✓", true);
  renderManageList();
};

function renderManageList() {
  const indiv = WORDS.filter(w => !(w.list || ""));   // 개별 리스트 단어만
  manageCount.textContent = `${indiv.length}개`;
  manageList.innerHTML = "";
  if (indiv.length === 0) {
    manageList.innerHTML = `<div class="empty-state">개별 단어가 없습니다.</div>`;
    return;
  }
  indiv.forEach(w => {
    const row = document.createElement("div");
    row.className = "manage-row";
    row.innerHTML = `
      <span class="m-jp">${w.kanji || w.kana}</span>
      <span class="m-kana">${w.kana}</span>
      <span class="m-mean">${w.mean}</span>
      <span class="m-actions">
        <button class="m-edit" title="수정">✏️</button>
        <button class="m-del" title="삭제">🗑</button>
      </span>`;
    row.querySelector(".m-edit").onclick = () => startEdit(w);
    row.querySelector(".m-del").onclick = () => deleteWord(w);
    manageList.appendChild(row);
  });
}

// 관리 목록의 단어를 입력 폼에 불러와 수정 모드로 전환
function startEdit(w) {
  editingKey = { kana: w.kana, kanji: w.kanji || "" };
  inRow.value = w.row;
  inKana.value = w.kana;
  inKanji.value = w.kanji || "";
  inMean.value = w.mean || "";
  addBtn.textContent = "수정 저장";
  cancelEditBtn.style.display = "";
  editHint.textContent = `수정 중: ${w.kanji || w.kana}`;
  editHint.style.display = "";
  document.getElementById("inputWrap").scrollTop = 0;   // 폼이 보이도록 상단으로
  inKana.focus();
}

function deleteWord(w) {
  const res = window.boss?.deleteWord({ kana: w.kana, kanji: w.kanji || "" });
  if (!res || !res.ok) {
    showAddMsg("삭제 실패: " + ((res && res.error) || "알 수 없음"), false);
    return;
  }
  const i = WORDS.findIndex(x => x.kana === w.kana && (x.kanji || "") === (w.kanji || ""));
  if (i >= 0) WORDS.splice(i, 1);
  bookmarks.delete(wordKey(w));        // 북마크에 있었다면 함께 제거
  localStorage.setItem(BM_KEY, JSON.stringify([...bookmarks]));
  // 수정 중이던 단어를 삭제하면 폼을 추가 모드로 되돌림
  if (editingKey && editingKey.kana === w.kana && (editingKey.kanji || "") === (w.kanji || "")) resetForm();
  showAddMsg(`삭제됨 ✓  ${w.kanji || w.kana}`, true);
  renderManageList();
}

/* ===== 홈 화면 (리스트 목록) ===== */
const homeList = document.getElementById("homeList");
const reorderBtn = document.getElementById("reorderBtn");
const reorderHint = document.getElementById("reorderHint");
let reorderMode = false;   // 켜져 있으면 리스트를 열지 않고 순서만 바꿈

function renderHome() {
  homeList.innerHTML = "";
  // 전체 (최상단) — 모든 단어
  homeList.appendChild(makeDeckRow("전체", null, WORDS.length, false));
  // 개별 리스트 — 주제 삭제 없음(개별 전체 삭제는 단어 관리에서)
  const indivCount = WORDS.filter(w => !(w.list || "")).length;
  homeList.appendChild(makeDeckRow("개별 리스트", "", indivCount, false));
  // CSV 리스트: 사용자가 지정한 순서(없으면 최신순)
  const names = orderedListNames();
  if (names.length < 2) reorderMode = false;          // 바꿀 게 없으면 순서 변경 모드 해제
  const sortWrap = document.createElement("div");
  sortWrap.id = "deckSortable";
  names.forEach(name => {
    const count = WORDS.filter(w => (w.list || "") === name).length;
    sortWrap.appendChild(makeDeckRow(name, name, count, true));  // CSV 리스트는 삭제·순서 변경 가능
  });
  bindDeckSorting(sortWrap);
  homeList.appendChild(sortWrap);

  homeList.classList.toggle("reordering", reorderMode);
  reorderBtn.style.display = names.length >= 2 ? "" : "none";
  reorderBtn.textContent = reorderMode ? "완료" : "순서 변경";
  reorderBtn.classList.toggle("on", reorderMode);
  reorderHint.style.display = reorderMode ? "" : "none";
}

function makeDeckRow(label, listValue, count, deletable) {
  const d = document.createElement("div");
  d.className = "deck-row" + (deletable ? " sortable" : "");
  d.innerHTML = `
    ${deletable ? `<span class="deck-handle" title="끌어서 순서 변경">⠿</span>` : ""}
    <span class="deck-name"></span>
    <span class="deck-right">
      <span class="deck-count">${count}개</span>
      ${deletable ? `
        <span class="deck-move">
          <button class="deck-up" title="위로">▲</button>
          <button class="deck-down" title="아래로">▼</button>
        </span>
        <button class="deck-del" title="주제 삭제">🗑</button>` : ""}
    </span>`;
  d.querySelector(".deck-name").textContent = label;
  d.onclick = () => {
    if (reorderMode) return;                                       // 순서 변경 중에는 열지 않음
    currentList = listValue; setView("vocab");                     // 리스트 선택 → 단어장
  };
  if (deletable) {
    d.dataset.list = listValue;
    d.draggable = reorderMode;
    d.querySelector(".deck-del").onclick = (e) => { e.stopPropagation(); deleteList(listValue, label); };
    d.querySelector(".deck-up").onclick = (e) => { e.stopPropagation(); moveDeck(d, -1); };
    d.querySelector(".deck-down").onclick = (e) => { e.stopPropagation(); moveDeck(d, 1); };
  }
  return d;
}

/* ===== 리스트 순서 변경 ===== */
reorderBtn.onclick = () => { reorderMode = !reorderMode; renderHome(); };

// ▲▼ 버튼: 한 칸 이동
function moveDeck(row, dir) {
  const wrap = row.parentElement;
  if (dir < 0) {
    if (!row.previousElementSibling) return;
    wrap.insertBefore(row, row.previousElementSibling);
  } else {
    if (!row.nextElementSibling) return;
    wrap.insertBefore(row.nextElementSibling, row);
  }
  persistDeckOrder(wrap);
}

// 현재 DOM 순서를 저장
function persistDeckOrder(wrap) {
  saveOrder([...wrap.children].map(el => el.dataset.list).filter(n => n));
}

// 드래그 앤 드롭
let dragRow = null;
function bindDeckSorting(wrap) {
  wrap.querySelectorAll(".deck-row.sortable").forEach(row => {
    row.addEventListener("dragstart", (e) => {
      if (!reorderMode) { e.preventDefault(); return; }
      dragRow = row;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", row.dataset.list || ""); } catch { /* 무시 */ }
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      dragRow = null;
      persistDeckOrder(wrap);
    });
  });
  wrap.addEventListener("dragover", (e) => {
    if (!dragRow) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const after = dropTarget(wrap, e.clientY);
    if (!after) wrap.appendChild(dragRow);
    else if (after !== dragRow) wrap.insertBefore(dragRow, after);
  });
  wrap.addEventListener("drop", (e) => e.preventDefault());
}

// 커서 바로 아래에 있는 행(= 끌고 있는 행을 그 앞에 끼워 넣을 위치), 맨 끝이면 null
function dropTarget(wrap, y) {
  return [...wrap.querySelectorAll(".deck-row:not(.dragging)")].reduce((best, el) => {
    const box = el.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    return (offset < 0 && offset > best.offset) ? { offset, el } : best;
  }, { offset: -Infinity, el: null }).el;
}

// CSV 리스트(주제) 전체 삭제 — 소속 단어 전부 제거
function deleteList(name, label) {
  const count = WORDS.filter(w => (w.list || "") === name).length;
  if (!confirm(`"${label}" 주제의 ${count}개 단어를 모두 삭제할까요?\n되돌릴 수 없습니다.`)) return;
  const res = window.boss?.deleteList(name);
  if (!res || !res.ok) { alert("주제 삭제 실패: " + ((res && res.error) || "알 수 없음")); return; }
  for (let i = WORDS.length - 1; i >= 0; i--) {
    if ((WORDS[i].list || "") === name) { bookmarks.delete(wordKey(WORDS[i])); WORDS.splice(i, 1); }
  }
  localStorage.setItem(BM_KEY, JSON.stringify([...bookmarks]));
  saveLists(loadLists().filter(m => m.name !== name));   // 리스트 메타 제거
  saveOrder(loadOrder().filter(n => n !== name));        // 저장된 순서에서도 제거
  if (currentList === name) currentList = null;
  renderHome();
}

/* ===== 시험 화면 =====
   진입 시 범위(전체 / 개별 / CSV 주제 / 북마크)를 먼저 고르고 랜덤 출제.
   문제: 한자(없으면 かな) → 히라가나 입력 → 채점.
   정답이면 북마크 해제(북마크 단어인 경우), 맞든 틀리든 한국어 뜻 표시. */
const quizPick = document.getElementById("quizPick");
const quizPickList = document.getElementById("quizPickList");
const quizScope = document.getElementById("quizScope");
const quizBackBtn = document.getElementById("quizBackBtn");
const quizWrap = document.getElementById("quizWrap");
const quizProgress = document.getElementById("quizProgress");
const quizWord = document.getElementById("quizWord");
const quizMean = document.getElementById("quizMean");
const quizForm = document.getElementById("quizForm");
const quizInput = document.getElementById("quizInput");
const quizSubmit = document.getElementById("quizSubmit");
const quizResult = document.getElementById("quizResult");
const quizNext = document.getElementById("quizNext");
const quizEmpty = document.getElementById("quizEmpty");

let quizDeck = [];
let quizIdx = 0;
let quizAnswered = false;
let quizScore = 0;

// 카타카나 → 히라가나, 공백 제거 (입력 비교용 정규화)
function normalizeKana(s) {
  return (s || "").trim().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s　]/g, "");
}
// 정답 후보: "し / よん" 처럼 복수 읽기는 각각 인정
function answerCandidates(kana) {
  return String(kana || "").split(/[\/／,、]/).map(normalizeKana).filter(Boolean);
}

/* 시험 범위 선택 화면 (홈 리스트 + 북마크) */
function showQuizPicker() {
  quizPick.style.display = "flex";
  quizWrap.style.display = "none";
  quizPickList.innerHTML = "";
  // 북마크 (최상단)
  const bmCount = WORDS.filter(isBookmarked).length;
  quizPickList.appendChild(makeQuizPickRow("★ 북마크", { type: "bookmark" }, bmCount));
  // 전체
  quizPickList.appendChild(makeQuizPickRow("전체", { type: "list", list: null }, WORDS.length));
  // 개별 리스트
  const indivCount = WORDS.filter(w => !(w.list || "")).length;
  quizPickList.appendChild(makeQuizPickRow("개별 리스트", { type: "list", list: "" }, indivCount));
  // CSV 리스트 (홈과 동일 정렬 — 홈에서 지정한 순서를 따름)
  orderedListNames().forEach(name => {
    const count = WORDS.filter(w => (w.list || "") === name).length;
    quizPickList.appendChild(makeQuizPickRow(name, { type: "list", list: name }, count));
  });
}
function makeQuizPickRow(label, scope, count) {
  const d = document.createElement("div");
  d.className = "deck-row";
  d.innerHTML = `
    <span class="deck-name">${label}</span>
    <span class="deck-right"><span class="deck-count">${count}개</span></span>`;
  d.onclick = () => startQuiz(scope, label);
  return d;
}
quizBackBtn.onclick = showQuizPicker;

// 선택한 범위로 시험 시작
function startQuiz(scope, label) {
  quizPick.style.display = "none";
  quizWrap.style.display = "flex";
  quizScope.textContent = label;
  quizDeck = scope.type === "bookmark"
    ? WORDS.filter(isBookmarked)
    : WORDS.filter(w => scope.list === null || (w.list || "") === scope.list);
  quizDeck = quizDeck.slice();
  for (let i = quizDeck.length - 1; i > 0; i--) {          // 랜덤 셔플
    const j = Math.floor(Math.random() * (i + 1));
    [quizDeck[i], quizDeck[j]] = [quizDeck[j], quizDeck[i]];
  }
  quizIdx = 0; quizScore = 0;
  const has = quizDeck.length > 0;
  quizEmpty.textContent = scope.type === "bookmark"
    ? "북마크한 단어가 없습니다. 단어장에서 ★ 북마크를 먼저 등록하세요."
    : "이 리스트에 단어가 없습니다.";
  quizEmpty.style.display = has ? "none" : "block";
  quizProgress.style.display = has ? "" : "none";
  document.querySelector(".quiz-card").style.display = has ? "" : "none";
  quizForm.style.display = has ? "" : "none";
  if (has) showQuizCard();
  else { quizResult.textContent = ""; quizNext.style.display = "none"; }
}

function showQuizCard() {
  quizAnswered = false;
  const w = quizDeck[quizIdx];
  quizWord.textContent = w.kanji || w.kana;                // 한자 우선, 없으면 かな
  quizMean.textContent = "";                                // 제출 전에는 뜻 숨김
  quizMean.style.visibility = "hidden";
  quizResult.textContent = ""; quizResult.className = "";
  quizInput.value = "";
  quizInput.disabled = false;
  quizSubmit.disabled = false;
  quizNext.style.display = "none";
  quizProgress.textContent = `${quizIdx + 1} / ${quizDeck.length}  ·  정답 ${quizScore}`;
  setTimeout(() => quizInput.focus(), 0);
}

quizForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!quizDeck.length) return;
  if (quizAnswered) { goNextQuiz(); return; }              // 채점 후 Enter → 다음 문제
  const w = quizDeck[quizIdx];
  const input = normalizeKana(quizInput.value);
  if (!input) { quizInput.focus(); return; }
  const correct = answerCandidates(w.kana).includes(input);
  quizAnswered = true;
  quizInput.disabled = true;
  quizSubmit.disabled = true;
  // 맞든 틀리든 한국어 뜻 표시
  quizMean.textContent = w.mean || "";
  quizMean.style.visibility = "visible";
  if (correct) {
    quizScore++;
    // 정답 → 북마크였다면 해제
    const wasBookmarked = isBookmarked(w);
    if (wasBookmarked) {
      bookmarks.delete(wordKey(w));
      localStorage.setItem(BM_KEY, JSON.stringify([...bookmarks]));
    }
    quizResult.textContent = `정답입니다 ✓  ${w.kana}${wasBookmarked ? "  · 북마크 해제됨" : ""}`;
    quizResult.className = "ok";
  } else {
    // 오답 → 북마크에 추가 (이미 있으면 유지)
    const already = isBookmarked(w);
    if (!already) {
      bookmarks.add(wordKey(w));
      localStorage.setItem(BM_KEY, JSON.stringify([...bookmarks]));
    }
    quizResult.textContent = `오답입니다 ✕  정답: ${w.kana}${already ? "" : "  · 북마크 추가됨"}`;
    quizResult.className = "err";
  }
  quizProgress.textContent = `${quizIdx + 1} / ${quizDeck.length}  ·  정답 ${quizScore}`;
  quizNext.style.display = "";
  setTimeout(() => quizNext.focus(), 0);
});

function goNextQuiz() {
  if (quizIdx + 1 >= quizDeck.length) {                    // 마지막 문제 → 결과
    quizProgress.textContent = `완료  ·  ${quizDeck.length}문제 중 ${quizScore}개 정답`;
    quizWord.textContent = "수고하셨습니다";
    quizMean.textContent = "";
    quizMean.style.visibility = "hidden";
    quizResult.textContent = "'범위 변경'을 눌러 다시 시작할 수 있습니다.";
    quizResult.className = "";
    quizForm.style.display = "none";
    quizNext.style.display = "none";
    return;
  }
  quizIdx++;
  showQuizCard();
}
quizNext.onclick = goNextQuiz;

/* ===== 화면 전환 (1 홈 / 2 단어장 / 3 플래시카드 / 4 단어 입력 / 5 시험) =====
   vocab·flash 는 같은 단어장 화면을 쓰되 flash 는 플래시카드 모드로 진입 */
const SCREENS = { home: "homeScreen", vocab: "vocabScreen", flash: "vocabScreen", input: "inputScreen", quiz: "quizScreen" };
const TITLES  = { home: "홈", vocab: "単語", flash: "単語", input: "単語追加", quiz: "試験" };
const ALL_SCREENS = ["homeScreen", "vocabScreen", "inputScreen", "quizScreen"];
let curView = "home";
function setView(view) {
  if (!SCREENS[view]) return;
  const screenId = SCREENS[view];
  // 키보드 가드용 (플래시카드 조작키는 curView === "vocab" 일 때만)
  curView = (view === "input" || view === "home" || view === "quiz") ? view : "vocab";
  ALL_SCREENS.forEach(id => {
    document.getElementById(id).style.display = (id === screenId) ? "flex" : "none";
  });
  // 제목: 단어장/플래시카드는 선택된 리스트명 표시
  let t = TITLES[view] || "";
  if (view === "vocab" || view === "flash") {
    if (currentList === null) t = "전체";
    else if (currentList === "") t = "개별 리스트";
    else t = currentList;
  }
  document.getElementById("title").textContent = t;
  if (view !== "home") reorderMode = false;   // 홈을 벗어나면 순서 변경 모드 해제
  if (view === "home") renderHome();
  else if (view === "flash") setMode("flash");             // 플래시카드 모드로 전환
  else if (view === "vocab") setMode("list");              // 목록 모드로 전환
  else if (view === "input") setTimeout(() => inKana.focus(), 0);
  else if (view === "quiz") showQuizPicker();              // 시험 범위 선택부터
}
window.boss?.onView(setView);

function render() {
  if (curMode === "list") renderList();
  else renderFlash();
}
setView("home");   // 시작 화면: 홈
