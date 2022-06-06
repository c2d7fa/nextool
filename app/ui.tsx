import * as React from "react";
import MdiIcon from "@mdi/react";
import * as Mdi from "@mdi/js";

import * as styles from "./ui.module.scss";

import * as Tasks from "./tasks";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & {color?: "magenta"}) {
  const className = [styles.button, props.className, props.color ? styles[props.color] : ""].join(" ");
  return (
    <div className={styles.buttonContainer}>
      <button {...props} className={className} />
    </div>
  );
}

export type Icon =
  | "project"
  | "ready"
  | "stalled"
  | "today"
  | "paused"
  | "completed"
  | "allTasks"
  | "archive"
  | "unfinished"
  | "waiting"
  | "due";

export type BadgeColor = "green" | "orange" | "project" | "red" | "grey";

function iconPath(icon: Icon) {
  return {
    project: Mdi.mdiFolderOutline,
    ready: Mdi.mdiChevronRightCircleOutline,
    stalled: Mdi.mdiHelpCircleOutline,
    today: Mdi.mdiCalendarOutline,
    paused: Mdi.mdiPauseCircleOutline,
    completed: Mdi.mdiCheckCircleOutline,
    allTasks: Mdi.mdiCheckboxMultipleMarkedOutline,
    archive: Mdi.mdiArchiveOutline,
    unfinished: Mdi.mdiMinusCircleOutline,
    waiting: Mdi.mdiCalendarClockOutline,
    due: Mdi.mdiCalendarAlert,
  }[icon];
}

export function IconLabel(props: {icon?: Icon; extraSpace?: boolean; children?: React.ReactNode}) {
  return (
    <span className={[styles.iconLabel, props.extraSpace ? styles.extraSpace : ""].join(" ")}>
      {props.icon ? <MdiIcon path={iconPath(props.icon)} size="1em" /> : null}
      {props.children}
    </span>
  );
}

export function Badge(props: {badge: Tasks.Badge}) {
  const className = [styles.badge, styles[props.badge.color]].join(" ");
  return (
    <span className={className}>
      <IconLabel icon={props.badge.icon}>{props.badge.label}</IconLabel>
    </span>
  );
}
