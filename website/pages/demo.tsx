import Head from "next/head";

import * as Nextool from "nextool";
import "nextool/dist/index.css";

export default function Index() {
  return (
    <>
      <Head>
        <title>Nextool</title>
      </Head>

      <Nextool.Main
        platform={{
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
                const file = (ev.target as any).files[0];
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
        }}
      />

      <script data-goatcounter="https://nextool.goatcounter.com/count" async src="//gc.zgo.at/count.js" />
    </>
  );
}
