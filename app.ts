import {TextFieldEvent, TextFieldStates} from "./text-field";
import * as Tasks from "./tasks";
import {Task, TaskListView} from "./tasks";
import {TaskEditorEvent, TaskEditorState} from "./task-editor";
import {add, edit, merge} from "./tasks";
import {reload, updateEditor} from "./task-editor";
import {update as updateTextFields, value as textFieldValue} from "./text-field";
import * as Drag from "./drag";

type TextFieldId = "addTitle";

import type {FilterId} from "./tasks";
export type {FilterId};

export type AddEvent = {tag: "add"};
export type SelectFilterEvent = {tag: "selectFilter"; filter: FilterId};
export type CheckedEvent = {tag: "checked"; id: string; checked: boolean};
export type SelectEditingTask = {tag: "selectEditingTask"; id: string};

export type DragId = {type: "task"; id: string};
export type DropId =
  | {type: "filter"; id: FilterId}
  | {type: "task"; id: string; side: "above" | "below"; indentation: number};

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

export const empty: State = {
  tasks: [],
  textFields: {addTitle: ""},
  editor: null,
  filter: "not-done",
  taskDrag: {dragging: null, hovering: null},
};

export type View = {
  filters: {
    label: string;
    filter: FilterId;
    selected: boolean;
    dropTarget: DropId | null;
  }[];
  taskList: TaskListView;
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
    taskList: Tasks.view(app),
    editor: app.editor,
  };
}

function compose<T>(fns: ((x: T) => T)[]): (x: T) => T {
  return (x) => fns.reduce((x, f) => f(x), x);
}

function always<T>(x: T): (...args: unknown[]) => T {
  return () => x;
}

export function updateApp(app: State, ev: Event): State {
  function handleDrop(app: State, ev: Event) {
    if (ev.tag !== "drag") return app;

    const dropped_ = Drag.dropped(app.taskDrag, ev);
    if (!dropped_) return app;

    const [drag, drop] = dropped_;

    if (drop.type === "filter") {
      return {...app, tasks: edit(app.tasks, drag.id, {type: "moveToFilter", filter: drop.id})};
    } else if (drop.type === "task") {
      console.log(drop);
      return {...app, tasks: edit(app.tasks, drag.id, {type: "move", side: drop.side, target: drop.id})};
    } else {
      const unreachable: never = drop;
      return unreachable;
    }
  }

  function handleDragState(app: State, ev: Event) {
    if (ev.tag !== "drag") return app;
    return {...app, taskDrag: Drag.update(app.taskDrag, ev, {isCompatible: always(true)})};
  }

  function handleSelectFilter(app: State, ev: Event) {
    if (ev.tag !== "selectFilter") return app;
    return {...app, filter: ev.filter};
  }

  function handleAdd(app: State, ev: Event) {
    let result = app;
    if ((ev.tag === "textField" && ev.field === "addTitle" && ev.type === "submit") || ev.tag === "add") {
      result = {...app, tasks: add(app.tasks, {title: textFieldValue(app.textFields, "addTitle")})};
    }
    if (ev.tag === "add") {
      result = {
        ...app,
        textFields: updateTextFields(app.textFields, {tag: "textField", field: "addTitle", type: "submit"}),
      };
    }
    return result;
  }

  function handleTextField(app: State, ev: Event) {
    if (ev.tag !== "textField") return app;
    return {...app, textFields: updateTextFields(app.textFields, ev)};
  }

  function handleEdit(app: State, ev: Event) {
    if (ev.tag !== "edit") return app;
    return {...app, editor: updateEditor(app.editor, ev), tasks: edit(app.tasks, ev.id, ev.operation)};
  }

  function handleChecked(app: State, ev: Event) {
    if (ev.tag !== "checked") return app;
    return {...app, tasks: merge(app.tasks, [{id: ev.id, done: ev.checked}])};
  }

  function handleSelectEditingTask(app: State, ev: Event) {
    if (ev.tag !== "selectEditingTask") return app;
    return {...app, editor: reload(app, ev.id)};
  }

  return compose<State>([
    (app) => handleAdd(app, ev),
    (app) => handleChecked(app, ev),
    (app) => handleEdit(app, ev),
    (app) => handleSelectFilter(app, ev),
    (app) => handleSelectEditingTask(app, ev),
    (app) => handleDrop(app, ev),
    (app) => handleDragState(app, ev),
    (app) => handleTextField(app, ev),
  ])(app);
}
