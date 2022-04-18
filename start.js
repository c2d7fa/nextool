const electron = require("electron");

console.log("Waiting for Electron...");

electron.app.whenReady().then(async () => {
  const window = new electron.BrowserWindow();
  window.removeMenu();
  window.loadFile("build/index.html");
});
