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

export type SelectFilterEvent = {tag: "selectFilter"; filter: FilterId};
export type CheckEvent = {tag: "check"; id: string};
export type SelectEditingTask = {tag: "selectEditingTask"; id: string};

export type DragId = {type: "task"; id: string};
export type DropId =
  | {type: "filter"; id: FilterId}
  | {type: "task"; id: string; side: "above" | "below"; indentation: number};

export type Event =
  | CheckEvent
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

export type FilterView = {
  label: string;
  filter: FilterId;
  selected: boolean;
  dropTarget: DropId | null;
  indicator: null | {text: string} | {};
};

export type SideBarSectionView = {title: string; filters: FilterView[]};

export type View = {
  sideBar: SideBarSectionView[];
  taskList: TaskListView;
  editor: TaskEditor.View;
};

export function view(app: State): View {
  const stalledTasks = Tasks.countStalledTasks(app.tasks);

  const activeProjects = Tasks.projects(app.tasks).filter(
    (project) => project.status === "active" && !project.archived,
  );

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
            indicator: null,
          },
          {
            label: "Stalled",
            filter: "stalled",
            selected: app.filter === "stalled",
            dropTarget: {type: "filter", id: "stalled"},
            indicator: stalledTasks === 0 ? null : {text: `${stalledTasks}`},
          },
        ],
      },
      {
        title: "Tasks",
        filters: [
          {
            label: "All",
            filter: "all",
            selected: app.filter === "all",
            dropTarget: {type: "filter", id: "all"},
            indicator: null,
          },
          {
            label: "Unfinished",
            filter: "not-done",
            selected: app.filter === "not-done",
            dropTarget: {type: "filter", id: "not-done"},
            indicator: null,
          },

          {
            label: "Finished",
            filter: "done",
            selected: app.filter === "done",
            dropTarget: {type: "filter", id: "done"},
            indicator: null,
          },
        ],
      },
      {
        title: "Active projects",
        filters: activeProjects.map((project) => ({
          label: project.title,
          selected:
            typeof app.filter === "object" &&
            app.filter.type === "project" &&
            app.filter.project.id === project.id,
          filter: {type: "project", project: project},
          dropTarget: null,
          indicator: Tasks.isStalled(app.tasks, project) ? {} : null,
        })),
      },
      {
        title: "Archive",
        filters: [
          {
            label: "Archive",
            filter: "archive",
            selected: app.filter === "archive",
            dropTarget: {type: "filter", id: "archive"},
            indicator: null,
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
      const app_ = {...app, tasks: edit(app.tasks, drag.id, {type: "moveToFilter", filter: drop.id})};
      return {...app_, editor: TaskEditor.reload(app_)};
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

  function handleTextField(app: State, ev: Event) {
    if (ev.tag !== "textField") return app;
    const result = {...app, textFields: updateTextFields(app.textFields, ev)};
    if (ev.type === "submit") {
      return {...result, tasks: add(app, {title: textFieldValue(app.textFields, "addTitle")})};
    } else {
      return result;
    }
  }

  function handleEdit(app: State, ev: Event) {
    if (ev.tag !== "editor") return app;
    const tasks = edit(app.tasks, ev.component.id.taskId, ...TaskEditor.editOperationsFor(app.editor, ev));
    return {...app, editor: TaskEditor.load({tasks}, app.editor!.id), tasks};
  }

  function handleCheck(app: State, ev: Event) {
    if (ev.tag !== "check") return app;
    const value = Tasks.find(app.tasks, ev.id)?.status === "done" ? "active" : "done";
    const tasks = edit(app.tasks, ev.id, {type: "set", property: "status", value});
    return {...app, tasks, editor: TaskEditor.reload({...app, tasks})};
  }

  function handleSelectEditingTask(app: State, ev: Event) {
    if (ev.tag !== "selectEditingTask") return app;
    return {...app, editor: TaskEditor.load(app, ev.id)};
  }

  return compose<State>([
    (app) => handleCheck(app, ev),
    (app) => handleEdit(app, ev),
    (app) => handleSelectFilter(app, ev),
    (app) => handleSelectEditingTask(app, ev),
    (app) => handleDrop(app, ev),
    (app) => handleDragState(app, ev),
    (app) => handleTextField(app, ev),
  ])(app);
}
