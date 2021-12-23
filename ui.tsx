import * as React from "react";

const styles = require("./ui.module.scss");

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const className = [styles.button, props.className].join(" ");
  return <button {...props} className={className} />;
}
