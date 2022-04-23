const electron = require("electron");
const path = require("path");

console.log("Waiting for Electron...");

if (process.argv[1] !== "--safe") {
  console.log("Force-enabling GPU acceleration by default. Add '--safe' argument to disable this.");
  electron.app.commandLine.appendSwitch('ignore-gpu-blocklist'); // Not sure which is the real one :)
  electron.app.commandLine.appendSwitch('enable-gpu-rasterization');
  electron.app.commandLine.appendSwitch('use-gl', 'desktop');
}

electron.app.whenReady().then(async () => {
  const window = new electron.BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  electron.ipcMain.handle("fileDownload", async (ev, args) => {
    await electron.dialog.showSaveDialog(window, {
      title: "Load tasks",
      filters: [{name: "JSON Files", extensions: ["json"]}, {name: "All Files", extensions: ["*"]}],
      defaultPath: args.name,
    });
  });

  electron.ipcMain.handle("fileUpload", async (ev, args) => {
    const result = await electron.dialog.showOpenDialog(window, {
      title: "Save tasks",
      filters: [{name: "JSON Files", extensions: ["json"]}, {name: "All Files", extensions: ["*"]}],
      properties: ["openFile"],
    });

    if (result.filePaths.length === 0) return null;

    return result.filePaths[0];
  });

  window.setTitle("Nextool");
  window.removeMenu();
  window.loadFile("build/electron.html");
});
