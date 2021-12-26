import * as React from "react";

const styles = require("./ui.module.scss");

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const className = [styles.button, props.className].join(" ");
  return <button {...props} className={className} />;
}

export function Badge(props: {color: "green" | "orange"; children: React.ReactNode}) {
  const className = [styles.badge, styles[props.color]].join(" ");
  return <span className={className}>{props.children}</span>;
}
