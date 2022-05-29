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
        <div className={styles.introductionGroup}>
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
        </div>
        <div className={styles.features}>
          <div className={styles.feature}>
            <p>
              You need a system you can trust. That's why Nextool is based on David Allen's proven{" "}
              <i>Getting Things Done</i> methodology. Nextool borrows{" "}
              <span className={styles.highlightGtd}>all the best parts of GTD from other tools</span> like
              OmniFocus or Nirvana, but adds new features that aren't possible with pen-and-paper.
            </p>
          </div>
          <div className={styles.feature}>
            <p>
              Humans are forgetful. To make sure you actually do the things you need to, Nextool{" "}
              <span className={styles.highlightStalled}>automatically identifies and collects stalled tasks</span>,
              so you can waste less time on manual reviews and get back to the stuff that actually matters.
            </p>
          </div>
          <div className={styles.feature}>
            <p>
              Traditional GTD is focused on tasks that are actionable here and now, relegating future plans to the
              infamous <i>Someday</i> list. But thanks to Nextool's{" "}
              <span className={styles.highlightProject}>
                nested projects and arbitrary inter-task dependencies<sup className={styles.wip}>WIP</sup>,
              </span>{" "}
              it can automatically pick out the actionable tasks from the rest.
            </p>
          </div>
        </div>
        <div className={styles.demoContainer}>
          <Nextool.SmallDemo />
        </div>
        <div className={styles.stepsContainer}>
          <GtdSteps />
        </div>
        <p className={styles.author}>
          Nextool is made by <a href="https://johv.dk/">Jonas Hvid</a>. You can write to me at{" "}
          <a href="mailto:jonas@nextool.app">jonas@nextool.app</a>. If you like Nextool, consider{" "}
          <a href="https://ko-fi.com/jonashvid">donating on Ko-Fi</a> &ndash; all donations are appreciated!
        </p>
      </main>

      <script data-goatcounter="https://counter.nextool.app/count" async src="//counter.nextool.app/count.js" />
    </>
  );
}
