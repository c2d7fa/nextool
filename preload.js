console.log("preload");

const electron = require("electron");

electron.contextBridge.exposeInMainWorld("platform", {
  async introduce() {
    await electron.ipcRenderer.invoke("showMessageBox", "Running on Electron");
  },
});
