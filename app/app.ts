import {TextFieldEvent, TextFieldStates, update as updateTextFields, value as textFieldValue} from "./text-field";
import * as Tasks from "./tasks";
import * as TaskEditor from "./task-editor";
import * as Drag from "./drag";
import * as Storage from "./storage";
import * as Ui from "./ui";

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
  cachedView: DragInvariantView | null;
  cachedHoverInvariantTaskListView: Tasks.HoverInvariantView | null;
};

export const empty: State = {
  tasks: Tasks.empty,
  textFields: {addTitle: ""},
  editor: TaskEditor.empty,
  filter: "ready",
  taskDrag: {dragging: null, hovering: null},
  subtaskFilters: [],
  cachedView: null,
  cachedHoverInvariantTaskListView: null,
};

export type FilterIndicator = null | {type: "text"; text: string; color: Ui.BadgeColor} | {type: "dot"};

export type FilterView = {
  label: string;
  icon: Ui.Icon;
  filter: Tasks.FilterId;
  selected: boolean;
  dropTarget: DropId | null;
  indicator: FilterIndicator;
};

export type SideBarSectionView = {title: string; filter: Tasks.FilterId; filters: FilterView[]};

export type FileControlsView = "saveLoad" | null;

export type FilterBarView = {
  filters: {id: string; label: string; state: "neutral" | "include" | "exclude"; icon?: Ui.Icon}[];
};

type DragInvariantView = Pick<View, "fileControls" | "addTask" | "sideBar" | "filterBar" | "editor">;

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

  function filterIcon(id: Tasks.SubtaskFilter["id"]): Ui.Icon | undefined {
    if (id === "paused") return "paused";
    if (id === "done") return "completed";
    if (id === "ready") return "ready";
    return undefined;
  }

  function filterViews(id: Tasks.SubtaskFilter["id"]) {
    return filterState(id) !== "neutral" || Tasks.isSubtaskFilterRelevant(state, id)
      ? [{id: id, label: filterLabel(id), icon: filterIcon(id), state: filterState(id)}]
      : [];
  }

  return {filters: [...filterViews("paused"), ...filterViews("done"), ...filterViews("ready")]};
}

function viewSideBar(state: State & {today: Date}) {
  const activeProjects = Tasks.activeProjectList(state);
  const activeSubprojects = Tasks.activeSubprojects(state);

  function filterView(
    filter: Tasks.FilterId,
    opts?: {counter: Ui.BadgeColor | "small"; count?: number},
  ): FilterView {
    function indicator(): FilterIndicator {
      if (!opts?.counter) return null;
      if (opts.counter === "small") return {type: "dot" as const};
      const count =
        opts.count ??
        (filter === "ready" || filter === "stalled" || filter === "today" || filter === "waiting"
          ? Tasks.count(state, filter)
          : 0);
      if (count === 0) return null;
      return {type: "text" as const, text: count.toString(), color: opts.counter};
    }

    const icon: Ui.Icon =
      typeof filter === "object"
        ? "project"
        : (
            {
              "all": "allTasks",
              "today": "today",
              "ready": "ready",
              "stalled": "stalled",
              "paused": "paused",
              "done": "completed",
              "not-done": "unfinished",
              "archive": "archive",
              "waiting": "waiting",
            } as const
          )[filter];

    return {
      label: Tasks.filterTitle(state.tasks, filter),
      icon,
      filter,
      selected: Tasks.isSubfilter(state, state.filter, filter),
      dropTarget: {type: "filter", id: filter},
      indicator: indicator(),
    };
  }

  const subprojectSections: SideBarSectionView[] =
    activeSubprojects === null
      ? []
      : [
          {
            title: activeSubprojects.title,
            filter: {type: "project", project: activeSubprojects.parentProject},
            filters: activeSubprojects.children.map((project) =>
              filterView(
                {type: "project", project},
                project.count === 0 && project.isStalled
                  ? {counter: "small"}
                  : {counter: "project", count: project.count},
              ),
            ),
          },
        ];

  return [
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
      filters: [
        filterView("waiting", {counter: "grey"}),
        filterView("paused"),
        filterView("all"),
        filterView("not-done"),
        filterView("done"),
      ],
    },
    {
      title: "Active projects",
      filter: {type: "section", section: "activeProjects"},
      filters: activeProjects.map((project) =>
        filterView(
          {type: "project", project},
          project.count === 0 && project.isStalled
            ? {counter: "small"}
            : {counter: "project", count: project.count},
        ),
      ),
    },
    ...subprojectSections,
    {
      title: "Archive",
      filter: {type: "section", section: "archive"},
      filters: [filterView("archive")],
    },
  ] as SideBarSectionView[];
}

export function view(state: State & {today: Date}): View {
  return {
    fileControls: state.cachedView?.fileControls ?? "saveLoad",
    addTask: state.cachedView?.addTask ?? {value: textFieldValue(state.textFields, "addTitle")},
    sideBar: state.cachedView?.sideBar ?? viewSideBar(state),
    filterBar: state.cachedView?.filterBar ?? viewFilterBar(state),
    taskList: Tasks.view(state?.cachedHoverInvariantTaskListView ?? Tasks.prepareHoverInvariantView(state), state),
    editor: state.cachedView?.editor ?? TaskEditor.view(state.editor),
  };
}

function compose<T>(fns: ((x: T) => T)[]): (x: T) => T {
  return (x) => fns.reduce((x, f) => f(x), x);
}

function always<T>(x: T): (...args: unknown[]) => T {
  return () => x;
}

export function handle(state: State & {today: Date}, ev: Event): [State, Effect[]] {
  const nextState = updateApp(state, ev);
  return [nextState, effects(state, ev, nextState)];
}

export function effects(state: State & {today: Date}, event: Event, nextApp?: State): Effect[] {
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

  if (event.tag === "drag" && ["drag", "hover", "leave"].includes(event.type)) return [];

  return [{type: "saveLocalStorage", value: Storage.saveString((nextApp ?? updateApp(state, event)).tasks)}];
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

  function rebulidCache(app: State & {today: Date}, ev: Event) {
    if (ev.tag === "drag" && ["hover", "leave"].includes(ev.type)) return app;
    return {
      ...app,
      cachedView: {
        fileControls: "saveLoad" as const,
        addTask: {value: textFieldValue(app.textFields, "addTitle")},
        sideBar: viewSideBar(app),
        filterBar: viewFilterBar(app),
        editor: TaskEditor.view(app.editor),
      },
      cachedHoverInvariantTaskListView: Tasks.prepareHoverInvariantView(app),
    };
  }

  const today = state.today;

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
    (state) => rebulidCache({...state, today}, ev),
  ])(state);
}
