import {TextFieldEvent, TextFieldStates} from "./text-field";
import {CheckedEvent, SelectEditingTask} from "./task-list";
import {list, Task, TaskList} from "./tasks";
import {TaskEditorEvent, TaskEditorState} from "./task-editor";
import * as Drag from "./drag";

type TextFieldId = "addTitle";

import type {FilterId} from "./tasks";
export type {FilterId};

export type AddEvent = {tag: "add"};
export type SelectFilterEvent = {tag: "selectFilter"; filter: FilterId};

export type Event =
  | CheckedEvent
  | AddEvent
  | TextFieldEvent<TextFieldId>
  | SelectEditingTask
  | SelectFilterEvent
  | TaskEditorEvent
  | Drag.DragEvent<`task:${string}`, `filter:${FilterId}`>;

export type State = {
  filter: FilterId;
  tasks: Task[];
  textFields: TextFieldStates<TextFieldId>;
  editor: TaskEditorState;
  taskDrag: Drag.DragState<`task:${string}`, `filter:${FilterId}`>;
};

export type View = {
  filters: {
    label: string;
    filter: FilterId;
    selected: boolean;
    dropTarget: `filter:${FilterId}` | null;
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
        dropTarget: "filter:not-done",
      },
      {label: "Actions", filter: "actions", selected: app.filter === "actions", dropTarget: `filter:actions`},
      {label: "Stalled", filter: "stalled", selected: app.filter === "stalled", dropTarget: `filter:stalled`},
      {label: "Done", filter: "done", selected: app.filter === "done", dropTarget: `filter:done`},
      {label: "All", filter: "all", selected: app.filter === "all", dropTarget: null},
    ],
    taskList: list(app.tasks, app.filter),
    editor: app.editor,
  };
}
