/* 타이머 창: 메인 프로세스가 보내는 상태를 표시하고 버튼 동작만 전달.
   동작 중에는 받은 종료 시각(endAt)으로 매 프레임 남은 시간을 계산해 1/100초까지 표시 */
const wrap = document.getElementById("wrap");
const timeEl = document.getElementById("time");
const hintEl = document.getElementById("hint");
const toggleBtn = document.getElementById("toggleBtn");
const restartBtn = document.getElementById("restartBtn");
const stopBtn = document.getElementById("stopBtn");

let cur = { remaining: 0, endAt: 0, state: "stopped" };
let raf = 0;

const pad = (n) => String(n).padStart(2, "0");
// ms → "시:분:초" + ".1/100초" (남은 시간이라 올림: 시작 때 설정 시간 그대로, 끝에서 정확히 0)
function render() {
  const ms = cur.state === "running" ? Math.max(0, cur.endAt - Date.now()) : cur.remaining;
  const cs = Math.ceil(ms / 10);
  const sec = Math.floor(cs / 100);
  timeEl.firstChild.textContent = `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
  timeEl.lastChild.textContent = `.${pad(cs % 100)}`;
  raf = cur.state === "running" ? requestAnimationFrame(render) : 0;
}

// 버튼 이름 (상태에 따라 바뀜) → 마우스를 올렸을 때 hint 에 표시
function btnName(btn) {
  if (btn === toggleBtn) return cur.state === "running" ? "일시정지" : "계속";
  if (btn === restartBtn) return "재시작";
  return cur.state === "stopped" ? "타이머 끄기" : "정지";
}
let hovered = null;
function updateHint() { hintEl.textContent = hovered && !hovered.disabled ? btnName(hovered) : ""; }
[toggleBtn, restartBtn, stopBtn].forEach(btn => {
  btn.addEventListener("mouseenter", () => { hovered = btn; updateHint(); });
  btn.addEventListener("mouseleave", () => { if (hovered === btn) hovered = null; updateHint(); });
});

window.timer.onState((s) => {
  cur = s;
  cancelAnimationFrame(raf);
  wrap.className = s.state;
  toggleBtn.textContent = s.state === "running" ? "⏸️" : "▶️";
  toggleBtn.disabled = s.state === "done";         // 00:00:00.00 이면 계속할 시간이 없음
  [toggleBtn, stopBtn].forEach(b => b.setAttribute("aria-label", btnName(b)));
  updateHint();
  render();
});

// 본 창이 숨겨져 타이머 창만 남으면 끌어서 옮길 수 있게 (끌기 영역은 CSS 에서 지정)
window.timer.onAlone((alone) => document.body.classList.toggle("alone", alone));

toggleBtn.onclick =() => window.timer.action("toggle");
restartBtn.onclick = () => window.timer.action("restart");
stopBtn.onclick = () => window.timer.action("stop");
