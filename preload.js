const electron = require("electron");

electron.contextBridge.exposeInMainWorld("platform", {
  async fileDownload(args) {
    return await electron.ipcRenderer.invoke("fileDownload", args);
  },

  async fileUpload(args) {
    return await electron.ipcRenderer.invoke("fileUpload", args);
  },

  async readLocalStorage() {
    return await electron.ipcRenderer.invoke("readUserData", "tasks.json");
  },

  async saveLocalStorage(value) {
    return await electron.ipcRenderer.invoke("writeUserData", "tasks.json", value);
  },
});
