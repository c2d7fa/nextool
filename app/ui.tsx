import * as React from "react";
import Icon from "@mdi/react";
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

type BadgeIcon = "project" | "ready" | "stalled" | "today";

function badgeIconPath(icon: BadgeIcon) {
  return {
    project: Mdi.mdiFolderOutline,
    ready: Mdi.mdiCheckboxMarkedCircleOutline,
    stalled: Mdi.mdiHelpCircleOutline,
    today: Mdi.mdiCalendarOutline,
  }[icon];
}

export function Badge(props: {
  color: "green" | "orange" | "project" | "red";
  icon?: BadgeIcon;
  children: React.ReactNode;
}) {
  const className = [styles.badge, styles[props.color]].join(" ");
  return (
    <span className={className}>
      {props.icon ? <Icon className={styles.labelIcon} path={badgeIconPath(props.icon)} size="1em" /> : null}
      <span>{props.children}</span>
    </span>
  );
}
