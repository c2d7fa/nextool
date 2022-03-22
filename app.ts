import {TextFieldEvent, TextFieldStates} from "./text-field";
import * as Tasks from "./tasks";
import {TaskListView} from "./tasks";
import * as TaskEditor from "./task-editor";
import {add, edit, merge} from "./tasks";
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
  | TaskEditor.Event
  | Drag.DragEvent<DragId, DropId>;

export type Send = (event: Event) => void;

export type State = {
  filter: FilterId;
  tasks: Tasks.Tasks;
  textFields: TextFieldStates<TextFieldId>;
  editor: TaskEditor.State;
  taskDrag: Drag.DragState<DragId, DropId>;
};

export const empty: State = {
  tasks: [],
  textFields: {addTitle: ""},
  editor: TaskEditor.empty,
  filter: "ready",
  taskDrag: {dragging: null, hovering: null},
};

export type FilterView = {label: string; filter: FilterId; selected: boolean; dropTarget: DropId | null};
export type SideBarSectionView = {title: string; filters: FilterView[]};

export type View = {
  sideBar: SideBarSectionView[];
  taskList: TaskListView;
  editor: TaskEditor.View;
};

export function view(app: State): View {
  return {
    sideBar: [
      {
        title: "Actions",
        filters: [
          {
            label: "Ready",
            filter: "ready",
            selected: app.filter === "ready",
            dropTarget: {type: "filter", id: "ready"},
          },
          {
            label: "Stalled",
            filter: "stalled",
            selected: app.filter === "stalled",
            dropTarget: {type: "filter", id: "stalled"},
          },
        ],
      },
      {
        title: "Tasks",
        filters: [
          {label: "All", filter: "all", selected: app.filter === "all", dropTarget: null},
          {
            label: "Unfinished",
            filter: "not-done",
            selected: app.filter === "not-done",
            dropTarget: {type: "filter", id: "not-done"},
          },

          {
            label: "Finished",
            filter: "done",
            selected: app.filter === "done",
            dropTarget: {type: "filter", id: "done"},
          },
        ],
      },
    ],
    taskList: Tasks.view(app),
    editor: TaskEditor.view(app.editor),
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
      return {
        ...app,
        tasks: edit(app.tasks, drag.id, {
          type: "move",
          side: drop.side,
          target: drop.id,
          indentation: drop.indentation,
        }),
      };
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
    if (ev.tag !== "editor") return app;
    return {...app, editor: TaskEditor.update(app.editor, ev)};
  }

  function handleChecked(app: State, ev: Event) {
    if (ev.tag !== "checked") return app;
    return {...app, tasks: merge(app.tasks, [{id: ev.id, done: ev.checked}])};
  }

  function handleSelectEditingTask(app: State, ev: Event) {
    if (ev.tag !== "selectEditingTask") return app;
    return {...app, editor: TaskEditor.load(app, ev.id)};
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
