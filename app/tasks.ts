import {addDays, differenceInCalendarDays, isAfter, isBefore, isSameDay} from "date-fns";
import {DragId, DropId} from "./app";
import {DragState} from "./drag";
import * as IndentedList from "./indented-list";
import {BadgeColor, Icon} from "./ui";

type TaskData = {
  id: string;
  title: string;
  status: "active" | "paused" | "done";
  type: "task" | "project";
  archived: boolean;
  action: boolean;
  planned: Date | null;
  wait: Date | null;
  due: Date | null;
};

export type Task = IndentedList.TreeNode<TaskData>;
export type Tasks = IndentedList.Tree<TaskData>;

export type DropTargetHandle = {
  location: IndentedList.IndentedListInsertLocation;
  filter: FilterId;
};

export type DropTargetView = {
  type: "dropTarget";
  width: number | "full";
  indentation: number;
  handle: DropTargetHandle;
};

type DropIndicatorView = {
  type: "dropIndicator";
  indentation: number;
};

export type TaskView = {
  type: "task";
  id: string;
  title: string;
  indentation: number;
  done: boolean;
  paused: boolean;
  archived: boolean;
  project: boolean;
  today: boolean;
  badges: Badge[];
  borderBelow: boolean;
};

export type TaskListView = {
  title: null | string;
  rows: (DropTargetView | DropIndicatorView | TaskView)[];
}[];

export type SubtaskFilter = {id: "paused" | "done" | "ready"; state: "include" | "exclude"};
export type SubtaskFilters = SubtaskFilter[];

type CommonState = {tasks: Tasks; filter: FilterId; subtaskFilters: SubtaskFilters; today: Date};

export const empty: Tasks = IndentedList.empty<TaskData>();

export function merge(tasks: Tasks, updates: ({id: string} & Partial<Task>)[]): Tasks {
  return IndentedList.merge(tasks, updates);
}

export function add(state: CommonState, values: Partial<Task>): Tasks {
  function randomId() {
    return Math.floor(Math.random() * 36 ** 8).toString(36);
  }

  const id = randomId();

  const result: Tasks = IndentedList.insert(state.tasks, {
    id,
    title: values.title ?? "",
    action: false,
    status: "active",
    type: "task",
    archived: false,
    children: [],
    planned: null,
    wait: null,
    due: null,
  });

  return edit({...state, tasks: result}, id, [{type: "moveToFilter", filter: state.filter}]);
}

export function find(tasks: Tasks, id: string): TaskData | null {
  return IndentedList.findNode(tasks, {id});
}

export type EditOperation =
  | {type: "set"; property: "title"; value: string}
  | {type: "set"; property: "status"; value: "active" | "paused" | "done"}
  | {type: "set"; property: "type"; value: "task" | "project"}
  | {type: "set"; property: "action" | "archived"; value: boolean}
  | {type: "set"; property: "planned" | "wait" | "due"; value: Date | null}
  | {type: "move"; target: DropTargetHandle}
  | {type: "moveToFilter"; filter: FilterId}
  | null;

export function edit(state: CommonState, id: string, operations: EditOperation[]): Tasks {
  function edit_(tasks: Tasks, operation: EditOperation): Tasks {
    if (operation === null) return tasks;

    if (operation.type === "set") {
      return IndentedList.merge(tasks, [{id, [operation.property]: operation.value}]);
    } else if (operation.type === "moveToFilter") {
      const filter = operation.filter;

      if (typeof filter === "object" && filter.type === "project") {
        return IndentedList.moveInto(tasks, {id}, filter.project);
      }

      function tomorrow() {
        return addDays(state.today, 1);
      }

      const update =
        filter === "ready"
          ? ({type: "set", property: "action", value: true} as const)
          : filter === "done"
          ? ({type: "set", property: "status", value: "done"} as const)
          : filter === "stalled"
          ? ({type: "set", property: "action", value: false} as const)
          : filter === "not-done"
          ? ({type: "set", property: "status", value: "active"} as const)
          : filter === "archive"
          ? ({type: "set", property: "archived", value: true} as const)
          : filter === "today"
          ? ({type: "set", property: "planned", value: state.today} as const)
          : filter === "paused"
          ? ({type: "set", property: "status", value: "paused"} as const)
          : filter === "waiting"
          ? ({type: "set", property: "wait", value: tomorrow()} as const)
          : null;

      const archiveUpdate =
        filter !== "archive" ? ({type: "set", property: "archived", value: false} as const) : null;

      return edit({...state, tasks, filter}, id, [update, archiveUpdate]);
    } else if (operation.type === "move") {
      const tasks_ = operation.target.filter
        ? edit({...state, tasks}, id, [{type: "moveToFilter", filter: operation.target.filter}])
        : tasks;

      return IndentedList.moveItemInSublistOfTree(
        {
          tree: tasks_,
          list: filterTasksIntoList({...state, filter: operation.target.filter ?? state.filter}),
        },
        {id},
        operation.target.location,
        {
          sublistRoot:
            typeof state.filter === "object" && state.filter.type === "project" ? state.filter.project : null,
        },
      );
    } else {
      const unreachable: never = operation;
      return unreachable;
    }
  }

  return operations.reduce(edit_, state.tasks);
}

type TaskProperty =
  | "done"
  | "not-done"
  | "paused"
  | "archived"
  | "today"
  | "todayOrDueToday"
  | "dueToday"
  | "overdueToday"
  | "nonCompletedTodayOrDueToday"
  | "inactive"
  | "project"
  | "readyItself"
  | "readyTaskItself"
  | "readySubtree"
  | "stalled"
  | "stalledSubtree"
  | "waitingItself"
  | "waiting";

function taskIs(
  state: Pick<CommonState, "tasks" | "today">,
  task: IndentedList.Handle & TaskData,
  property: TaskProperty,
): boolean {
  if (property === "done") return task.status === "done";
  if (property === "not-done") return task.status !== "done";
  if (property === "paused")
    return IndentedList.anyAncestor(state.tasks, task, (task) => task.status === "paused");
  if (property === "archived") return IndentedList.anyAncestor(state.tasks, task, (task) => task.archived);
  if (property === "today")
    return (
      (task.planned &&
        (isSameDay(task.planned, state.today) ||
          (isBefore(task.planned, state.today) && !taskIs(state, task, "done")))) ??
      false
    );
  if (property === "dueToday")
    return (task.due && (isSameDay(task.due, state.today) || isBefore(task.due, state.today))) ?? false;
  if (property === "overdueToday")
    return (task.due && isBefore(task.due, state.today) && !isSameDay(task.due, state.today)) ?? false;
  if (property === "todayOrDueToday") return taskIs(state, task, "today") || taskIs(state, task, "dueToday");
  if (property === "nonCompletedTodayOrDueToday")
    return taskIs(state, task, "todayOrDueToday") && !taskIs(state, task, "done");
  if (property === "inactive")
    return (
      taskIs(state, task, "paused") ||
      taskIs(state, task, "done") ||
      taskIs(state, task, "archived") ||
      taskIs(state, task, "waiting")
    );
  if (property === "project") return task.type === "project";
  if (property === "readyItself")
    return taskIs(state, task, "project")
      ? IndentedList.anyDescendant(state.tasks, task, (t) => taskIs(state, t, "readyItself"))
      : task.action &&
          !taskIs(state, task, "inactive") &&
          !IndentedList.anyDescendant(state.tasks, task, (child) => !taskIs(state, child, "done"));
  if (property === "readyTaskItself") return !taskIs(state, task, "project") && taskIs(state, task, "readyItself");
  if (property === "readySubtree")
    return (
      taskIs(state, task, "readyItself") ||
      IndentedList.anyDescendant(state.tasks, task, (t) => taskIs(state, t, "readyItself"))
    );
  if (property === "stalled")
    return (
      !taskIs(state, task, "readyItself") &&
      !taskIs(state, task, "inactive") &&
      (taskIs(state, task, "project") ||
        !IndentedList.anyDescendant(state.tasks, task, (child) => !taskIs(state, child, "inactive")))
    );
  if (property === "stalledSubtree")
    return (
      taskIs(state, task, "stalled") ||
      IndentedList.anyDescendant(state.tasks, task, (task) => taskIs(state, task, "stalled"))
    );
  if (property === "waitingItself") return (task.wait && isAfter(task.wait, state.today)) ?? false;
  if (property === "waiting")
    return (
      taskIs(state, task, "waitingItself") ||
      IndentedList.anyAncestor(state.tasks, task, (task) => taskIs(state, task, "waitingItself"))
    );
  return false;
}

type BadgeId = "ready" | "stalled" | "project" | "today" | {type: "waiting"; text: string};

export type Badge = {color: BadgeColor; icon: Icon; label: string};

function badgeFor(id: BadgeId): {color: BadgeColor; icon: Icon; label: string} {
  if (id === "project") return {color: "project", icon: "project", label: "Project"};
  else if (id === "ready") return {color: "green", icon: "ready", label: "Ready"};
  else if (id === "stalled") return {color: "orange", icon: "stalled", label: "Stalled"};
  else if (id === "today") return {color: "red", icon: "today", label: "Today"};
  else if (typeof id === "object") {
    return {color: "grey", icon: "waiting", label: "Waiting | " + id.text};
  } else {
    const unreachable: never = id;
    return unreachable;
  }
}

function badges(state: CommonState, task: Task): Badge[] {
  function taskHas(state: Pick<CommonState, "tasks" | "today">, task: Task, badge: BadgeId & string): boolean {
    if (badge === "ready") return taskIs(state, task, "readyItself");
    if (badge === "stalled") return taskIs(state, task, "stalled");
    if (badge === "project") return taskIs(state, task, "project");
    if (badge === "today") return taskIs(state, task, "today");
    return false;
  }

  function daysLeftUntilWaitTime(state: CommonState, task: Task): number {
    if (!task.wait) return 0;
    return differenceInCalendarDays(task.wait, state.today);
  }

  function daysLeftUntilDueTime(state: CommonState, task: Task): number {
    if (!task.due) return 0;
    return differenceInCalendarDays(task.due, state.today);
  }

  const simpleBadges = (["project", "today", "stalled", "ready"] as const).flatMap((badge) =>
    taskHas(state, task, badge) ? [badge] : [],
  );

  const waitingBadges = taskIs(state, task, "waitingItself")
    ? [{type: "waiting", text: `${daysLeftUntilWaitTime(state, task)}d`} as const]
    : [];

  const dueBadges: Badge[] = (() => {
    if (!task.due) return [];

    if (taskIs(state, task, "overdueToday"))
      return [{color: "red", icon: "due", label: `Overdue | ${-daysLeftUntilDueTime(state, task)}d`}];
    if (taskIs(state, task, "dueToday")) return [{color: "red", icon: "due", label: "Due | Today"}];

    return [{color: "red", icon: "due", label: `Due | ${daysLeftUntilDueTime(state, task)}d`}];
  })();

  return [...simpleBadges.map(badgeFor), ...waitingBadges.map(badgeFor), ...dueBadges];
}

type FilterSectionId = "actions" | "tasks" | "activeProjects" | "archive";

export type FilterId =
  | "all"
  | "today"
  | "ready"
  | "done"
  | "stalled"
  | "not-done"
  | "archive"
  | "paused"
  | "waiting"
  | {type: "project"; project: {id: string}}
  | {type: "section"; section: FilterSectionId};

function taskProject(state: CommonState, task: Task): null | {id: string} {
  const parent = IndentedList.findParent(state.tasks, task);
  if (parent === null) return null;
  else if (parent.type === "project") return parent;
  else return taskProject(state, parent);
}

function doesSubtaskMatchSubtaskFilter(
  state: Pick<CommonState, "tasks" | "today"> & {
    fullList: IndentedList.IndentedListItem<TaskData>[];
  },
  task: Task,
  subtaskFilter: SubtaskFilter,
): boolean {
  function included(filter: SubtaskFilter, excludeProperty: TaskProperty, includeProperty: TaskProperty) {
    if (filter.state === "include")
      return IndentedList.anyDescendantInList(state.fullList, task, (subtask) =>
        taskIs(state, subtask, includeProperty),
      );

    if (filter.state === "exclude")
      return IndentedList.anyDescendantInList(
        state.fullList,
        task,
        (subtask) => !taskIs(state, subtask, excludeProperty),
      );

    return true;
  }

  if (subtaskFilter.id === "done" && !included(subtaskFilter, "done", "done")) return false;
  if (subtaskFilter.id === "paused" && !included(subtaskFilter, "paused", "paused")) return false;
  if (subtaskFilter.id === "ready" && !included(subtaskFilter, "readySubtree", "readyTaskItself")) return false;

  return true;
}

function doesSubtaskMatchSubtaskFilters(
  state: Pick<CommonState, "tasks" | "today" | "subtaskFilters"> & {
    fullList: IndentedList.IndentedListItem<TaskData>[];
  },
  task: Task,
): boolean {
  return state.subtaskFilters.every((filter) => {
    return doesSubtaskMatchSubtaskFilter(state, task, filter);
  });
}

function isTaskIncludedInFilter(state: CommonState, task: Task): boolean {
  if (taskIs(state, task, "archived") && state.filter !== "archive") return false;

  const filterProperties = {
    "stalled": "stalled",
    "ready": "readyItself",
    "done": "done",
    "paused": "paused",
    "waiting": "waiting",
    "today": "todayOrDueToday",
    "not-done": "not-done",
    "archive": "archived",
  } as const;

  if (typeof state.filter === "string" && state.filter in filterProperties) {
    const filterId = state.filter as keyof typeof filterProperties;
    return (
      taskIs(state, task, filterProperties[filterId]) ||
      IndentedList.anyDescendant(state.tasks, task, (t) => taskIs(state, t, filterProperties[filterId]))
    );
  }

  return true;
}

export function isSubtaskFilterRelevant(state: CommonState, id: SubtaskFilter["id"]): boolean {
  const fullList = filterTasksIntoList(state);

  function wouldAnyMatch(filterState: "include" | "exclude"): boolean {
    return fullList.some((t) => doesSubtaskMatchSubtaskFilter({...state, fullList}, t, {id, state: filterState}));
  }

  return wouldAnyMatch("exclude") && wouldAnyMatch("include");
}

function filterTasksIntoList(state: CommonState): IndentedList.IndentedList<TaskData> {
  const root = typeof state.filter === "object" && state.filter.type === "project" ? state.filter.project : null;
  const globalList = IndentedList.zoomIntoList(state.tasks, root);
  const fullList = IndentedList.filterList(globalList, (task) => isTaskIncludedInFilter(state, task));
  return IndentedList.filterList(fullList, (task) => doesSubtaskMatchSubtaskFilters({...state, fullList}, task));
}

export type ActiveProjectList = {id: string; title: string; count?: number; isStalled: boolean}[];

export function activeProjectList(state: CommonState): ActiveProjectList {
  const list = IndentedList.pickIntoList(
    state.tasks,
    (node) => taskIs(state, node, "project") && !taskIs(state, node, "inactive"),
  );

  function countSubprojects(project: IndentedList.IndentedListItem<TaskData>): number {
    return list.filter(
      (task) =>
        taskIs(state, task, "project") &&
        !taskIs(state, task, "inactive") &&
        IndentedList.isDescendantInList(list, task, project),
    ).length;
  }

  return list
    .filter((t) => t.indentation === 0)
    .map((t) => ({
      id: t.id,
      title: t.title,
      count: countSubprojects(t),
      isStalled: taskIs(state, t, "stalled"),
    }));
}

export function activeSubprojects(
  state: CommonState,
): {title: string; parentProject: {id: string}; children: ActiveProjectList} | null {
  if (typeof state.filter === "object" && state.filter.type === "project") {
    const list = IndentedList.pickIntoList(
      state.tasks,
      (node) => taskIs(state, node, "project") && !taskIs(state, node, "inactive"),
    );

    const selectedProject = state.filter.project;

    const superproject =
      list.find((node) => IndentedList.isDescendantInList(list, selectedProject, node)) ?? selectedProject;

    const subprojects = IndentedList.filterNodes(
      state.tasks,
      (node) =>
        taskIs(state, node, "project") &&
        !taskIs(state, node, "inactive") &&
        IndentedList.isDescendant(state.tasks, node, superproject),
    );

    if (subprojects.length === 0) return null;

    return {
      title: filterTitle(state.tasks, {type: "project", project: superproject}),
      parentProject: superproject,
      children: subprojects.map((subproject) => ({
        id: subproject.id,
        title: subproject.title,
        count: 0,
        isStalled: taskIs(state, subproject, "stalled"),
      })),
    };
  } else {
    return null;
  }
}

export function counts(state: Omit<CommonState, "filter">): {
  [filter in "today" | "ready" | "stalled" | "waiting"]: number;
} {
  const list = IndentedList.toList(IndentedList.roots(state.tasks));

  function countFilter(filter: "today" | "ready" | "stalled" | "waiting"): number {
    const subtaskProperty =
      filter === "today"
        ? "nonCompletedTodayOrDueToday"
        : filter === "ready"
        ? "readyItself"
        : filter === "stalled"
        ? "stalled"
        : "waiting";

    return list.filter((task) => taskIs(state, task, subtaskProperty)).length;
  }

  return {
    today: countFilter("today"),
    ready: countFilter("ready"),
    stalled: countFilter("stalled"),
    waiting: countFilter("waiting"),
  };
}

type TaskListSectionOf<Row> = {title: string | null; filter: FilterId; rows: Row[]}[];

function mergeDropTargets(
  lists: TaskListSectionOf<TaskView>,
  state: {tasks: Tasks; taskDrag: DragState<DragId, DropId>},
): TaskListSectionOf<TaskView | DropTargetView> {
  function mergeDropTargets_(list: TaskView[], filter: FilterId) {
    function dropTargetsBelow(index: number): DropTargetView[] {
      const source = state.taskDrag.dragging?.id;
      if (!source) return [];

      const locations = IndentedList.validInsertLocationsBelow({list, tree: state.tasks}, source, index);

      function isRightmost(location: IndentedList.IndentedListInsertLocation): boolean {
        const highestIndentation = Math.max(...locations.map((l) => l.indentation));
        return location.indentation === highestIndentation;
      }

      return locations.map((location) => ({
        type: "dropTarget",
        handle: {location, filter},
        width: isRightmost(location) ? "full" : 1,
        indentation: location.indentation,
      }));
    }

    return [...dropTargetsBelow(-1), ...list.flatMap((row, index) => [row, ...dropTargetsBelow(index)])];
  }

  return lists.map((list) => ({
    ...list,
    rows: mergeDropTargets_(list.rows, list.filter),
  }));
}

function mergeDropIndicators(
  lists: TaskListSectionOf<TaskView | DropTargetView>,
  state: {tasks: Tasks; taskDrag: DragState<DragId, DropId>},
): TaskListSectionOf<TaskView | DropTargetView | DropIndicatorView> {
  function mergeDropIndicators_(list: (TaskView | DropTargetView)[], filter: FilterId) {
    function dropIndicatorsBelow(task: {id: string} | null): DropIndicatorView[] {
      return state.taskDrag.hovering?.type === "list" &&
        state.taskDrag.hovering.target.location.previousSibling?.id === task?.id &&
        JSON.stringify(state.taskDrag.hovering.target.filter) === JSON.stringify(filter)
        ? [{type: "dropIndicator" as const, indentation: state.taskDrag.hovering.target.location.indentation}]
        : [];
    }

    return [
      ...dropIndicatorsBelow(null),
      ...list.flatMap<DropIndicatorView | DropTargetView | TaskView>((row) =>
        row.type === "task" ? [row, ...dropIndicatorsBelow(row)] : [row],
      ),
    ];
  }

  return lists.map((list) => ({
    ...list,
    rows: mergeDropIndicators_(list.rows, list.filter),
  }));
}

function viewRows(state: CommonState): TaskView[] {
  const list = filterTasksIntoList(state);

  return list.map((task, index) => ({
    type: "task" as const,
    id: task.id,
    title: task.title,
    indentation: task.indentation,
    done: taskIs(state, task, "done"),
    paused: taskIs(state, task, "paused") || taskIs(state, task, "waiting"),
    archived: taskIs(state, task, "archived"),
    badges: badges(state, task),
    project: task.type === "project",
    today: taskIs(state, task, "todayOrDueToday"),
    borderBelow: index < list.length - 1,
  }));
}

function subfilters(state: CommonState, section: FilterSectionId): FilterId[] {
  if (section === "actions") return ["today", "ready", "stalled"];
  else if (section === "tasks") return ["waiting", "paused", "all", "not-done", "done"];
  else if (section === "activeProjects")
    return activeProjectList(state).map((project) => ({type: "project", project: {id: project.id}}));
  else if (section === "archive") return ["archive"];
  else {
    const unreachable: never = section;
    return unreachable;
  }
}

export function isSubfilter(state: CommonState, parent: FilterId, filter: FilterId) {
  if (typeof parent === "string" && parent === filter) return true;

  if (
    typeof parent === "object" &&
    parent.type === "project" &&
    typeof filter === "object" &&
    filter.type === "project" &&
    parent.project.id === filter.project.id
  )
    return true;

  if (
    typeof parent === "object" &&
    parent.type === "section" &&
    subfilters(state, parent.section).some((subfilter) => isSubfilter(state, subfilter, filter))
  )
    return true;

  return false;
}

export function filterTitle(tasks: Tasks, filter: FilterId): string {
  if (typeof filter === "object" && filter.type === "section") {
    const section = filter.section;
    if (section === "actions") return "Actions";
    else if (section === "tasks") return "Tasks";
    else if (section === "activeProjects") return "Active Projects";
    else if (section === "archive") return "Archive";
    else {
      const unreachable: never = section;
      return unreachable;
    }
  } else if (typeof filter === "object" && filter.type === "project") {
    return IndentedList.findNode(tasks, {id: filter.project.id})?.title ?? "";
  } else if (filter === "ready") return "Ready";
  else if (filter === "done") return "Completed";
  else if (filter === "stalled") return "Stalled";
  else if (filter === "not-done") return "Unfinished";
  else if (filter === "archive") return "Archive";
  else if (filter === "all") return "All";
  else if (filter === "paused") return "Paused";
  else if (filter === "today") return "Today";
  else if (filter === "waiting") return "Waiting";
  else {
    const unreachable: never = filter;
    return unreachable;
  }
}

export type HoverInvariantView = TaskListSectionOf<TaskView | DropTargetView>;

export function prepareHoverInvariantView(
  state: CommonState & {taskDrag: DragState<DragId, DropId>},
): HoverInvariantView {
  const subfilters_ =
    typeof state.filter === "object" && state.filter.type === "section"
      ? subfilters(state, state.filter.section)
      : [state.filter];

  const showTitle = subfilters_.length > 1;

  const lists = subfilters_.map((subfilter) => ({
    title: showTitle ? filterTitle(state.tasks, subfilter) : "",
    filter: subfilter,
    rows: viewRows({...state, filter: subfilter}),
  }));

  return mergeDropTargets(lists, state);
}

export function view(
  preparedView: HoverInvariantView,
  state: CommonState & {taskDrag: DragState<DragId, DropId>},
): TaskListView {
  return mergeDropIndicators(preparedView, state);
}
