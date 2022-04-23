const electron = require("electron");

electron.contextBridge.exposeInMainWorld("platform", {
  async fileDownload(args) {
    return await electron.ipcRenderer.invoke("fileDownload", args);
  },

  async fileUpload(args) {
    return await electron.ipcRenderer.invoke("fileUpload", args);
  },

  async readLocalStorage() {
    return localStorage.getItem("tasks");
  },

  async saveLocalStorage(value) {
    return localStorage.setItem("tasks", value);
  },
});
