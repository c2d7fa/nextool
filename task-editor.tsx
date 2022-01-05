import * as React from "react";
import {State} from "./app";
import {EditOperation, find} from "./tasks";
import {TextFieldStates, UnnamedTextField} from "./text-field";
import {Button} from "./ui";

const style = require("./task-editor.module.scss");

type TaskEditorStateTextFieldId = "title";

export type TaskEditorState = null | {
  id: string;
  title: string;
  done: boolean;
  action: boolean;
};

export type TaskEditorEvent = {tag: "edit"; id: string; operation: EditOperation};

export function updateEditor(app: State, ev: TaskEditorEvent): TaskEditorState {
  if (ev.operation.type === "delete") return null;
  if (ev.operation.type === "set") return {...app.editor, [ev.operation.property]: ev.operation.value};
  return app.editor;
}

export function reload(app: State, taskId: string): TaskEditorState {
  return find(app.tasks, taskId);
}

export function TaskEditor(props: {editor: TaskEditorState; send(ev: TaskEditorEvent): void}) {
  if (props.editor === null) return null;
  return (
    <div className={style.taskEditor}>
      <UnnamedTextField
        value={props.editor.title}
        send={(ev) => {
          if (ev.type === "edit")
            props.send({
              tag: "edit",
              id: props.editor.id,
              operation: {type: "set", property: "title", value: ev.value},
            });
        }}
      />
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
