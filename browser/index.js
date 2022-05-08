import {start} from "../app/main";

start({
  async readLocalStorage() {
    return localStorage.getItem("tasks");
  },

  async saveLocalStorage(value) {
    return localStorage.setItem("tasks", value);
  },

  async fileDownload({name, contents}) {
    const downloadLinkElement = document.createElement("a");
    downloadLinkElement.setAttribute("href", URL.createObjectURL(new Blob([contents])));
    downloadLinkElement.setAttribute("download", name);
    downloadLinkElement.click();
  },

  async fileUpload() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.onchange = (ev) => {
        const file = ev.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          const contents = ev.target.result;
          resolve({name: file.name, contents});
        };
        reader.readAsText(file);
      };
      input.click();
    });
  },
});