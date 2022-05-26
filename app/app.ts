import {TextFieldEvent, TextFieldStates, update as updateTextFields, value as textFieldValue} from "./text-field";
import * as Tasks from "./tasks";
import * as TaskEditor from "./task-editor";
import * as Drag from "./drag";
import * as Storage from "./storage";

type TextFieldId = "addTitle";

export type SelectFilterEvent = {tag: "selectFilter"; filter: Tasks.FilterId};
export type CheckEvent = {tag: "check"; id: string};
export type SelectEditingTask = {tag: "selectEditingTask"; id: string};

export type DragId = {type: "task"; id: string};
export type DropId = {type: "filter"; id: Tasks.FilterId} | {type: "list"; target: Tasks.DropTargetHandle};

export type FilterBarEvent = {tag: "filterBar"; type: "set"; id: string; state: "include" | "exclude"};

export type Event =
  | CheckEvent
  | TextFieldEvent<TextFieldId>
  | SelectEditingTask
  | SelectFilterEvent
  | TaskEditor.Event
  | Drag.DragEvent<DragId, DropId>
  | Storage.Event
  | FilterBarEvent;

export type Effect =
  | {type: "fileDownload"; name: string; contents: string}
  | {type: "fileUpload"}
  | {type: "saveLocalStorage"; value: string};

export type Send = (event: Event) => void;

export type State = {
  filter: Tasks.FilterId;
  tasks: Tasks.Tasks;
  textFields: TextFieldStates<TextFieldId>;
  editor: TaskEditor.State;
  taskDrag: Drag.DragState<DragId, DropId>;
  subtaskFilters: Tasks.SubtaskFilters;
};

export const empty: State = {
  tasks: Tasks.empty,
  textFields: {addTitle: ""},
  editor: TaskEditor.empty,
  filter: "ready",
  taskDrag: {dragging: null, hovering: null},
  subtaskFilters: [],
};

export type FilterIndicator = null | {text: string; color: "red" | "orange" | "green"} | {};

export type FilterView = {
  label: string;
  filter: Tasks.FilterId;
  selected: boolean;
  dropTarget: DropId | null;
  indicator: FilterIndicator;
};

export type SideBarSectionView = {title: string; filter: Tasks.FilterId; filters: FilterView[]};

export type FileControlsView = "saveLoad" | null;

export type FilterBarView = {
  filters: {id: string; label: string; state: "neutral" | "include" | "exclude"}[];
};

export type View = {
  fileControls: FileControlsView;
  addTask: {value: string};
  sideBar: SideBarSectionView[];
  taskList: Tasks.TaskListView;
  filterBar: FilterBarView;
  editor: TaskEditor.View;
};

function viewFilterBar(state: State & {today: Date}): FilterBarView {
  function filterState(id: string): "neutral" | "include" | "exclude" {
    const filter = state.subtaskFilters.find((f) => f.id === id);
    if (filter === undefined) {
      return "neutral";
    }
    return filter.state;
  }

  function filterLabel(id: Tasks.SubtaskFilter["id"]) {
    if (id === "paused") return "Paused";
    if (id === "done") return "Completed";
    if (id === "ready") return "Ready";
    return id;
  }

  function filterViews(id: Tasks.SubtaskFilter["id"]) {
    return filterState(id) !== "neutral" || Tasks.isSubtaskFilterRelevant(state, id)
      ? [{id: id, label: filterLabel(id), state: filterState(id)}]
      : [];
  }

  return {filters: [...filterViews("paused"), ...filterViews("done"), ...filterViews("ready")]};
}

export function view(state: State & {today: Date}): View {
  const activeProjects = Tasks.activeProjects(state);

  function filterView(
    filter: Tasks.FilterId,
    opts?: {counter: "small" | "red" | "orange" | "green"; count?: number},
  ): FilterView {
    function indicator() {
      if (!opts?.counter) return null;
      const count = opts.count ?? Tasks.count(state, filter);
      if (count === 0) return null;
      if (opts.counter === "small") return {};
      return {text: count.toString(), color: opts.counter};
    }

    return {
      label: Tasks.filterTitle(state.tasks, filter),
      filter,
      selected: Tasks.isSubfilter(state, state.filter, filter),
      dropTarget: {type: "filter", id: filter},
      indicator: indicator(),
    };
  }

  return {
    fileControls: "saveLoad",
    addTask: {value: textFieldValue(state.textFields, "addTitle")},
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
    filterBar: viewFilterBar(state),
    taskList: Tasks.view(state),
    editor: TaskEditor.view(state.editor),
  };
}

function compose<T>(fns: ((x: T) => T)[]): (x: T) => T {
  return (x) => fns.reduce((x, f) => f(x), x);
}

function always<T>(x: T): (...args: unknown[]) => T {
  return () => x;
}

export function effects(state: State & {today: Date}, event: Event): Effect[] {
  if (event.tag === "storage" && event.type === "clickSaveButton") {
    return [
      {
        type: "fileDownload",
        name: "tasks.json",
        contents: Storage.saveString(state.tasks),
      },
    ];
  }

  if (event.tag === "storage" && event.type === "clickLoadButton") {
    return [{type: "fileUpload"}];
  }

  return [{type: "saveLocalStorage", value: Storage.saveString(updateApp(state, event).tasks)}];
}

export function updateApp(state: State & {today: Date}, ev: Event): State {
  function handleDrop(app: State, ev: Event) {
    if (ev.tag !== "drag") return app;

    const dropped_ = Drag.dropped(app.taskDrag, ev);
    if (!dropped_) return app;

    const [drag, drop] = dropped_;

    if (drop.type === "filter") {
      const app_ = {...app, tasks: Tasks.edit(state, drag.id, [{type: "moveToFilter", filter: drop.id}])};
      return {...app_, editor: TaskEditor.reload(app_)};
    } else if (drop.type === "list") {
      return {...app, tasks: Tasks.edit(state, drag.id, [{type: "move", target: drop.target}])};
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

  function handleFilterBar(app: State, ev: Event) {
    if (ev.tag !== "filterBar") return app;

    let subtaskFilters = app.subtaskFilters;
    const currentState = subtaskFilters.find((f) => f.id === ev.id);
    if (currentState === undefined) {
      if (ev.id === "paused" || ev.id === "done" || ev.id === "ready")
        subtaskFilters = [...subtaskFilters, {id: ev.id, state: ev.state}];
      else console.error("Invalid filter ID", ev);
    } else {
      subtaskFilters = subtaskFilters.flatMap((f) =>
        f.id === ev.id ? (f.state === ev.state ? [] : [{...f, state: ev.state}]) : [f],
      );
    }

    return {
      ...app,
      subtaskFilters,
    };
  }

  function handleTextField(app: State, ev: Event) {
    if (ev.tag !== "textField") return app;
    const result = {...app, textFields: updateTextFields(app.textFields, ev)};
    if (ev.type === "submit") {
      return {...result, tasks: Tasks.add(state, {title: textFieldValue(app.textFields, "addTitle")})};
    } else {
      return result;
    }
  }

  function handleEdit(app: State, ev: Event) {
    if (ev.tag !== "editor") return app;
    const tasks = Tasks.edit(state, ev.component.id.taskId, TaskEditor.editOperationsFor(app.editor, ev));
    return {...app, editor: TaskEditor.load({tasks}, app.editor!.id), tasks};
  }

  function handleCheck(app: State, ev: Event) {
    if (ev.tag !== "check") return app;
    const value = Tasks.find(app.tasks, ev.id)?.status === "done" ? "active" : "done";
    const tasks = Tasks.edit(state, ev.id, [{type: "set", property: "status", value}]);
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
    (state) => handleCheck(state, ev),
    (state) => handleEdit(state, ev),
    (state) => handleSelectFilter(state, ev),
    (state) => handleFilterBar(state, ev),
    (state) => handleSelectEditingTask(state, ev),
    (state) => handleDrop(state, ev),
    (state) => handleDragState(state, ev),
    (state) => handleTextField(state, ev),
    (state) => handleStorage(state, ev),
  ])(state);
}
