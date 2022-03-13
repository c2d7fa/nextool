import {TextFieldEvent, TextFieldStates} from "./text-field";
import {list, Task, TaskList} from "./tasks";
import {TaskEditorEvent, TaskEditorState} from "./task-editor";
import * as Drag from "./drag";

type TextFieldId = "addTitle";

import type {FilterId} from "./tasks";
export type {FilterId};

export type AddEvent = {tag: "add"};
export type SelectFilterEvent = {tag: "selectFilter"; filter: FilterId};
export type CheckedEvent = {tag: "checked"; id: string; checked: boolean};
export type SelectEditingTask = {tag: "selectEditingTask"; id: string};

export type DragId = {type: "task"; id: string};
export type DropId = {type: "filter"; id: FilterId} | {type: "task"; side: "above" | "below"; id: string};

export type Event =
  | CheckedEvent
  | AddEvent
  | TextFieldEvent<TextFieldId>
  | SelectEditingTask
  | SelectFilterEvent
  | TaskEditorEvent
  | Drag.DragEvent<DragId, DropId>;

export type Send = (event: Event) => void;

export type State = {
  filter: FilterId;
  tasks: Task[];
  textFields: TextFieldStates<TextFieldId>;
  editor: TaskEditorState;
  taskDrag: Drag.DragState<DragId, DropId>;
};

export type View = {
  filters: {
    label: string;
    filter: FilterId;
    selected: boolean;
    dropTarget: DropId | null;
  }[];
  taskList: TaskList;
  editor: TaskEditorState;
};

export function view(app: State): View {
  return {
    filters: [
      {
        label: "Unfinished",
        filter: "not-done",
        selected: app.filter === "not-done",
        dropTarget: {type: "filter", id: "not-done"},
      },
      {
        label: "Actions",
        filter: "actions",
        selected: app.filter === "actions",
        dropTarget: {type: "filter", id: "actions"},
      },
      {
        label: "Stalled",
        filter: "stalled",
        selected: app.filter === "stalled",
        dropTarget: {type: "filter", id: "stalled"},
      },
      {label: "Done", filter: "done", selected: app.filter === "done", dropTarget: {type: "filter", id: "done"}},
      {label: "All", filter: "all", selected: app.filter === "all", dropTarget: null},
    ],
    taskList: list(app.tasks, app.filter),
    editor: app.editor,
  };
}
