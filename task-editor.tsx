import * as React from "react";
import {App} from "./app";
import {EditOperation, find} from "./tasks";
import {Button} from "./ui";

const style = require("./task-editor.module.scss");

export type TaskEditorState = null | {id: string; title: string; done: boolean; action: boolean};

export type TaskEditorEvent = {tag: "edit"; id: string; operation: EditOperation};

export function updateEditor(app: App, ev: TaskEditorEvent): TaskEditorState {
  if (ev.operation.type === "delete") return null;
  if (ev.operation.type === "set") return {...find(app.tasks, ev.id), [ev.operation.property]: ev.operation.value};
  return app.editor;
}

export function reload(app: App, taskId: string): TaskEditorState {
  return find(app.tasks, taskId);
}

export function TaskEditor(props: {editor: TaskEditorState; send(ev: TaskEditorEvent): void}) {
  if (props.editor === null) return null;
  return (
    <div className={style.taskEditor}>
      <pre>{JSON.stringify(props.editor, null, 2)}</pre>
      <Button onClick={() => props.send({tag: "edit", id: props.editor.id, operation: {type: "delete"}})}>
        Delete
      </Button>
      <Button
        onClick={() =>
          props.send({tag: "edit", id: props.editor.id, operation: {type: "set", property: "done", value: true}})
        }
      >
        Mark Done
      </Button>
    </div>
  );
}
