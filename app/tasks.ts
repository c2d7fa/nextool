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

export const empty: Tasks = IndentedList.empty<TaskData>();

export function merge(tasks: Tasks, updates: ({id: string} & Partial<Task>)[]): Tasks {
  return IndentedList.merge(tasks, updates);
}

export function add(
  {tasks, filter}: {tasks: Tasks; filter: FilterId},
  values: Partial<Task>,
  args: {today: Date},
): Tasks {
  function randomId() {
    return Math.floor(Math.random() * 36 ** 8).toString(36);
  }

  const id = randomId();

  const result: Tasks = IndentedList.insert(tasks, {
    id,
    title: values.title ?? "",
    action: false,
    status: "active",
    type: "task",
    archived: false,
    children: [],
    planned: null,
  });

  return edit({tasks: result, filter}, id, [{type: "moveToFilter", filter}], args);
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

export function edit(
  {tasks, filter}: {tasks: Tasks; filter: FilterId},
  id: string,
  operations: EditOperation[],
  args: {today: Date},
): Tasks {
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
          ? ({type: "set", property: "planned", value: args.today} as const)
          : filter === "paused"
          ? ({type: "set", property: "status", value: "paused"} as const)
          : null;

      const archiveUpdate =
        filter !== "archive" ? ({type: "set", property: "archived", value: false} as const) : null;

      return edit({tasks, filter}, id, [update, archiveUpdate], args);
    } else if (operation.type === "move") {
      const tasks_ = operation.target.filter
        ? edit({tasks, filter}, id, [{type: "moveToFilter", filter: operation.target.filter}], args)
        : tasks;

      return IndentedList.moveItemInSublistOfTree(
        {tree: tasks_, list: IndentedList.toList(filterTasks(tasks, operation.target.filter ?? filter, args))},
        {id},
        operation.target.location,
      );
    } else {
      const unreachable: never = operation;
      return unreachable;
    }
  }

  return operations.reduce(edit_, tasks);
}

function isDone(task: TaskData): boolean {
  return task.status === "done";
}

function isPaused(tasks: Tasks, task: Task): boolean {
  return IndentedList.anyAncestor(tasks, task, (task) => task.status === "paused");
}

function isArchived(tasks: Tasks, task: TaskData): boolean {
  return IndentedList.anyAncestor(tasks, task, (task) => task.archived);
}

function isToday(task: Task, today: Date) {
  return (task.planned && (isSameDay(task.planned, today) || isBefore(task.planned, today))) ?? false;
}

function isInactive(tasks: Tasks, task: Task): boolean {
  return isPaused(tasks, task) || isDone(task) || isArchived(tasks, task);
}

function isProject(task: Task): boolean {
  return task.type === "project";
}

function isReady(tasks: Tasks, task: Task): boolean {
  function hasReadyDescendants(task: Task): boolean {
    return task.children.some((child) => isReady(tasks, child) || hasReadyDescendants(child));
  }

  return isProject(task)
    ? hasReadyDescendants(task)
    : task.action && !isInactive(tasks, task) && !task.children.some((child) => !isDone(child));
}

function isStalledAssumingNotReady(tasks: Tasks, task: Task): boolean {
  return (
    !isInactive(tasks, task) && (isProject(task) || !task.children.some((child) => !isInactive(tasks, child)))
  );
}

export type BadgeId = "ready" | "stalled" | "project" | "today";

function badges(tasks: Tasks, task: Task, args?: {today: Date}): BadgeId[] {
  const ready = isReady(tasks, task);
  const stalled = !ready && isStalledAssumingNotReady(tasks, task);

  return [
    isProject(task) && "project",
    args?.today && isToday(task, args.today) && "today",
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

function taskProject(tasks: Tasks, task: Task): null | {id: string} {
  const parent = IndentedList.findParent(tasks, task);
  if (parent === null) return null;
  else if (parent.type === "project") return parent;
  else return taskProject(tasks, parent);
}

function doesSubtaskMatch(tasks: Tasks, task: Task, filter: FilterId): boolean {
  if (filter === "stalled") return IndentedList.anyDescendant(tasks, task, (subtask) => isStalled(tasks, subtask));
  if (filter === "ready") return IndentedList.anyDescendant(tasks, task, (subtask) => isReady(tasks, subtask));
  if (isArchived(tasks, task) && filter !== "archive") return false;
  return true;
}

function doesTaskMatch(tasks: Tasks, task: Task, filter: FilterId, {today}: {today: Date}): boolean {
  if (!doesSubtaskMatch(tasks, task, filter)) return false;

  if (typeof filter === "object") {
    if (filter.type === "project" && taskProject(tasks, task)?.id === filter.project.id) return true;
    else return false;
  }

  if (filter === "ready") return isReady(tasks, task);
  else if (filter === "done") return isDone(task);
  else if (filter === "stalled") return isStalled(tasks, task);
  else if (filter === "not-done") return !isDone(task);
  else if (filter === "archive") return task.archived;
  else if (filter === "paused") return isPaused(tasks, task);
  else if (filter === "today") return isToday(task, today);
  else return true;
}

function filterTasks(tasks: Tasks, filter: FilterId, args: {today: Date}): IndentedList.TreeNode<TaskData>[] {
  return IndentedList.searchAndTrim(tasks, {
    pick: (task) => doesTaskMatch(tasks, task, filter, args),
    include: (task) => doesSubtaskMatch(tasks, task, filter),
  });
}

export function activeProjects(
  tasks: Tasks,
): Omit<IndentedList.IndentedListItem<TaskData & {stalled: boolean}>, "children">[] {
  return IndentedList.filterNodes(tasks, (node) => node.type === "project")
    .map((project) => ({
      ...project,
      indentation: 0,
      project: true,
      stalled: isStalled(tasks, project),
    }))
    .filter((project) => project.status === "active" && !project.archived);
}

function isStalled(tasks: Tasks, task: Task): boolean {
  return !isReady(tasks, task) && isStalledAssumingNotReady(tasks, task);
}

export function count(tasks: Tasks, filter: FilterId, args: {today: Date}): number {
  return filterTasks(tasks, filter, args).length;
}

function viewRows(args: {
  tasks: Tasks;
  filter: FilterId;
  taskDrag: DragState<DragId, DropId>;
  today: Date;
}): TaskListView[number]["rows"] {
  const {tasks, filter, taskDrag} = args;

  const filtered = filterTasks(tasks, filter, args);
  const list = IndentedList.toList(filtered);

  function dropIndicatorsBelow(taskIndex: number) {
    return taskDrag.hovering?.type === "list" &&
      taskDrag.hovering.target.location.previousSibling?.id === list[taskIndex]?.id &&
      JSON.stringify(taskDrag.hovering.target.filter) === JSON.stringify(args.filter)
      ? [{type: "dropIndicator" as const, indentation: taskDrag.hovering.target.location.indentation}]
      : [];
  }

  function dropTargetsBelow(index: number): DropTargetView[] {
    const source = taskDrag.dragging?.id;
    if (!source) return [];

    const locations = IndentedList.validInsertLocationsBelow({list, tree: tasks}, source, index);

    function isRightmost(location: IndentedList.IndentedListInsertLocation): boolean {
      const highestIndentation = Math.max(...locations.map((l) => l.indentation));
      return location.indentation === highestIndentation;
    }

    return locations.map((location) => ({
      type: "dropTarget",
      handle: {location, filter: args.filter},
      width: isRightmost(location) ? "full" : 1,
      indentation: location.indentation,
    }));
  }

  return [
    ...dropIndicatorsBelow(-1),
    ...dropTargetsBelow(-1),
    ...list.flatMap((task, index) => {
      const done = isDone(task);
      const paused = isPaused(tasks, task);

      return [
        {
          type: "task" as const,
          id: task.id,
          title: task.title,
          indentation: task.indentation,
          done,
          paused,
          badges: badges(tasks, task, {today: args.today}),
          project: task.type === "project" && !done && !paused,
          today: isToday(task, args.today),
          borderBelow: index < list.length - 1,
        },
        ...dropTargetsBelow(index),
        ...dropIndicatorsBelow(index),
      ];
    }),
  ];
}

function subfilters(tasks: Tasks, section: FilterSectionId): FilterId[] {
  if (section === "actions") return ["today", "ready", "stalled"];
  else if (section === "tasks") return ["all", "not-done", "done", "paused"];
  else if (section === "activeProjects")
    return activeProjects(tasks).map((project) => ({type: "project", project: {id: project.id}}));
  else if (section === "archive") return ["archive"];
  else {
    const unreachable: never = section;
    return unreachable;
  }
}

export function isSubfilter(tasks: Tasks, parent: FilterId, filter: FilterId) {
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
    subfilters(tasks, parent.section).some((subfilter) => isSubfilter(tasks, subfilter, filter))
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

export function view(args: {
  tasks: Tasks;
  filter: FilterId;
  taskDrag: DragState<DragId, DropId>;
  today: Date;
}): TaskListView {
  if (typeof args.filter === "object" && args.filter.type === "section") {
    return subfilters(args.tasks, args.filter.section).map((subfilter) => ({
      title: filterTitle(args.tasks, subfilter),
      rows: viewRows({...args, filter: subfilter}),
    }));
  } else {
    return [{title: null, rows: viewRows(args)}];
  }
}
