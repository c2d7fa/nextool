import {TextFieldEvent, TextFieldStates} from "./text-field";
import {CheckedEvent, SelectEditingTask} from "./task-list";
import {list, Task, TaskList} from "./tasks";
import {TaskEditorEvent, TaskEditorState} from "./task-editor";
import * as Drag from "./drag";

type TextFieldId = "addTitle";

export type AddEvent = {tag: "add"};
export type SelectFilterEvent = {tag: "selectFilter"; filter: "all" | "actions" | "done" | "stalled"};

export type Event =
  | CheckedEvent
  | AddEvent
  | TextFieldEvent<TextFieldId>
  | SelectEditingTask
  | SelectFilterEvent
  | TaskEditorEvent
  | Drag.DragEvent<`task:${string}`, `filter:actions` | `filter:done` | `filter:stalled`>;

export type State = {
  filter: "all" | "actions" | "done" | "stalled";
  tasks: Task[];
  textFields: TextFieldStates<TextFieldId>;
  editor: TaskEditorState;
  taskDrag: Drag.DragState<`task:${string}`, `filter:actions` | `filter:done` | `filter:stalled`>;
};

export type View = {
  filters: {
    label: string;
    filter: "all" | "actions" | "done" | "stalled";
    selected: boolean;
    dropTarget: `filter:actions` | `filter:done` | `filter:stalled` | null;
  }[];
  taskList: TaskList;
  editor: TaskEditorState;
};

export function view(app: State): View {
  return {
    filters: [
      {label: "All", filter: "all", selected: app.filter === "all", dropTarget: null},
      {label: "Actions", filter: "actions", selected: app.filter === "actions", dropTarget: `filter:actions`},
      {label: "Done", filter: "done", selected: app.filter === "done", dropTarget: `filter:done`},
      {label: "Stalled", filter: "stalled", selected: app.filter === "stalled", dropTarget: `filter:stalled`},
    ],
    taskList: list(app.tasks, app.filter),
    editor: app.editor,
  };
}
