import * as React from "react";
import {Task} from "./tasks";

const style = require("./task-editor.module.scss");

export function TaskEditor(props: {task: Task | null}) {
  return <div className={style.taskEditor}>{props.task && <pre>{JSON.stringify(props.task, null, 2)}</pre>}</div>;
}
