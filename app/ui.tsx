import * as React from "react";
import MdiIcon from "@mdi/react";
import * as Mdi from "@mdi/js";

import * as styles from "./ui.module.scss";

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
  | "unfinished";

export type BadgeColor = "green" | "orange" | "project" | "red";

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
  }[icon];
}

export function IconLabel(props: {icon?: Icon; extraSpace?: boolean; children?: React.ReactNode}) {
  return (
    <span className={[styles.iconLabel, props.extraSpace ? styles.extraSpace : ""].join(" ")}>
      {props.icon ? <MdiIcon className={styles.labelIcon} path={iconPath(props.icon)} size="1em" /> : null}
      {props.children}
    </span>
  );
}

export function Badge(props: {color: BadgeColor; icon?: Icon; children: React.ReactNode}) {
  const className = [styles.badge, styles[props.color]].join(" ");
  return (
    <span className={className}>
      <IconLabel icon={props.icon}>{props.children}</IconLabel>
    </span>
  );
}
