import {TextFieldEvent, TextFieldStates} from "./text-field";
import * as Tasks from "./tasks";
import {TaskListView} from "./tasks";
import * as TaskEditor from "./task-editor";
import {add, edit, merge} from "./tasks";
import {update as updateTextFields, value as textFieldValue} from "./text-field";
import * as Drag from "./drag";
import * as Storage from "./storage";

type TextFieldId = "addTitle";

import type {FilterId, BadgeId} from "./tasks";
export type {FilterId, BadgeId};

export type SelectFilterEvent = {tag: "selectFilter"; filter: FilterId};
export type CheckEvent = {tag: "check"; id: string};
export type SelectEditingTask = {tag: "selectEditingTask"; id: string};

export type DragId = {type: "task"; id: string};
export type DropId = {type: "filter"; id: FilterId} | {type: "list"; target: Tasks.DropTargetHandle};

export type Event =
  | CheckEvent
  | TextFieldEvent<TextFieldId>
  | SelectEditingTask
  | SelectFilterEvent
  | TaskEditor.Event
  | Drag.DragEvent<DragId, DropId>
  | Storage.Event;

export type Effect =
  | {type: "fileDownload"; name: string; contents: string}
  | {type: "fileUpload"}
  | {type: "saveLocalStorage"; value: string};

export type Send = (event: Event) => void;

export type State = {
  filter: FilterId;
  tasks: Tasks.Tasks;
  textFields: TextFieldStates<TextFieldId>;
  editor: TaskEditor.State;
  taskDrag: Drag.DragState<DragId, DropId>;
};

export const empty: State = {
  tasks: Tasks.empty,
  textFields: {addTitle: ""},
  editor: TaskEditor.empty,
  filter: "ready",
  taskDrag: {dragging: null, hovering: null},
};

export type FilterIndicator = null | {text: string; color: "red" | "orange" | "green"} | {};

export type FilterView = {
  label: string;
  filter: FilterId;
  selected: boolean;
  dropTarget: DropId | null;
  indicator: FilterIndicator;
};

export type SideBarSectionView = {title: string; filter: FilterId; filters: FilterView[]};

export type FileControlsView = "saveLoad" | null;

export type FilterBarView = {
  filters: {label: string}[];
};

export type View = {
  fileControls: FileControlsView;
  addTask: {value: string};
  sideBar: SideBarSectionView[];
  taskList: TaskListView;
  filterBar: FilterBarView;
  editor: TaskEditor.View;
};

function viewFilterBar(app: State, args: {today: Date}): FilterBarView {
  const list = Tasks.view({...app, today: args.today});

  const anyPaused = list.some((r) => r.rows.some((t) => t.type === "task" && t.paused));
  const anyUnpaused = list.some((r) => r.rows.some((t) => t.type === "task" && !t.paused));

  if (anyPaused && anyUnpaused) return {filters: [{label: "Paused"}]};
  else return {filters: []};
}

export function view(app: State, args: {today: Date}): View {
  const activeProjects = Tasks.activeProjects(app.tasks);

  function filterView(
    filter: FilterId,
    opts?: {counter: "small" | "red" | "orange" | "green"; count?: number},
  ): FilterView {
    function indicator() {
      if (!opts?.counter) return null;
      const count = opts.count ?? Tasks.count(app.tasks, filter, args);
      if (count === 0) return null;
      if (opts.counter === "small") return {};
      return {text: count.toString(), color: opts.counter};
    }

    return {
      label: Tasks.filterTitle(app.tasks, filter),
      filter,
      selected: Tasks.isSubfilter(app.tasks, app.filter, filter),
      dropTarget: {type: "filter", id: filter},
      indicator: indicator(),
    };
  }

  return {
    fileControls: "saveLoad",
    addTask: {value: textFieldValue(app.textFields, "addTitle")},
    sideBar: [
      {
        title: "Actions",
        filter: {type: "section", section: "actions"},
        filters: [
          filterView("today", {counter: "red"}),
          filterView("ready", {counter: "green"}),
          filterView("stalled", {counter: "orange"}),
        ],
      },
      {
        title: "Tasks",
        filter: {type: "section", section: "tasks"},
        filters: [filterView("all"), filterView("not-done"), filterView("done"), filterView("paused")],
      },
      {
        title: "Active projects",
        filter: {type: "section", section: "activeProjects"},
        filters: activeProjects.map((project) =>
          filterView({type: "project", project}, {counter: "small", count: project.stalled ? 1 : 0}),
        ),
      },
      {
        title: "Archive",
        filter: {type: "section", section: "archive"},
        filters: [filterView("archive")],
      },
    ],
    filterBar: viewFilterBar(app, args),
    taskList: Tasks.view({...app, today: args.today}),
    editor: TaskEditor.view(app.editor),
  };
}

function compose<T>(fns: ((x: T) => T)[]): (x: T) => T {
  return (x) => fns.reduce((x, f) => f(x), x);
}

function always<T>(x: T): (...args: unknown[]) => T {
  return () => x;
}

export function effects(app: State, event: Event, args: {today: Date}): Effect[] {
  if (event.tag === "storage" && event.type === "clickSaveButton") {
    return [
      {
        type: "fileDownload",
        name: "tasks.json",
        contents: Storage.saveString(app.tasks),
      },
    ];
  }

  if (event.tag === "storage" && event.type === "clickLoadButton") {
    return [{type: "fileUpload"}];
  }

  return [{type: "saveLocalStorage", value: Storage.saveString(updateApp(app, event, args).tasks)}];
}

export function updateApp(app: State, ev: Event, args: {today: Date}): State {
  function handleDrop(app: State, ev: Event) {
    if (ev.tag !== "drag") return app;

    const dropped_ = Drag.dropped(app.taskDrag, ev);
    if (!dropped_) return app;

    const [drag, drop] = dropped_;

    if (drop.type === "filter") {
      const app_ = {...app, tasks: edit(app, drag.id, [{type: "moveToFilter", filter: drop.id}], args)};
      return {...app_, editor: TaskEditor.reload(app_)};
    } else if (drop.type === "list") {
      return {...app, tasks: edit(app, drag.id, [{type: "move", target: drop.target}], args)};
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
      return {...result, tasks: add(app, {title: textFieldValue(app.textFields, "addTitle")}, args)};
    } else {
      return result;
    }
  }

  function handleEdit(app: State, ev: Event) {
    if (ev.tag !== "editor") return app;
    const tasks = edit(app, ev.component.id.taskId, TaskEditor.editOperationsFor(app.editor, ev), args);
    return {...app, editor: TaskEditor.load({tasks}, app.editor!.id), tasks};
  }

  function handleCheck(app: State, ev: Event) {
    if (ev.tag !== "check") return app;
    const value = Tasks.find(app.tasks, ev.id)?.status === "done" ? "active" : "done";
    const tasks = edit(app, ev.id, [{type: "set", property: "status", value}], args);
    return {...app, tasks, editor: TaskEditor.reload({...app, tasks})};
  }

  function handleSelectEditingTask(app: State, ev: Event) {
    if (ev.tag !== "selectEditingTask") return app;
    return {...app, editor: TaskEditor.load(app, ev.id)};
  }

  function handleStorage(app: State, ev: Event) {
    if (ev.tag !== "storage") return app;
    if (ev.type === "loadFile") {
      return Storage.loadString(ev.contents);
    } else if (ev.type === "clickSaveButton" || ev.type === "clickLoadButton") {
      return app;
    } else {
      const unreachable: never = ev;
      return unreachable;
    }
  }

  return compose<State>([
    (app) => handleCheck(app, ev),
    (app) => handleEdit(app, ev),
    (app) => handleSelectFilter(app, ev),
    (app) => handleSelectEditingTask(app, ev),
    (app) => handleDrop(app, ev),
    (app) => handleDragState(app, ev),
    (app) => handleTextField(app, ev),
    (app) => handleStorage(app, ev),
  ])(app);
}
