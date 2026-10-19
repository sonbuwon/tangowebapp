const { contextBridge, ipcRenderer } = require('electron');

// 타이머 창 ↔ 메인 프로세스 (시간 계산은 메인에서, 이 창은 표시와 버튼만)
contextBridge.exposeInMainWorld('timer', {
  // 상태 수신: { sec: 남은 초, state: 'running' | 'paused' | 'stopped' | 'done' }
  onState: (cb) => ipcRenderer.on('timer:state', (_e, s) => cb(s)),
  // 버튼: 'toggle'(일시정지/계속) | 'restart'(재시작) | 'stop'(정지 → 한 번 더 누르면 끄기)
  action: (name) => ipcRenderer.send('timer:action', name),
});
