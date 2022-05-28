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
        <title>Nextool – GTD-oriented task manager with support for nested tasks and projects</title>
      </Head>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.logoContainer}>
            <img className={styles.logo} src="/icon.svg" />
            <div className={styles.appName}>Nextool</div>
          </div>
        </header>
        <p className={styles.introduction}>
          Nextool is a GTD-oriented task manager that automates your reviews and lets you plan ahead.
        </p>
        <p style={{textAlign: "center"}}>(Download button)</p>
        <p>
          <strong>Automatically review stalled tasks. </strong> A good task management system requires trust. When
          you add a task, Nextool's algorithm ensures that the task always has actionable next steps. That way, you
          can know for sure that you'll never forget an important task.
        </p>
        <p>
          The GTD workflow requires quick capturing of thoughts, clarifying next actions, and focusing on
          actionable tasks. In pen-and-paper GTD, you have to manually review your tasks to make sure they haven't
          stalled &ndash; with Nextool, the reviews are automated.
        </p>
        <p>
          <strong>Based on what works from GTD.</strong> Etc.
        </p>
        <p>
          <strong>Use nested tasks and projects to plan ahead.</strong> Etc.
        </p>
        <div className={styles.demoContainer}>
          <Nextool.SmallDemo />
        </div>
        <p>
          <Link href="/download">Download for Linux, macOS or Windows.</Link> For now, see{" "}
          <a href="https://github.com/c2d7fa/nextool">the GitHub repository</a> for more information.
        </p>
        <GtdSteps />
        <p>(More in-depth description of what GTD is about, maybe with links to external resources.)</p>
        <p>(Information about author, pricing, etc.)</p>
      </main>

      <script data-goatcounter="https://nextool.goatcounter.com/count" async src="//gc.zgo.at/count.js" />
    </>
  );
}
