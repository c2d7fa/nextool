import * as React from "react";
import style from "./task-editor.module.scss";

import {EditOperation, Tasks, find} from "./tasks";
import {Send} from "./app";

export type State = null | {
  id: string;
  title: string;
  done: boolean;
  action: boolean;
};

export const empty: State = null;

export type View = null;

export type Event = {tag: "edit"; id: string; operation: EditOperation};

export function update(state: State, ev: Event): State {
  if (state === null) return null;
  if (ev.operation.type === "delete") return null;
  if (ev.operation.type === "set") return {...state, [ev.operation.property]: ev.operation.value};
  return state;
}

export function load({tasks}: {tasks: Tasks}, taskId: string): State {
  return find(tasks, taskId);
}

export function view(state: State): View {
  return null;
}

export function TaskEditor(props: {view: View; send: Send}) {
  return <div className={style.taskEditor}></div>;
}
