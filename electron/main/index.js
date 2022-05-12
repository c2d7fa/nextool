import electron from "electron";
import path from "path";
import fs from "fs";

console.log("Waiting for Electron...");

if (process.argv[1] !== "--safe") {
  console.log("Force-enabling GPU acceleration by default. Add '--safe' argument to disable this.");
  electron.app.commandLine.appendSwitch("ignore-gpu-blocklist"); // Not sure which is the real one :)
  electron.app.commandLine.appendSwitch("enable-gpu-rasterization");
  electron.app.commandLine.appendSwitch("use-gl", "desktop");
}

electron.app.whenReady().then(async () => {
  const window = new electron.BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  window.webContents.on("before-input-event", (ev, input) => {
    if (input.key === "F12") {
      window.webContents.toggleDevTools();
    } else if (input.key === "F5") {
      window.webContents.reloadIgnoringCache();
    }
  });

  electron.ipcMain.handle("fileDownload", async (ev, args) => {
    await electron.dialog.showSaveDialog(window, {
      title: "Load tasks",
      filters: [
        {name: "JSON Files", extensions: ["json"]},
        {name: "All Files", extensions: ["*"]},
      ],
      defaultPath: args.name,
    });
  });

  electron.ipcMain.handle("fileUpload", async (ev, args) => {
    const result = await electron.dialog.showOpenDialog(window, {
      title: "Save tasks",
      filters: [
        {name: "JSON Files", extensions: ["json"]},
        {name: "All Files", extensions: ["*"]},
      ],
      properties: ["openFile"],
    });
    if (result.filePaths.length === 0) return null;
    const data = await fs.promises.readFile(result.filePaths[0], "utf8");
    return {name: result.filePaths[0], contents: data.toString()};
  });

  electron.ipcMain.handle("writeUserData", async (ev, fileName, data) => {
    const filePath = path.join(electron.app.getPath("userData"), fileName);
    return await fs.promises.writeFile(filePath, data);
  });

  electron.ipcMain.handle("readUserData", async (ev, fileName) => {
    const filePath = path.join(electron.app.getPath("userData"), fileName);
    try {
      return (await fs.promises.readFile(filePath)).toString();
    } catch (e) {
      return null;
    }
  });

  window.setTitle("Nextool");
  window.removeMenu();
  window.loadFile(path.join(__dirname, "index.html"));
});
