import * as React from "react";

import * as styles from "./ui.module.scss";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & {color?: "magenta"}) {
  const className = [styles.button, props.className, props.color ? styles[props.color] : ""].join(" ");
  return (
    <div className={styles.buttonContainer}>
      <button {...props} className={className} />
    </div>
  );
}

export function Badge(props: {color: "green" | "orange" | "project" | "red"; children: React.ReactNode}) {
  const className = [styles.badge, styles[props.color]].join(" ");
  return <span className={className}>{props.children}</span>;
}
