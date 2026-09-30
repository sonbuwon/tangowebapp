// npm start 진입점: 모니터가 2개 이상이면 터미널에서 어느 화면에 띄울지 물어본 뒤 Electron 실행.
// Electron 프로세스는 Windows 콘솔에서 키보드 입력(stdin)을 못 받는 경우가 있어, 입력은 여기(Node)에서 받음.
// 콘솔 문구는 영어로 출력 (Windows 콘솔 코드 페이지 949 에서 한글이 깨지므로)
const { spawn, spawnSync } = require('child_process');
const readline = require('readline');
const electron = require('electron');   // electron 실행 파일 경로

// 1) 모니터 목록: Electron 을 --list-displays 로 잠깐 실행해 JSON 을 받아옴
function listDisplays() {
  try {
    const r = spawnSync(electron, ['.', '--list-displays'], { cwd: __dirname, encoding: 'utf8' });
    const line = String(r.stdout || '').split(/\r?\n/).find(l => l.startsWith('DISPLAYS:'));
    return line ? JSON.parse(line.slice('DISPLAYS:'.length)) : [];
  } catch {
    return [];
  }
}

// 2) 번호 입력받기 (엔터만 누르면 주 모니터, 입력이 닫히면 주 모니터)
function ask(list) {
  // 왼쪽 → 오른쪽, 위 → 아래 순으로 번호 매김
  list.sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
  const defIdx = Math.max(0, list.findIndex(d => d.primary));
  console.log(`\n${list.length} monitors detected. Which screen should the app open on?`);
  list.forEach((d, i) => {
    const { width, height, x, y } = d.bounds;
    console.log(`  ${i + 1}) ${width}x${height}  (position ${x},${y})${d.primary ? '  [primary]' : ''}`);
  });
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let done = false;
    const finish = (i) => {
      if (done) return;
      done = true;
      rl.close();
      console.log(`-> Opening on screen ${i + 1}.\n`);
      resolve(list[i]);
    };
    const q = () => rl.question(`Enter number (1-${list.length}, Enter = ${defIdx + 1}): `, (ans) => {
      const s = ans.trim();
      if (!s) return finish(defIdx);
      const n = Number(s);
      if (Number.isInteger(n) && n >= 1 && n <= list.length) return finish(n - 1);
      console.log('  Invalid number. Please try again.');
      q();
    });
    rl.on('close', () => finish(defIdx));
    q();
  });
}

// 3) 선택한 모니터 id 를 넘겨 Electron 실행 (종료 코드 그대로 전달)
(async () => {
  const list = listDisplays();
  const args = ['.'];
  if (list.length >= 2) {
    const d = await ask(list);
    args.push(`--display-id=${d.id}`);
  }
  const child = spawn(electron, args, { cwd: __dirname, stdio: 'inherit' });
  child.on('close', (code) => process.exit(code ?? 0));
  const stop = () => { if (!child.killed) child.kill(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})();
