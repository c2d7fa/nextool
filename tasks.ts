import {isSameDay} from "date-fns";
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

type Task = IndentedList.TreeNode<TaskData>;
export type Tasks = IndentedList.Tree<TaskData>;

export type DropTargetHandle = {
  id: string;
  indentation: number;
  side: "above" | "below";
};

export type DropTargetView = {type: "dropTarget"; width: number | "full"} & DropTargetHandle;

type DropIndicatorView = {
  type: "dropIndicator";
  side: "above" | "below";
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
};

export type TaskListView = {
  title: null | string;
  rows: (DropTargetView | DropIndicatorView | TaskView)[];
}[];

export function merge(tasks: Tasks, updates: ({id: string} & Partial<Task>)[]): Tasks {
  return IndentedList.merge(tasks, updates);
}

export function add({tasks, filter}: {tasks: Tasks; filter: FilterId}, values: Partial<Task>): Tasks {
  function randomId() {
    return Math.floor(Math.random() * 36 ** 8).toString(36);
  }

  const id = randomId();

  const result: Tasks = [
    ...tasks,
    {
      id,
      title: values.title ?? "",
      action: false,
      status: "active",
      type: "task",
      archived: false,
      children: [],
      planned: null,
    },
  ];

  return edit({tasks: result, filter}, id, {type: "moveToFilter", filter});
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
  | {type: "drop"; target: {id: string; side: "above" | "below"; indentation: number}}
  | {type: "moveToFilter"; filter: FilterId}
  | null;

export function edit(
  {tasks, filter}: {tasks: Tasks; filter: FilterId},
  id: string,
  ...operations: EditOperation[]
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
          : null;

      const archiveUpdate =
        filter !== "archive" ? ({type: "set", property: "archived", value: false} as const) : null;

      return edit({tasks, filter}, id, update, archiveUpdate);
    } else if (operation.type === "drop") {
      const location = {
        side: operation.target.side,
        target: {id: operation.target.id},
        indentation: operation.target.indentation,
      };

      return IndentedList.moveItemInSublistOfTree(
        {tree: tasks, list: IndentedList.toList(filterTasks(tasks, filter))},
        {id},
        location,
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

function isStalled(tasks: Tasks, task: {id: string}): boolean {
  const task_ = IndentedList.findNode(tasks, task);
  if (task_ === null) return false;

  return badges(tasks, task_).includes("stalled");
}

function isToday(tasks: Tasks, task: Task, today: Date) {
  return (task.planned && isSameDay(task.planned, today)) ?? false;
}

export type BadgeId = "ready" | "stalled" | "project" | "today";

function badges(tasks: Tasks, task: Task, args?: {today: Date}): BadgeId[] {
  function isProject(task: Task): boolean {
    return task.type === "project";
  }

  function isInactive(task: Task): boolean {
    return isPaused(tasks, task) || isDone(task) || isArchived(tasks, task);
  }

  function isReady(task: Task): boolean {
    const hasUnfinishedChildren = task.children.some((child) => !isDone(child));
    return !isInactive(task) && !isProject(task) && task.action && !hasUnfinishedChildren;
  }

  function isStalledTask(task: Task): boolean {
    const hasActiveChildren = task.children.some((child) => !isInactive(child));
    return !isInactive(task) && !isReady(task) && !hasActiveChildren;
  }

  function hasReadyDescendants(task: Task): boolean {
    return task.children.some((child) => isReady(child) || hasReadyDescendants(child));
  }

  const isStalled = isStalledTask(task) || (isProject(task) && !isInactive(task) && !hasReadyDescendants(task));

  return [
    isProject(task) && "project",
    args?.today && isToday(tasks, task, args.today) && "today",
    isStalled && "stalled",
    isReady(task) && "ready",
  ].filter(Boolean) as BadgeId[];
}

type FilterSectionId = "actions" | "tasks" | "activeProjects" | "archive";

export type FilterId =
  | "all"
  | "ready"
  | "done"
  | "stalled"
  | "not-done"
  | "archive"
  | {type: "project"; project: {id: string}}
  | {type: "section"; section: FilterSectionId};

function taskProject(tasks: Tasks, task: Task): null | {id: string} {
  const parent = IndentedList.findParent(tasks, task);
  if (parent === null) return null;
  else if (parent.type === "project") return parent;
  else return taskProject(tasks, parent);
}

function doesSubtaskMatch(tasks: Tasks, task: Task, filter: FilterId): boolean {
  if (isArchived(tasks, task) && filter !== "archive") return false;
  return true;
}

function doesTaskMatch(tasks: Tasks, task: Task, filter: FilterId): boolean {
  if (!doesSubtaskMatch(tasks, task, filter)) return false;

  if (typeof filter === "object") {
    if (filter.type === "project" && taskProject(tasks, task)?.id === filter.project.id) return true;
    else return false;
  }

  if (filter === "ready") return badges(tasks, task).includes("ready");
  else if (filter === "done") return isDone(task);
  else if (filter === "stalled") return badges(tasks, task).includes("stalled");
  else if (filter === "not-done") return !isDone(task);
  else if (filter === "archive") return task.archived;
  else return true;
}

function filterTasks(tasks: Tasks, filter: FilterId): Tasks {
  function filterSubtasks_(subtasks: IndentedList.TreeNode<TaskData>[]): IndentedList.TreeNode<TaskData>[] {
    return subtasks.flatMap((subtask) => {
      if (!doesSubtaskMatch(tasks, subtask, filter)) return [];
      else return [{...subtask, children: filterSubtasks_(subtask.children)}];
    });
  }

  function filter_(tasks_: IndentedList.TreeNode<TaskData>[]): IndentedList.TreeNode<TaskData>[] {
    return tasks_.flatMap((task) => {
      const matches = doesTaskMatch(tasks, task, filter);
      if (matches) return [{...task, children: filterSubtasks_(task.children)}];
      return filter_(task.children);
    });
  }

  return filter_(tasks);
}

export function activeProjects(tasks: Tasks): IndentedList.IndentedListItem<TaskData & {stalled: boolean}>[] {
  return IndentedList.filterNodes(tasks, (node) => node.type === "project")
    .map((project) => ({
      ...project,
      indentation: 0,
      project: true,
      stalled: isStalled(tasks, {id: project.id}),
    }))
    .filter((project) => project.status === "active" && !project.archived);
}

export function countStalledTasks(tasks: Tasks): number {
  return filterTasks(tasks, "stalled").length;
}

function viewRows(args: {
  tasks: Tasks;
  filter: FilterId;
  taskDrag: DragState<DragId, DropId>;
  today: Date;
}): TaskListView[number]["rows"] {
  const {tasks, filter, taskDrag} = args;

  const filtered = filterTasks(tasks, filter);
  const list = IndentedList.toList(filtered);

  function dropIndicator(task: TaskData) {
    if (taskDrag.hovering?.type !== "list") return null;
    if (taskDrag.hovering.target.id !== task.id) return null;
    return {
      type: "dropIndicator" as const,
      side: taskDrag.hovering.target.side,
      indentation: taskDrag.hovering.target.indentation,
    };
  }

  function dropTargetsNear(index: number): DropTargetView[] {
    const source = taskDrag.dragging?.id;
    if (!source) return [];

    const locations = IndentedList.validInsertLocationsNear({list, tree: tasks}, source, index);

    function isRightmost(location: IndentedList.IndentedListInsertLocation): boolean {
      const locationsInGroup = locations.filter((l) => l.side === location.side);
      const highestIndentation = Math.max(...locationsInGroup.map((l) => l.indentation));
      return location.indentation === highestIndentation;
    }

    return locations.map((location) => ({
      id: list[index]!.id,
      type: "dropTarget",
      width: isRightmost(location) ? "full" : 1,
      indentation: location.indentation,
      side: location.side,
    }));
  }

  const dropTargetsAbove = (index: number) => dropTargetsNear(index).filter((target) => target.side === "above");
  const dropTargetsBelow = (index: number) => dropTargetsNear(index).filter((target) => target.side === "below");
  const dropIndicatorAbove = (index: number) =>
    dropIndicator(list[index]!)?.side === "above" ? dropIndicator(list[index]!) : null;
  const dropIndicatorBelow = (index: number) =>
    dropIndicator(list[index]!)?.side === "below" ? dropIndicator(list[index]!) : null;

  return list.flatMap((task, index) => [
    ...(index === 0 ? dropTargetsAbove(index) : []),
    ...(dropIndicatorAbove(index) !== null ? [dropIndicatorAbove(index)!] : []),
    {
      type: "task",
      id: task.id,
      title: task.title,
      indentation: task.indentation,
      done: isDone(task),
      paused: isPaused(tasks, IndentedList.findNode(tasks, task)!),
      badges: badges(tasks, IndentedList.findNode(tasks, task)!, {today: args.today}),
      project: task.type === "project",
      today: isToday(tasks, IndentedList.findNode(tasks, task)!, args.today),
    },
    ...dropTargetsBelow(index),
    ...(dropIndicatorBelow(index) !== null ? [dropIndicatorBelow(index)!] : []),
  ]);
}

function subfilters(tasks: Tasks, section: FilterSectionId): FilterId[] {
  if (section === "actions") return ["ready", "stalled"];
  else if (section === "tasks") return ["all", "not-done", "done"];
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
