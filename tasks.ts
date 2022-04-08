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

type DropTarget = {width: number | "full"; indentation: number; side: "above" | "below"};

export type TaskListView = {
  id: string;
  title: string;
  indentation: number;
  done: boolean;
  paused: boolean;
  project: boolean;
  badges: BadgeId[];
  dropIndicator: null | {side: "above" | "below"; indentation: number};
  dropTargets: DropTarget[];
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
  | {type: "move"; side: "above" | "below"; target: {id: string}; indentation: number}
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
    } else if (operation.type === "move") {
      return IndentedList.moveItemInSublistOfTree(
        {tree: tasks, list: IndentedList.toList(filterTasks(tasks, filter))},
        {id},
        operation,
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

export function isStalled(tasks: Tasks, task: {id: string}): boolean {
  const task_ = IndentedList.findNode(tasks, task);
  if (task_ === null) return false;

  return badges(tasks, task_).includes("stalled");
}

export type BadgeId = "ready" | "stalled" | "project";

function badges(tasks: Tasks, task: Task): BadgeId[] {
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

  return [isProject(task) && "project", isStalled && "stalled", isReady(task) && "ready"].filter(
    Boolean,
  ) as BadgeId[];
}

export type FilterId =
  | "all"
  | "ready"
  | "done"
  | "stalled"
  | "not-done"
  | "archive"
  | {type: "project"; project: {id: string}};

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
    if (taskProject(tasks, task)?.id === filter.project.id) return true;
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

export function projects(tasks: Tasks): IndentedList.IndentedListItem<TaskData & {project: true}>[] {
  return IndentedList.filterNodes(tasks, (node) => node.type === "project").map((project) => ({
    ...project,
    indentation: 0,
    project: true,
  }));
}

export function countStalledTasks(tasks: Tasks): number {
  return filterTasks(tasks, "stalled").length;
}

export function view(args: {tasks: Tasks; filter: FilterId; taskDrag: DragState<DragId, DropId>}): TaskListView {
  const {tasks, filter, taskDrag} = args;

  const filtered = filterTasks(tasks, filter);
  const list = IndentedList.toList(filtered);

  function dropIndicator(task: TaskData) {
    if (taskDrag.hovering?.type !== "task") return null;
    if (taskDrag.hovering.id !== task.id) return null;
    return {side: taskDrag.hovering.side, indentation: taskDrag.hovering.indentation};
  }

  function dropTargetsNear(index: number): DropTarget[] {
    const source = taskDrag.dragging?.id;
    if (!source) return [];

    const locations = IndentedList.validInsertLocationsNear({list, tree: tasks}, source, index);

    function isRightmost(location: IndentedList.IndentedListInsertLocation): boolean {
      const locationsInGroup = locations.filter((l) => l.side === location.side);
      const highestIndentation = Math.max(...locationsInGroup.map((l) => l.indentation));
      return location.indentation === highestIndentation;
    }

    return locations.map((location) => ({
      width: isRightmost(location) ? "full" : 1,
      indentation: location.indentation,
      side: location.side,
    }));
  }

  return list.map((task, index) => ({
    id: task.id,
    title: task.title,
    indentation: task.indentation,
    done: isDone(task),
    paused: isPaused(tasks, IndentedList.findNode(tasks, task)!),
    badges: badges(tasks, IndentedList.findNode(tasks, task)!),
    project: task.type === "project",
    dropIndicator: dropIndicator(task),
    dropTargets: dropTargetsNear(index),
  }));
}
