/* ── 윈도우 입력기(IME) 자동 전환 ─────────────────────────────────
   창에 포커스가 오면 일본어(히라가나), 포커스를 잃으면(숨김·다른 창·종료) 한국어(한글).
   네이티브 모듈 없이 쓰기 위해 PowerShell 도우미 프로세스를 하나 띄워 두고
   표준입력으로 'ja <hwnd>' / 'ko <hwnd>' 명령을 보내 Win32 API 를 호출한다.
   (윈도우 설정에 일본어 키보드(Microsoft IME)가 추가되어 있어야 동작) */
const { spawn } = require('child_process');

const PS_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # 진행률(CLIXML)이 stderr 로 나오지 않게
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class Gm6Ime {
  [DllImport("user32.dll")] static extern int GetKeyboardLayoutList(int n, IntPtr[] list);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
  [DllImport("imm32.dll")] static extern IntPtr ImmGetDefaultIMEWnd(IntPtr hWnd);
  const uint WM_INPUTLANGCHANGEREQUEST = 0x0050, WM_IME_CONTROL = 0x0283, SMTO_ABORTIFHUNG = 0x0002;
  const int IMC_SETCONVERSIONMODE = 0x0002, IMC_SETOPENSTATUS = 0x0006;
  const int LANG_JA = 0x0411, LANG_KO = 0x0412;
  const int MODE_HIRAGANA = 0x19;   // NATIVE | FULLSHAPE | ROMAN (로마자 입력 히라가나)
  const int MODE_HANGUL = 0x01;     // NATIVE (한글)

  // 설치된 입력기 중 언어 ID(하위 16비트)가 같은 것
  static IntPtr FindLayout(int lang) {
    int n = GetKeyboardLayoutList(0, null);
    IntPtr[] list = new IntPtr[n];
    GetKeyboardLayoutList(n, list);
    foreach (IntPtr h in list) if ((h.ToInt64() & 0xFFFF) == lang) return h;
    return IntPtr.Zero;
  }
  static void ImeControl(IntPtr ime, int cmd, int value) {
    IntPtr r;
    SendMessageTimeout(ime, WM_IME_CONTROL, new IntPtr(cmd), new IntPtr(value), SMTO_ABORTIFHUNG, 300, out r);
  }
  static string Apply(IntPtr hwnd, int lang, int mode, int open) {
    if (hwnd == IntPtr.Zero) return "no-window";
    IntPtr hkl = FindLayout(lang);
    if (hkl == IntPtr.Zero) return "no-layout";
    PostMessage(hwnd, WM_INPUTLANGCHANGEREQUEST, IntPtr.Zero, hkl);
    Thread.Sleep(120);                // 입력기 전환이 반영된 뒤에 변환 모드 설정
    IntPtr ime = ImmGetDefaultIMEWnd(hwnd);
    if (ime == IntPtr.Zero) return "no-ime";
    ImeControl(ime, IMC_SETCONVERSIONMODE, mode);
    ImeControl(ime, IMC_SETOPENSTATUS, open);
    return "ok";
  }
  // 우리 창 → 일본어 자판. open=1 이면 히라가나 입력, 0 이면 직접 입력(영숫자)
  //   입력칸에 포커스가 없을 때는 닫아 두어야 S·D·B 같은 단축키가 IME 에 먹히지 않는다
  public static string Ja(long self, int open) { return Apply(new IntPtr(self), LANG_JA, MODE_HIRAGANA, open); }
  // 우리 창의 IME 열림(1=히라가나 입력)/닫힘(0=직접 입력)만 바꿈 (자판은 그대로)
  public static string Open(long self, int open) {
    IntPtr ime = ImmGetDefaultIMEWnd(new IntPtr(self));
    if (ime == IntPtr.Zero) return "no-ime";
    ImeControl(ime, IMC_SETOPENSTATUS, open);
    return "ok";
  }
  // 포커스가 넘어간 창 → 한국어 한글 (그 사이 우리 창이 다시 포커스를 받았으면 건너뜀)
  public static string Ko(long self) {
    Thread.Sleep(150);
    IntPtr fg = GetForegroundWindow();
    if (fg == new IntPtr(self)) return "skip";
    return Apply(fg, LANG_KO, MODE_HANGUL, 1);
  }
}
'@
[Console]::Out.WriteLine('ready')
while ($null -ne ($line = [Console]::In.ReadLine())) {
  $p = $line.Split(' ')
  try {
    if ($p[0] -eq 'ja') { $r = [Gm6Ime]::Ja([long]$p[1], [int]$p[2]) }
    elseif ($p[0] -eq 'open') { $r = [Gm6Ime]::Open([long]$p[1], [int]$p[2]) }
    else { $r = [Gm6Ime]::Ko([long]$p[1]) }
  } catch { $r = 'error ' + $_.Exception.Message }
  [Console]::Out.WriteLine($p[0] + ' ' + $r)
}
`;

let proc = null;
let out = '';
const waiters = [];   // 명령 순서대로 응답 한 줄씩 → 앞에서부터 꺼내 resolve

function start() {
  if (process.platform !== 'win32' || proc) return;
  const encoded = Buffer.from(PS_SCRIPT, 'utf16le').toString('base64');
  try {
    proc = spawn('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    console.warn('[gm6] 입력기 전환 도우미 실행 실패:', e.message);
    proc = null;
    return;
  }
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk) => {
    out += chunk;
    let i;
    while ((i = out.indexOf('\n')) >= 0) {
      const line = out.slice(0, i).trim();
      out = out.slice(i + 1);
      if (!line || line === 'ready') continue;
      if (/ (no-layout|error)/.test(line)) console.warn('[gm6] 입력기 전환:', line);
      const w = waiters.shift();
      if (w) w(line);
    }
  });
  proc.stderr.on('data', (d) => console.warn('[gm6] 입력기 전환 도우미:', String(d).trim()));
  proc.stdin.on('error', () => {});
  proc.on('exit', () => {
    proc = null;
    while (waiters.length) waiters.shift()(null);
  });
}

// cmd: 'ja' | 'ko' | 'open', hwnd: 우리 창 핸들(문자열 숫자) → Promise<응답 줄 | null>
//   'ja'·'open' 은 세 번째 인자로 IME 열림 여부(true=히라가나 입력, false=직접 입력)를 받음
function set(cmd, hwnd, open, timeoutMs = 1500) {
  if (!proc || !hwnd) return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    waiters.push(finish);                 // 시간 초과돼도 자리는 남겨 두어 응답 순서를 유지
    setTimeout(() => finish(null), timeoutMs);
    proc.stdin.write(cmd === 'ko' ? `ko ${hwnd}\n` : `${cmd} ${hwnd} ${open ? 1 : 0}\n`);
  });
}

function running() { return !!proc; }

function stop() {
  if (!proc) return;
  try { proc.stdin.end(); } catch (_) {}
  try { proc.kill(); } catch (_) {}
  proc = null;
}

// BrowserWindow → Win32 HWND 숫자 문자열
function hwndOf(win) {
  if (!win || win.isDestroyed()) return '';
  const b = win.getNativeWindowHandle();
  return (b.length >= 8 ? b.readBigUInt64LE(0) : BigInt(b.readUInt32LE(0))).toString();
}

module.exports = { start, set, running, stop, hwndOf };
