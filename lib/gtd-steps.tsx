import * as React from "react";
import styles from "./gtd-steps.module.scss";

function Step(props: {title: string; children: React.ReactNode}) {
  return (
    <div className={styles.step}>
      <h1>{props.title}</h1>
      <p>{props.children}</p>
    </div>
  );
}

function TodoFeature(props: {children: React.ReactNode}) {
  return <span className={styles.todo}>{props.children}</span>;
}

export function GtdSteps() {
  return (
    <div className={styles.container} lang="en-US">
      <Step title="1. Capture">
        Capture everything to the <TodoFeature>Inbox</TodoFeature> immediately, so you never have to remember
        anything for longer than it takes to write it down.
      </Step>
      <Step title="2. Clarify">
        To break down larger tasks into actionable chunks, use nested tasks. Nextool highlights non-actionable
        tasks as "stalled".
      </Step>
      <Step title="3. Organize">
        Keep track of projects, use <TodoFeature>due dates</TodoFeature> and <TodoFeature>planning</TodoFeature> to
        schedule tasks, track <TodoFeature>delegated tasks</TodoFeature>.
      </Step>
      <Step title="4. Review">
        Nextool automatically marks tasks as stalled when there's nothing to do. As long as there aren't any
        stalled tasks, you're making progress.
      </Step>
      <Step title="5. Act">
        Use <TodoFeature>contexts</TodoFeature> to show only tasks that can actually be done right now.
      </Step>
    </div>
  );
}
