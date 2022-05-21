import {isBefore, isSameDay} from "date-fns";
import {DragId, DropId} from "./app";
import {DragState} from "./drag";
import * as IndentedList from "./indented-list";

type TaskData = {
  id: string;
  title: string;
  status: "active" | "paused" | "done";
  type: "task" | "project";
  archived: boolean;
  action: boolean;
  planned: Date | null;
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
  project: boolean;
  today: boolean;
  badges: BadgeId[];
  borderBelow: boolean;
};

export type TaskListView = {
  title: null | string;
  rows: (DropTargetView | DropIndicatorView | TaskView)[];
}[];

export type SubtaskFilter = {id: "paused"; state: "include" | "exclude"};
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
  | {type: "set"; property: "planned"; value: Date | null}
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
          list: IndentedList.toList(filterTasks({...state, filter: operation.target.filter ?? state.filter})),
        },
        {id},
        operation.target.location,
      );
    } else {
      const unreachable: never = operation;
      return unreachable;
    }
  }

  return operations.reduce(edit_, state.tasks);
}

function isDone(task: TaskData): boolean {
  return task.status === "done";
}

function isPaused(state: CommonState, task: Task): boolean {
  return IndentedList.anyAncestor(state.tasks, task, (task) => task.status === "paused");
}

function isArchived(state: CommonState, task: TaskData): boolean {
  return IndentedList.anyAncestor(state.tasks, task, (task) => task.archived);
}

function isToday(state: CommonState, task: Task) {
  return (task.planned && (isSameDay(task.planned, state.today) || isBefore(task.planned, state.today))) ?? false;
}

function isInactive(state: CommonState, task: Task): boolean {
  return isPaused(state, task) || isDone(task) || isArchived(state, task);
}

function isProject(task: Task): boolean {
  return task.type === "project";
}

function isReady(state: CommonState, task: Task): boolean {
  function hasReadyDescendants(task: Task): boolean {
    return task.children.some((child) => isReady(state, child) || hasReadyDescendants(child));
  }

  return isProject(task)
    ? hasReadyDescendants(task)
    : task.action && !isInactive(state, task) && !task.children.some((child) => !isDone(child));
}

function isStalledAssumingNotReady(state: CommonState, task: Task): boolean {
  return (
    !isInactive(state, task) && (isProject(task) || !task.children.some((child) => !isInactive(state, child)))
  );
}

export type BadgeId = "ready" | "stalled" | "project" | "today";

function badges(state: CommonState, task: Task): BadgeId[] {
  const ready = isReady(state, task);
  const stalled = !ready && isStalledAssumingNotReady(state, task);

  return [
    isProject(task) && "project",
    isToday(state, task) && "today",
    stalled && "stalled",
    ready && "ready",
  ].filter(Boolean) as BadgeId[];
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
  | {type: "project"; project: {id: string}}
  | {type: "section"; section: FilterSectionId};

function taskProject(state: CommonState, task: Task): null | {id: string} {
  const parent = IndentedList.findParent(state.tasks, task);
  if (parent === null) return null;
  else if (parent.type === "project") return parent;
  else return taskProject(state, parent);
}

function doesSubtaskMatch(state: CommonState, task: Task): boolean {
  const pausedSubtaskFilter = state.subtaskFilters.find((filter) => filter.id === "paused")?.state ?? "neutral";
  if (pausedSubtaskFilter !== "neutral") {
    if (
      pausedSubtaskFilter === "include" &&
      !IndentedList.anyDescendant(state.tasks, task, (subtask) => isPaused(state, subtask))
    )
      return false;
    else if (pausedSubtaskFilter === "exclude" && isPaused(state, task)) return false;
  }

  if (isArchived(state, task) && state.filter !== "archive") return false;
  if (state.filter === "stalled" || state.filter === "ready")
    return IndentedList.anyDescendant(state.tasks, task, (subtask) => doesTaskMatch(state, subtask));
  return true;
}

function doesTaskMatch(state: CommonState, task: Task): boolean {
  if (isArchived(state, task) && state.filter !== "archive") return false;

  if (typeof state.filter === "object") {
    if (state.filter.type === "project" && taskProject(state, task)?.id === state.filter.project.id) return true;
    else return false;
  }

  if (state.filter === "ready") return isReady(state, task);
  else if (state.filter === "done") return isDone(task);
  else if (state.filter === "stalled") return isStalled(state, task);
  else if (state.filter === "not-done") return !isDone(task);
  else if (state.filter === "archive") return task.archived;
  else if (state.filter === "paused") return isPaused(state, task);
  else if (state.filter === "today") return isToday(state, task);
  else return true;
}

function filterTasks(state: CommonState): IndentedList.TreeNode<TaskData>[] {
  return IndentedList.searchAndTrim(state.tasks, {
    pick: (task) => doesTaskMatch(state, task),
    include: (task) => doesSubtaskMatch(state, task),
  });
}

export function activeProjects(
  state: CommonState,
): Omit<IndentedList.IndentedListItem<TaskData & {stalled: boolean}>, "children">[] {
  return IndentedList.filterNodes(state.tasks, (node) => node.type === "project")
    .map((project) => ({
      ...project,
      indentation: 0,
      project: true,
      stalled: isStalled(state, project),
    }))
    .filter((project) => project.status === "active" && !project.archived);
}

function isStalled(state: CommonState, task: Task): boolean {
  return !isReady(state, task) && isStalledAssumingNotReady(state, task);
}

export function count(state: Omit<CommonState, "filter">, filter: FilterId): number {
  return filterTasks({...state, filter}).length;
}

function viewRows(
  state: CommonState & {
    taskDrag: DragState<DragId, DropId>;
  },
): TaskListView[number]["rows"] {
  const filtered = filterTasks(state);
  const list = IndentedList.toList(filtered);

  function dropIndicatorsBelow(taskIndex: number) {
    return state.taskDrag.hovering?.type === "list" &&
      state.taskDrag.hovering.target.location.previousSibling?.id === list[taskIndex]?.id &&
      JSON.stringify(state.taskDrag.hovering.target.filter) === JSON.stringify(state.filter)
      ? [{type: "dropIndicator" as const, indentation: state.taskDrag.hovering.target.location.indentation}]
      : [];
  }

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
      handle: {location, filter: state.filter},
      width: isRightmost(location) ? "full" : 1,
      indentation: location.indentation,
    }));
  }

  return [
    ...dropIndicatorsBelow(-1),
    ...dropTargetsBelow(-1),
    ...list.flatMap((task, index) => {
      return [
        {
          type: "task" as const,
          id: task.id,
          title: task.title,
          indentation: task.indentation,
          done: isDone(task),
          paused: isPaused(state, task),
          badges: badges(state, task),
          project: task.type === "project",
          today: isToday(state, task),
          borderBelow: index < list.length - 1,
        },
        ...dropTargetsBelow(index),
        ...dropIndicatorsBelow(index),
      ];
    }),
  ];
}

function subfilters(state: CommonState, section: FilterSectionId): FilterId[] {
  if (section === "actions") return ["today", "ready", "stalled"];
  else if (section === "tasks") return ["all", "not-done", "done", "paused"];
  else if (section === "activeProjects")
    return activeProjects(state).map((project) => ({type: "project", project: {id: project.id}}));
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
  else {
    const unreachable: never = filter;
    return unreachable;
  }
}

export function view(
  state: CommonState & {
    taskDrag: DragState<DragId, DropId>;
  },
): TaskListView {
  if (typeof state.filter === "object" && state.filter.type === "section") {
    return subfilters(state, state.filter.section).map((subfilter) => ({
      title: filterTitle(state.tasks, subfilter),
      rows: viewRows({...state, filter: subfilter}),
    }));
  } else {
    return [{title: null, rows: viewRows(state)}];
  }
}
