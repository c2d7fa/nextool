console.log("preload");

const electron = require("electron");

electron.contextBridge.exposeInMainWorld("platform", {
  async fileDownload(args) {
    return await electron.ipcRenderer.invoke("fileDownload", args);
  },

  async fileUpload(args) {
    return await electron.ipcRenderer.invoke("fileUpload", args);
  },
});
