/* 타이머 창: 메인 프로세스가 보내는 남은 시간·상태를 표시하고 버튼 동작만 전달 */
const wrap = document.getElementById("wrap");
const timeEl = document.getElementById("time");
const toggleBtn = document.getElementById("toggleBtn");

const pad = (n) => String(n).padStart(2, "0");
function fmt(sec) {
  return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
}

window.timer.onState(({ sec, state }) => {
  timeEl.textContent = fmt(sec);
  wrap.className = state;
  toggleBtn.textContent = state === "running" ? "일시정지" : "계속";
  toggleBtn.disabled = state === "done";           // 00:00:00 이면 계속할 시간이 없음
});

toggleBtn.onclick = () => window.timer.action("toggle");
document.getElementById("restartBtn").onclick = () => window.timer.action("restart");
document.getElementById("stopBtn").onclick = () => window.timer.action("stop");
