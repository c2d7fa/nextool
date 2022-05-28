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

      <main lang="en-US" className={styles.main}>
        <header className={styles.header}>
          <div className={styles.logoContainer}>
            <img className={styles.logo} src="/icon.svg" />
            <div className={styles.appName}>Nextool</div>
          </div>
        </header>
        <p className={styles.introduction}>
          Nextool is a <span className={styles.highlightGtd}>GTD-oriented task manager</span> you can trust.
        </p>
        <p className={styles.introductionSubtitle}>
          Simplify your reviews by{" "}
          <span className={styles.highlightStalled}>automatically identifying stalled tasks</span>, and use{" "}
          <span className={styles.highlightProject}>nested projects</span> to plan ahead with a single tool.
        </p>
        <div className={styles.downloadSection}>
          <div className={styles.buttonContainer}>
            <a className={styles.grey} href="https://github.com/c2d7fa/nextool">
              Source Code
            </a>
          </div>
          <div className={styles.buttonContainer}>
            <a href="/download">Download</a>
          </div>
        </div>
        <div className={styles.features}>
          <div className={styles.feature}>
            <p>
              <span className={styles.highlightGtd}>Based on what works from GTD.</span> The GTD workflow requires
              quick capturing of thoughts, clarifying next actions, and focusing on actionable tasks. In
              pen-and-paper GTD, you have to manually review your tasks to make sure they haven't stalled &ndash;
              with Nextool, the reviews are automated.
            </p>
          </div>
          <div className={styles.feature}>
            <p>
              <span className={styles.highlightStalled}>Automatically review stalled tasks. </span> A good task
              management system requires trust. When you add a task, Nextool's algorithm ensures that the task
              always has actionable next steps. That way, you can know for sure that you'll never forget an
              important task.
            </p>
          </div>
          <div className={styles.feature}>
            <p>
              <span className={styles.highlightProject}>Use nested tasks and projects to plan ahead.</span> This is
              the missing piece from GTD. You need to manually review someday lists, because GTD only focuses on
              right now. With nested tasks, projects, and arbitrary dependencies, you can plan ahead and extend the
              GTD methodology to work even for large projects.
            </p>
          </div>
        </div>
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
        <p>Maybe have list of lists of external resources: Alternatives, resources about GTD, ...?</p>
      </main>

      <script data-goatcounter="https://nextool.goatcounter.com/count" async src="//gc.zgo.at/count.js" />
    </>
  );
}
