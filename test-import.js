const { app, BrowserWindow } = require('electron');
const path = require('path'), fs=require('fs');
const csvText = fs.readFileSync('C:\Users\bwgh0\AppData\Local\Temp/import_test.csv');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false, webPreferences:{ preload: path.join(__dirname,'preload.js'), contextIsolation:true, nodeIntegration:false, sandbox:false }});
  setTimeout(()=>{ console.log('FORCE QUIT'); app.quit(); }, 10000);
  await win.loadFile('index.html');
  await new Promise(r=>setTimeout(r,400));
  const g="document.getElementById";
  // 파일 선택 대신 importCsvText 를 직접 호출 (디코딩 포함 로직은 별도지만 여기선 UTF-8 텍스트로 검증)
  const decoded = csvText.slice(0,3).toString('hex')==='efbbbf' ? csvText.slice(3).toString('utf8') : csvText.toString('utf8');
  const r = await win.webContents.executeJavaScript(`(()=>{
    importCsvText(${JSON.stringify(decoded)});
    return {msg:${g}('addMsg').textContent, cls:${g}('addMsg').className, wordsLen:(window.boss.words||[]).length};
  })()`);
  console.log('IMPORT ->', JSON.stringify(r));
  app.quit();
});
app.on('window-all-closed',()=>{});
