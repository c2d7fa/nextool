import * as React from "react";
import {EditOperation, Tasks, find} from "./tasks";
import {UnnamedTextField} from "./text-field";
import {Button} from "./ui";

const style = require("./task-editor.module.scss");

export type TaskEditorState = null | {
  id: string;
  title: string;
  done: boolean;
  action: boolean;
};

export type TaskEditorEvent = {tag: "edit"; id: string; operation: EditOperation};

export function updateEditor(state: TaskEditorState, ev: TaskEditorEvent): TaskEditorState {
  if (state === null) return null;
  if (ev.operation.type === "delete") return null;
  if (ev.operation.type === "set") return {...state, [ev.operation.property]: ev.operation.value};
  return state;
}

export function reload({tasks}: {tasks: Tasks}, taskId: string): TaskEditorState {
  return find(tasks, taskId);
}

export function TaskEditor(props: {editor: TaskEditorState; send(ev: TaskEditorEvent): void}) {
  const editor = props.editor;
  if (editor === null) return null;
  return (
    <div className={style.taskEditor}>
      <UnnamedTextField
        value={editor.title}
        send={(ev) => {
          if (ev.type === "edit")
            props.send({
              tag: "edit",
              id: editor.id,
              operation: {type: "set", property: "title", value: ev.value},
            });
        }}
      />
      <pre>{JSON.stringify(editor, null, 2)}</pre>
      <Button onClick={() => props.send({tag: "edit", id: editor.id, operation: {type: "delete"}})}>Delete</Button>
      <Button
        onClick={() =>
          props.send({tag: "edit", id: editor.id, operation: {type: "set", property: "done", value: true}})
        }
      >
        Mark Done
      </Button>
    </div>
  );
}
