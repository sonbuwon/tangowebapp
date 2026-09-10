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
let currentList = null;    // 선택된 리스트: null=전체, "제목"=CSV 리스트

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
/* 상단 북마크 필터 버튼에 현재 북마크 개수 표시 ('★ 15') */
function updateBmCount() {
  const btn = document.getElementById("bmFilter");
  if (btn) btn.textContent = `★ ${bookmarks.size}`;
}
/* 북마크 저장 + 버튼 개수 갱신 (북마크 변경 시 항상 이 함수 사용) */
function saveBookmarks() {
  localStorage.setItem(BM_KEY, JSON.stringify([...bookmarks]));
  updateBmCount();
}
function toggleBookmark(w) {
  const k = wordKey(w);
  if (bookmarks.has(k)) bookmarks.delete(k); else bookmarks.add(k);
  saveBookmarks();
}
/* 현재 words.csv 에 없는 단어의 북마크 키 정리
   (words.csv 교체·외부 편집 등으로 남은 옛 데이터가 개수에 섞이지 않도록) */
function pruneBookmarks() {
  const valid = new Set(WORDS.map(wordKey));
  let changed = false;
  for (const k of bookmarks) {
    if (!valid.has(k)) { bookmarks.delete(k); changed = true; }
  }
  if (changed) saveBookmarks();
}
pruneBookmarks();
updateBmCount();

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
  // 가려진 뜻·히라가나를 직접 누르면 그 항목만 드러냄 (카드 열기와 구분)
  if (hideMean) c.querySelector(".mean").onclick = (e) => { e.stopPropagation(); e.currentTarget.style.filter = "none"; };
  if (hideKana) c.querySelector(".kana").onclick = (e) => { e.stopPropagation(); e.currentTarget.style.filter = "none"; };
  // 카드 클릭 → 이 단어부터 플래시카드로 열기
  c.onclick = () => openFlashAt(w);
  return c;
}

// 목록에서 고른 단어를 현재 필터 순서 그대로의 플래시카드 덱에서 찾아 그 위치부터 표시
function openFlashAt(w) {
  setMode("flash");                                       // 덱 재구성 (필터 순서 = 목록 순서)
  const key = wordKey(w);
  const i = deck.findIndex(x => wordKey(x) === key);
  if (i > 0) { idx = i; showCard(); }
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
  const exJp = document.getElementById("fcExJp");
  const exHira = document.getElementById("fcExHira");
  const exKr = document.getElementById("fcExKr");
  if (deck.length === 0) {
    fc.classList.remove("revealed");
    document.getElementById("fcKana").textContent = "단어 없음";
    document.getElementById("fcKanji").textContent = "";
    document.getElementById("fcMean").textContent = bookmarkOnly ? "북마크한 단어가 없습니다." : "";
    exJp.textContent = ""; exHira.textContent = ""; exKr.textContent = "";
    document.getElementById("fcProgress").textContent = "0 / 0";
    bm.style.display = "none";
    return;
  }
  bm.style.display = "flex";
  const w = deck[idx];
  fc.classList.remove("revealed");                                    // 새 카드는 일본어만 보이는 상태로
  document.getElementById("fcKana").textContent = w.kanji || w.kana;  // 상단: 한자 우선
  document.getElementById("fcKanji").textContent = w.kana;            // 펼침: 히라가나 읽는 법
  document.getElementById("fcMean").textContent = w.mean;
  // 예문: 첫 화면엔 일본어 문장, 펼치면 히라가나 문장·한국어 해석 (표시 여부는 .show-ex 로 제어)
  const ex = w.ex || {};
  exJp.textContent = ex.jp || "";
  exHira.textContent = ex.hira || "";
  exKr.textContent = ex.kr || "";
  document.getElementById("fcProgress").textContent = `${idx + 1} / ${deck.length}`;
  const marked = isBookmarked(w);
  bm.classList.toggle("on", marked);
  bm.textContent = marked ? "★" : "☆";
}
/* 카드 클릭/↑ → 같은 화면에서 히라가나·뜻 펼치기/접기 */
function flip() { if (deck.length) document.getElementById("flashcard").classList.toggle("revealed"); }
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
// 예문 보기 체크박스 → 카드에 .show-ex 토글 (localStorage 에 저장)
const FC_EX_KEY = "vocabFlashShowEx";
const fcShowEx = document.getElementById("fcShowEx");
function applyShowEx() {
  document.getElementById("flashcard").classList.toggle("show-ex", fcShowEx.checked);
}
fcShowEx.checked = localStorage.getItem(FC_EX_KEY) === "1";
applyShowEx();
fcShowEx.onchange = () => {
  localStorage.setItem(FC_EX_KEY, fcShowEx.checked ? "1" : "0");
  applyShowEx();
};
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
  // 무한 테스트 진행 중: 1~4 보기 선택, Enter 다음 문제, B 북마크 토글
  if (curView === "quiz" && quizInf.style.display !== "none") {
    if (/^[1-4]$/.test(e.key)) {
      const grid = infStep === 0 ? infKanaChoices : infStep === 1 ? infMeanChoices : null;
      const b = grid && grid.children[Number(e.key) - 1];
      if (b) { e.preventDefault(); b.click(); }
      return;
    }
    if (e.key === "Enter" && infStep === 2 && document.activeElement !== quizInfNext) {
      e.preventDefault(); nextInfQuestion(); return;   // 버튼에 포커스가 있으면 기본 클릭으로 처리됨
    }
    if ((e.key === "b" || e.key === "B") && infStep === 2) { quizInfBookmark.click(); return; }
    return;
  }
  // 아래 플래시카드 조작키는 단어장 화면·플래시카드 모드에서만
  if (curView !== "vocab" || curMode !== "flash") return;
  if (e.key === "ArrowRight") next();
  if (e.key === "ArrowLeft") prev();
  if (e.key === "ArrowUp") { e.preventDefault(); flip(); }
  // ↓ → '예문 보기' 체크 설정/해제 (체크박스와 동일하게 저장·반영)
  if (e.key === "ArrowDown") {
    e.preventDefault();
    fcShowEx.checked = !fcShowEx.checked;
    fcShowEx.dispatchEvent(new Event("change"));
  }
  if (e.key === "b" || e.key === "B") document.getElementById("fcBookmark").click();
  if (e.ctrlKey && (e.key === "q" || e.key === "Q")) { e.preventDefault(); shuffleDeck(); }  // Ctrl+Q → 섞기
});

/* 상단 ✕ → 창 숨김 */
document.getElementById("hideBtn").addEventListener("click", () => window.boss?.hide());

/* ===== 단어 입력 화면 (CSV 가져오기 전용) ===== */
const addMsg = document.getElementById("addMsg");

/* ── かな 첫 글자로 오십음 행 자동 분류 (CSV 가져오기 시 row 결정) ── */
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
function showAddMsg(text, ok) {
  addMsg.textContent = text;
  addMsg.className = ok ? "ok" : "err";
}

/* ===== CSV 파일에서 가져오기 (일본어단어, 히라가나, 한국어뜻[, 예문일본어, 예문히라가나, 예문한국어]) ===== */
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
  const kw = ["일본어", "히라가나", "한국어", "뜻", "단어", "예문", "문장", "kana", "kanji", "mean", "ex_"];
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
    // 4~6열: 예문 (일본어 문장, 히라가나 문장, 한국어 해석) — 선택
    const exJp = (cells[3] || "").trim(), exHira = (cells[4] || "").trim(), exKr = (cells[5] || "").trim();
    if (!c0 && !c1 && !c2) continue;                    // 빈 줄
    if (!headerChecked) { headerChecked = true; if (isHeaderRow(cells)) continue; } // 첫 줄이 헤더면 skip
    // 히라가나 칸이 실제 읽기면 kana=히라가나·한자=일본어, 없거나 '-' 면 kana=일본어·한자 없음
    let kana, kanji;
    if (c1 && c1 !== "-") { kana = c1; kanji = c0; } else { kana = c0; kanji = ""; }
    if (!kana) continue;
    const w = { row: rowFromKana(kana) || "", kana, kanji, mean: c2, list: listName };
    if (exJp) w.ex = { jp: exJp, hira: exHira, kr: exKr };   // 예문이 있으면 함께 저장
    candidates.push(w);
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
  showAddMsg(`"${listName}"에 ${res.added}개 추가${dupCount ? `, ${dupCount}개 중복 제외` : ""} ✓`, true);
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
  saveBookmarks();
  saveLists(loadLists().filter(m => m.name !== name));   // 리스트 메타 제거
  saveOrder(loadOrder().filter(n => n !== name));        // 저장된 순서에서도 제거
  if (currentList === name) currentList = null;
  renderHome();
}

/* ===== 시험 화면 =====
   진입 시 종류(입력 / 무한) → 범위(전체 / CSV 주제 / 북마크) → 구간·출제 순서를 고르고 시작.
   입력 테스트: 한자(없으면 뜻) → 히라가나 입력 → 채점. 구간을 한 번씩 출제하고 끝남.
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
const quizBookmark = document.getElementById("quizBookmark");   // 정답 후 수동 북마크 추가
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

// 범위(북마크 / 전체 / CSV 리스트)에 해당하는 단어 — 원본(파일) 순서 유지
function scopeWords(scope) {
  return scope.type === "bookmark"
    ? WORDS.filter(isBookmarked)
    : WORDS.filter(w => scope.list === null || (w.list || "") === scope.list);
}

/* ===== 시험 종류 선택 (입력 테스트 / 무한 테스트) — 마지막 선택을 기억 ===== */
const QUIZ_KIND_KEY = "vocabQuizKind";
let quizKind = localStorage.getItem(QUIZ_KIND_KEY) === "infinite" ? "infinite" : "input";
const quizKindDesc = document.getElementById("quizKindDesc");
const QUIZ_KIND_DESCS = {
  input: "구간을 정한 뒤 한자를 보고 히라가나를 직접 입력합니다. 구간의 단어를 한 번씩 출제하고 끝납니다.",
  infinite: "구간을 정한 뒤 히라가나 → 한국어 뜻 순으로 4지선다 문제를 끝없이 출제합니다.",
};
function applyQuizKind() {
  document.querySelectorAll(".quiz-kind-btn").forEach(b => b.classList.toggle("active", b.dataset.kind === quizKind));
  quizKindDesc.textContent = QUIZ_KIND_DESCS[quizKind];
}
document.querySelectorAll(".quiz-kind-btn").forEach(b => {
  b.onclick = () => { quizKind = b.dataset.kind; localStorage.setItem(QUIZ_KIND_KEY, quizKind); applyQuizKind(); };
});
applyQuizKind();

/* 시험 범위 선택 화면 (홈 리스트 + 북마크) */
function showQuizPicker() {
  quizPick.style.display = "flex";
  quizWrap.style.display = "none";
  quizRange.style.display = "none";
  quizInf.style.display = "none";
  quizPickList.innerHTML = "";
  // 북마크 (최상단)
  const bmCount = WORDS.filter(isBookmarked).length;
  quizPickList.appendChild(makeQuizPickRow("★ 북마크", { type: "bookmark" }, bmCount));
  // 전체
  quizPickList.appendChild(makeQuizPickRow("전체", { type: "list", list: null }, WORDS.length));
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
  // 입력/무한 모두 구간 지정 화면을 거친 뒤 시작
  d.onclick = () => showRangeScreen(scope, label);
  return d;
}
quizBackBtn.onclick = () => {                              // 구간 변경 → 같은 범위의 구간 지정 화면으로
  quizWrap.style.display = "none";
  quizRange.style.display = "flex";
  updateRange();
};
document.getElementById("quizEndBtn").onclick = showQuizPicker;   // 시험 종료 → 시험 홈

// 구간 지정 화면에서 '시작' → 입력 테스트 시작 (순서대로 / 랜덤)
function startInputQuiz() {
  const [lo, hi] = rangeLoHi();
  let deck = rangeWords.slice(lo, hi + 1);
  if (!deck.length) return;
  if (quizOrder === "random") deck = shuffled(deck);
  quizDeck = deck;
  quizRange.style.display = "none";
  quizWrap.style.display = "flex";
  quizScope.textContent = `${rangeLabel}  ·  ${lo + 1}~${hi + 1}번 (${deck.length}개)  ·  ${quizOrder === "random" ? "랜덤" : "순서대로"}`;
  quizIdx = 0; quizScore = 0;
  quizEmpty.style.display = "none";
  quizProgress.style.display = "";
  document.querySelector(".quiz-card").style.display = "";
  quizForm.style.display = "";
  showQuizCard();
}

/* 한자가 없는(또는 かな와 같은) 단어는 문제=정답이 되므로 역방향(뜻 → 히라가나)으로 출제 */
function isReverseQuiz(w) { return !w.kanji || w.kanji === w.kana; }

function showQuizCard() {
  quizAnswered = false;
  const w = quizDeck[quizIdx];
  const reverse = isReverseQuiz(w);
  document.querySelector(".quiz-card").classList.toggle("reverse", reverse);
  quizWord.textContent = reverse ? w.mean : w.kanji;        // 역방향: 한국어 뜻 제시 / 정방향: 한자 제시
  quizMean.textContent = "";                                // 제출 전에는 숨김
  quizMean.style.visibility = "hidden";
  quizResult.textContent = ""; quizResult.className = "";
  quizInput.value = "";
  quizInput.disabled = false;
  quizSubmit.disabled = false;
  quizNext.style.display = "none";
  quizBookmark.style.display = "none";
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
  // 맞든 틀리든 보조 정보 표시: 정방향은 한국어 뜻, 역방향(뜻 제시)은 히라가나
  quizMean.textContent = isReverseQuiz(w) ? w.kana : (w.mean || "");
  quizMean.style.visibility = "visible";
  if (correct) {
    quizScore++;
    // 정답 → 북마크였다면 해제
    const wasBookmarked = isBookmarked(w);
    if (wasBookmarked) {
      bookmarks.delete(wordKey(w));
      saveBookmarks();
    }
    quizResult.textContent = `정답입니다 ✓  ${w.kana}${wasBookmarked ? "  · 북마크 해제됨" : ""}`;
    quizResult.className = "ok";
    // 정답이어도 원하면 수동으로 북마크에 다시 넣을 수 있게 버튼 표시
    quizBookmark.textContent = "☆ 북마크 추가";
    quizBookmark.classList.remove("on");
    quizBookmark.disabled = false;
    quizBookmark.style.display = "";
  } else {
    // 오답 → 북마크에 추가 (이미 있으면 유지)
    const already = isBookmarked(w);
    if (!already) {
      bookmarks.add(wordKey(w));
      saveBookmarks();
    }
    quizResult.textContent = `오답입니다 ✕${already ? "" : "  북마크 추가됨."}`;
    const answerLine = document.createElement("div");
    answerLine.className = "quiz-answer";
    answerLine.textContent = w.kana;
    quizResult.appendChild(answerLine);
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
    quizBookmark.style.display = "none";
    return;
  }
  quizIdx++;
  showQuizCard();
}
quizNext.onclick = goNextQuiz;

// 정답 후 '북마크 추가' → 현재 단어를 북마크에 넣고 버튼을 완료 상태로
quizBookmark.onclick = () => {
  if (!quizAnswered || !quizDeck.length) return;
  const w = quizDeck[quizIdx];
  if (!isBookmarked(w)) {
    bookmarks.add(wordKey(w));
    saveBookmarks();
  }
  quizBookmark.textContent = "★ 북마크 추가됨";
  quizBookmark.classList.add("on");
  quizBookmark.disabled = true;
  quizNext.focus();                                   // Enter로 바로 다음 문제 진행 가능
};

/* ===== 무한 테스트 =====
   범위 선택 → 원본 순서 목록에서 손잡이 2개 슬라이더로 출제 구간 지정 → 시작.
   문제: 일본어 단어 → (1) 히라가나 4지선다 → (2) 한국어 뜻 4지선다. 둘 다 맞아야 정답.
   히라가나 보기는 정답과 비슷하게 생긴 변형(탁점·모음·장음·촉음 등)과 비슷한 실제 읽기로 구성.
   오답 → 북마크 자동 추가. 정답 → 자동 변경 없음(버튼으로 수동 추가/해제). 구간이 다 돌면 다시 섞어 계속. */
const quizRange = document.getElementById("quizRange");
const quizRangeScope = document.getElementById("quizRangeScope");
const quizRangeBackBtn = document.getElementById("quizRangeBackBtn");
const rangeInfo = document.getElementById("rangeInfo");
const rangeSlider = document.getElementById("rangeSlider");
const rangeFill = document.getElementById("rangeFill");
const rangeThumbA = document.getElementById("rangeThumbA");
const rangeThumbB = document.getElementById("rangeThumbB");
const rangeList = document.getElementById("rangeList");
const quizRangeStart = document.getElementById("quizRangeStart");
const quizInf = document.getElementById("quizInf");
const quizInfScope = document.getElementById("quizInfScope");
const quizInfBackBtn = document.getElementById("quizInfBackBtn");
const quizInfProgress = document.getElementById("quizInfProgress");
const quizInfCard = document.getElementById("quizInfCard");
const quizInfWord = document.getElementById("quizInfWord");
const quizInfSub = document.getElementById("quizInfSub");
const infStepKana = document.getElementById("infStepKana");
const infStepMean = document.getElementById("infStepMean");
const infKanaChoices = document.getElementById("infKanaChoices");
const infMeanChoices = document.getElementById("infMeanChoices");
const quizInfResult = document.getElementById("quizInfResult");
const quizInfNext = document.getElementById("quizInfNext");
const quizInfBookmark = document.getElementById("quizInfBookmark");

let rangeScopeSel = null, rangeLabel = "";
let rangeWords = [];                 // 범위 전체 단어 (원본 순서)
let rangeV1 = 0, rangeV2 = 0;      // 손잡이 A/B 위치 (인덱스). 교차 가능 → 작은 쪽이 시작
let infDeck = [];                  // 구간 단어
let infQueue = [];                 // 출제 대기열 (비면 다시 섞음)
let infCur = null;                 // 현재 문제 단어
let infCount = 0, infOk = 0, infBad = 0;
let infStep = 0;                   // 0=히라가나 선택 중, 1=뜻 선택 중, 2=채점 완료
let infKanaOK = false;

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── 출제 순서 (순서대로 / 랜덤) — 마지막 선택을 기억, 입력·무한 테스트 공통 ── */
const QUIZ_ORDER_KEY = "vocabQuizOrder";
let quizOrder = localStorage.getItem(QUIZ_ORDER_KEY) === "seq" ? "seq" : "random";
function applyQuizOrder() {
  document.querySelectorAll(".quiz-order-btn").forEach(b => b.classList.toggle("active", b.dataset.order === quizOrder));
}
document.querySelectorAll(".quiz-order-btn").forEach(b => {
  b.onclick = () => { quizOrder = b.dataset.order; localStorage.setItem(QUIZ_ORDER_KEY, quizOrder); applyQuizOrder(); };
});
applyQuizOrder();

/* ── 구간 지정 화면 (입력/무한 공용) ── */
function showRangeScreen(scope, label) {
  rangeScopeSel = scope; rangeLabel = label;
  rangeWords = scopeWords(scope);
  quizPick.style.display = "none";
  quizWrap.style.display = "none";
  quizInf.style.display = "none";
  quizRange.style.display = "flex";
  quizRangeScope.textContent = `${label}  ·  ${quizKind === "infinite" ? "무한 테스트" : "입력 테스트"}`;
  rangeV1 = 0; rangeV2 = Math.max(0, rangeWords.length - 1);
  renderRangeList();
  updateRange();
}
function rangeLoHi() { return [Math.min(rangeV1, rangeV2), Math.max(rangeV1, rangeV2)]; }
function renderRangeList() {
  rangeList.innerHTML = "";
  if (!rangeWords.length) {
    rangeList.innerHTML = `<div class="empty-state">${rangeScopeSel.type === "bookmark" ? "북마크한 단어가 없습니다." : "이 리스트에 단어가 없습니다."}</div>`;
    return;
  }
  rangeWords.forEach((w, i) => {
    const row = document.createElement("div");
    row.className = "range-row";
    row.innerHTML = `<span class="r-idx">${i + 1}</span><span class="r-jp"></span><span class="r-kana"></span><span class="r-mean"></span>`;
    row.querySelector(".r-jp").textContent = (w.kanji && w.kanji !== w.kana) ? w.kanji : "";
    row.querySelector(".r-kana").textContent = w.kana;
    row.querySelector(".r-mean").textContent = w.mean || "";
    row.onclick = () => moveNearestThumb(i);          // 행 클릭 → 가까운 손잡이를 이 단어로
    rangeList.appendChild(row);
  });
}
function moveNearestThumb(i) {
  if (Math.abs(rangeV1 - i) <= Math.abs(rangeV2 - i)) rangeV1 = i; else rangeV2 = i;
  updateRange(i);
}
function updateRange(scrollTo) {
  const n = rangeWords.length;
  const [lo, hi] = rangeLoHi();
  const pct = i => (n <= 1 ? 0 : (i / (n - 1)) * 100);
  rangeThumbA.style.left = pct(rangeV1) + "%";
  rangeThumbB.style.left = pct(rangeV2) + "%";
  rangeFill.style.left = pct(lo) + "%";
  rangeFill.style.width = (pct(hi) - pct(lo)) + "%";
  if (!n) {
    rangeInfo.textContent = "출제할 단어가 없습니다.";
    quizRangeStart.disabled = true;
    return;
  }
  rangeInfo.textContent = `${lo + 1}번 ~ ${hi + 1}번  ·  ${hi - lo + 1}개 출제`;
  quizRangeStart.disabled = false;
  const rows = rangeList.querySelectorAll(".range-row");
  rows.forEach((row, i) => {
    row.classList.toggle("in", i >= lo && i <= hi);
    row.classList.toggle("edge", i === lo || i === hi);
  });
  if (scrollTo !== undefined && rows[scrollTo]) rows[scrollTo].scrollIntoView({ block: "nearest" });
}
function rangeIndexFromX(clientX) {
  const n = rangeWords.length;
  if (n <= 1) return 0;
  const r = rangeSlider.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  return Math.round(p * (n - 1));
}
// 손잡이 드래그 (pointer capture 로 슬라이더 밖으로 나가도 계속 추적) + 키보드 ←/→
function bindRangeThumb(el, which) {
  let dragging = false;
  const setVal = i => { if (which === 1) rangeV1 = i; else rangeV2 = i; updateRange(i); };
  el.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    dragging = true; el.setPointerCapture(e.pointerId); el.classList.add("active"); el.focus();
  });
  el.addEventListener("pointermove", e => { if (dragging) setVal(rangeIndexFromX(e.clientX)); });
  const end = () => { dragging = false; el.classList.remove("active"); };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("keydown", e => {
    const cur = which === 1 ? rangeV1 : rangeV2, n = rangeWords.length;
    if (e.key === "ArrowLeft") { e.preventDefault(); setVal(Math.max(0, cur - 1)); }
    if (e.key === "ArrowRight") { e.preventDefault(); setVal(Math.min(n - 1, cur + 1)); }
  });
}
bindRangeThumb(rangeThumbA, 1);
bindRangeThumb(rangeThumbB, 2);
// 선(트랙) 클릭 → 가까운 손잡이 이동
rangeSlider.addEventListener("pointerdown", e => moveNearestThumb(rangeIndexFromX(e.clientX)));
quizRangeBackBtn.onclick = showQuizPicker;
quizRangeStart.onclick = () => (quizKind === "infinite" ? startInfQuiz() : startInputQuiz());

/* ── 비슷한 히라가나 보기 생성 ── */
const KANA_ROWS = ["あいうえお", "かきくけこ", "がぎぐげご", "さしすせそ", "ざじずぜぞ", "たちつてと", "だぢづでど",
  "なにぬねの", "はひふへほ", "ばびぶべぼ", "ぱぴぷぺぽ", "まみむめも", "やゆよ", "らりるれろ", "わを"];
const DAKUTEN_PAIRS = [
  ["かきくけこさしすせそたちつてとはひふへほ", "がぎぐげござじずぜぞだぢづでどばびぶべぼ"],
  ["はひふへほ", "ぱぴぷぺぽ"], ["ばびぶべぼ", "ぱぴぷぺぽ"],
];
const SMALL_PAIRS = ["やゃ", "ゆゅ", "よょ", "つっ", "あぁ", "いぃ", "うぅ", "えぇ", "おぉ"];
const SMALL_KANA = "ゃゅょぁぃぅぇぉっ";
// 정답에서 한 군데만 바꾼 변형들.
//   tier 1a = 가장 비슷(탁점·작은 글자 토글·장음), tier 1b = 인접 교환·촉음 삽입,
//   tier 2 = 같은 행 모음 변경, tier 3 = 글자 삭제
//   작은 글자(ゃゅょっ 등) 주변에서는 교환·촉음 삽입을 하지 않아 「っょ」같은 비정상 표기를 막음
function kanaVariants(s) {
  const t1a = new Set(), t1b = new Set(), t2 = new Set(), t3 = new Set();
  const chars = [...s];
  const put = (set, arr) => { const t = arr.join(""); if (t && t !== s) set.add(t); };
  const isSmall = c => SMALL_KANA.includes(c);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    for (const [a, b] of DAKUTEN_PAIRS) {
      let j = a.indexOf(c); if (j >= 0) { const cp = [...chars]; cp[i] = b[j]; put(t1a, cp); }
      j = b.indexOf(c); if (j >= 0) { const cp = [...chars]; cp[i] = a[j]; put(t1a, cp); }
    }
    for (const p of SMALL_PAIRS) { const j = p.indexOf(c); if (j >= 0) { const cp = [...chars]; cp[i] = p[1 - j]; put(t1a, cp); } }
    if (i < chars.length - 1 && c !== chars[i + 1] && !isSmall(c) && !isSmall(chars[i + 1])) {
      const cp = [...chars]; [cp[i], cp[i + 1]] = [cp[i + 1], cp[i]]; put(t1b, cp);
    }
    if (i > 0 && !isSmall(c) && c !== "ん" && chars[i - 1] !== "っ" && chars[i - 1] !== "ん") {
      const cp = [...chars]; cp.splice(i, 0, "っ"); put(t1b, cp);
    }
    if (!isSmall(c)) for (const row of KANA_ROWS) if (row.includes(c)) for (const r of row) if (r !== c) { const cp = [...chars]; cp[i] = r; put(t2, cp); }
    if (chars.length > 1 && !(i < chars.length - 1 && isSmall(chars[i + 1]))) { const cp = [...chars]; cp.splice(i, 1); put(t3, cp); }
  }
  const last = chars[chars.length - 1];
  if ("おこそとのほもよろごぞどぼぽょ".includes(last)) put(t1a, [...chars, "う"]);   // 장음 추가 (お단)
  if ("えけせてねへめれげぜでべぺ".includes(last)) put(t1a, [...chars, "い"]);         // 장음 추가 (え단)
  return [t1a, t1b, t2, t3].map(set => [...set]);
}
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
// 정답 kana 와 비슷한 오답 보기 count 개.
// 변형(tier1a) → 비슷한 실제 읽기 → 변형(tier1b) → 변형(tier2/3) → 무작위 실제 읽기 순으로 채움
function similarKana(kana, count) {
  const used = new Set([kana]);
  const out = [];
  const take = (list) => { for (const k of shuffled(list)) { if (out.length >= count) return; if (!used.has(k)) { used.add(k); out.push(k); } } };
  const [t1a, t1b, t2, t3] = kanaVariants(kana);
  const real = WORDS.map(w => w.kana).filter(k => k && k !== kana);
  const realSimilar = real.filter(k => editDistance(k, kana) <= 2);
  take(t1a); take(realSimilar); take(t1b); take(t2); take(t3); take(real);
  return out;
}
function buildKanaOptions(w) { return shuffled([w.kana, ...similarKana(w.kana, 3)]); }
// 한국어 뜻 보기: 구간 → 범위 → 전체 순으로 다른 뜻을 가져옴
function buildMeanOptions(w) {
  const used = new Set([w.mean]);
  const out = [];
  const take = (list) => { for (const m of shuffled(list)) { if (out.length >= 3) return; if (m && !used.has(m)) { used.add(m); out.push(m); } } };
  take(infDeck.map(x => x.mean)); take(rangeWords.map(x => x.mean)); take(WORDS.map(x => x.mean));
  return shuffled([w.mean, ...out]);
}

/* ── 무한 테스트 진행 ── */
function startInfQuiz() {
  const [lo, hi] = rangeLoHi();
  infDeck = rangeWords.slice(lo, hi + 1);
  if (!infDeck.length) return;
  infQueue = []; infCur = null; infCount = 0; infOk = 0; infBad = 0;
  quizRange.style.display = "none";
  quizInf.style.display = "flex";
  quizInfScope.textContent = `${rangeLabel}  ·  ${lo + 1}~${hi + 1}번 (${infDeck.length}개)  ·  ${quizOrder === "random" ? "랜덤" : "순서대로"}`;
  nextInfQuestion();
}
function nextInfQuestion() {
  if (!infQueue.length) {                                  // 구간을 다 돌면 처음부터 다시 (무한)
    if (quizOrder === "seq") {
      infQueue = infDeck.slice().reverse();                // pop() 으로 꺼내므로 뒤집어 넣음 → 원본 순서
    } else {
      infQueue = shuffled(infDeck);
      if (infDeck.length > 1 && infQueue[infQueue.length - 1] === infCur) {   // 직전 단어 연속 출제 방지
        [infQueue[0], infQueue[infQueue.length - 1]] = [infQueue[infQueue.length - 1], infQueue[0]];
      }
    }
  }
  infCur = infQueue.pop();
  infCount++;
  const w = infCur;
  const kanaOnly = isReverseQuiz(w);                       // 한자 없는 단어: 히라가나 단계 생략, 뜻만 선택
  quizInfCard.classList.toggle("kana-only", kanaOnly);
  quizInfWord.textContent = w.kanji || w.kana;
  quizInfSub.textContent = "";
  quizInfSub.style.visibility = "hidden";
  quizInfResult.textContent = ""; quizInfResult.className = "";
  quizInfNext.style.display = "none";
  quizInfBookmark.style.display = "none";
  infKanaChoices.innerHTML = ""; infMeanChoices.innerHTML = "";
  if (kanaOnly) {
    infStep = 1; infKanaOK = true;
    infStepKana.style.display = "none";
    infStepMean.style.display = "";
    renderChoices(infMeanChoices, buildMeanOptions(w), pickInfMean);
  } else {
    infStep = 0; infKanaOK = false;
    infStepKana.style.display = "";
    infStepMean.style.display = "none";
    renderChoices(infKanaChoices, buildKanaOptions(w), pickInfKana);
  }
  updateInfProgress();
}
function updateInfProgress() {
  quizInfProgress.textContent = `${infCount}번째  ·  정답 ${infOk}  ·  오답 ${infBad}`;
}
function renderChoices(container, options, onPick) {
  container.innerHTML = "";
  options.forEach((opt, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "choice-btn";
    b.innerHTML = `<span class="choice-num">${i + 1}</span><span class="choice-text"></span>`;
    b.querySelector(".choice-text").textContent = opt;
    b.onclick = () => onPick(opt, b);
    container.appendChild(b);
  });
}
// 보기 채점 표시: 정답 보기는 초록, 잘못 고른 보기는 빨강, 전부 비활성
function markChoices(container, correct, picked) {
  container.querySelectorAll(".choice-btn").forEach(b => {
    b.disabled = true;
    const t = b.querySelector(".choice-text").textContent;
    if (t === correct) b.classList.add("ok");
    else if (b === picked) b.classList.add("bad");
  });
}
function pickInfKana(opt, btn) {
  if (infStep !== 0) return;
  infKanaOK = opt === infCur.kana;
  markChoices(infKanaChoices, infCur.kana, btn);
  infStep = 1;
  infStepMean.style.display = "";
  renderChoices(infMeanChoices, buildMeanOptions(infCur), pickInfMean);
}
function pickInfMean(opt, btn) {
  if (infStep !== 1) return;
  const meanOK = opt === infCur.mean;
  markChoices(infMeanChoices, infCur.mean, btn);
  infStep = 2;
  finishInf(infKanaOK && meanOK, meanOK);
}
function finishInf(correct, meanOK) {
  const w = infCur;
  quizInfSub.textContent = `${w.kana}  ·  ${w.mean}`;
  quizInfSub.style.visibility = "visible";
  quizInfResult.textContent = "";
  if (correct) {
    infOk++;
    quizInfResult.textContent = "정답입니다 ✓";
    quizInfResult.className = "ok";
  } else {
    infBad++;
    const already = isBookmarked(w);                      // 오답 → 북마크 자동 추가
    if (!already) { bookmarks.add(wordKey(w)); saveBookmarks(); }
    quizInfResult.textContent = `오답입니다 ✕${already ? "" : "  북마크 추가됨."}`;
    if (!isReverseQuiz(w)) {
      const detail = document.createElement("div");
      detail.className = "quiz-detail";
      detail.textContent = `히라가나 ${infKanaOK ? "○" : "✕"}  ·  뜻 ${meanOK ? "○" : "✕"}`;
      quizInfResult.appendChild(detail);
    }
    quizInfResult.className = "err";
  }
  updateInfProgress();
  updateInfBookmarkBtn();
  quizInfNext.style.display = "";
  setTimeout(() => quizInfNext.focus(), 0);
}
// 무한 테스트의 북마크 버튼은 토글: 추가 ↔ 해제
function updateInfBookmarkBtn() {
  const on = isBookmarked(infCur);
  quizInfBookmark.textContent = on ? "★ 북마크 해제" : "☆ 북마크 추가";
  quizInfBookmark.classList.toggle("on", on);
  quizInfBookmark.style.display = "";
}
quizInfBookmark.onclick = () => {
  if (infStep !== 2 || !infCur) return;
  toggleBookmark(infCur);
  updateInfBookmarkBtn();
  quizInfNext.focus();
};
quizInfNext.onclick = nextInfQuestion;
quizInfBackBtn.onclick = () => {                           // 구간 변경 → 같은 범위의 구간 지정 화면으로
  quizInf.style.display = "none";
  quizRange.style.display = "flex";
  updateRange();
};
document.getElementById("quizInfEndBtn").onclick = showQuizPicker;   // 시험 종료 → 시험 홈(종류·범위 선택)

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
    else t = currentList;
  }
  document.getElementById("title").textContent = t;
  if (view !== "home") reorderMode = false;   // 홈을 벗어나면 순서 변경 모드 해제
  if (view === "home") renderHome();
  else if (view === "flash") setMode("flash");             // 플래시카드 모드로 전환
  else if (view === "vocab") setMode("list");              // 목록 모드로 전환
  else if (view === "quiz") showQuizPicker();              // 시험 범위 선택부터
}
window.boss?.onView(setView);

function render() {
  if (curMode === "list") renderList();
  else renderFlash();
}
setView("home");   // 시작 화면: 홈
