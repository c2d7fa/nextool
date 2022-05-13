import Head from "next/head";
import Link from "next/link";
import {GtdSteps} from "../lib/gtd-steps";
import styles from "../styles/index.module.scss";

import * as Nextool from "nextool-app";
import "nextool-app/dist/index.css";

export default function Index() {
  return (
    <>
      <Head>
        <title>Nextool</title>
      </Head>

      <main className={styles.main}>
        <h1 className={styles.heading}>Nextool</h1>
        <p>
          Nextool is a GTD-oriented task manager with support for nested tasks and a focus on finding actionable
          tasks. It's a work-in-progress that's currently usable but not yet useful.
        </p>
        <div className={styles.demoContainer}>
          <Nextool.SmallDemo />
        </div>
        <p>
          <Link href="/download">Download for Linux, macOS or Windows.</Link> For now, see{" "}
          <a href="https://github.com/c2d7fa/nextool">the GitHub repository</a> for more information.
        </p>
        <GtdSteps />
      </main>

      <script data-goatcounter="https://nextool.goatcounter.com/count" async src="//gc.zgo.at/count.js" />
    </>
  );
}
