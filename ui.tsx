import * as React from "react";

import * as styles from "./ui.module.scss";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const className = [styles.button, props.className].join(" ");
  return (
    <div className={styles.buttonContainer}>
      <button {...props} className={className} />
    </div>
  );
}

export function Badge(props: {color: "green" | "orange" | "project"; children: React.ReactNode}) {
  const className = [styles.badge, styles[props.color]].join(" ");
  return <span className={className}>{props.children}</span>;
}
