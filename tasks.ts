import {DragId, DropId} from "./app";
import {DragState} from "./drag";
import {
  Tree,
  TreeNode,
  toList,
  fromList,
  findNode,
  merge as mergeNodes,
  moveItemInTree,
  isDescendant,
  findParent,
} from "./indented-list";

type TaskData = {
  id: string;
  title: string;
  status: "active" | "paused" | "done";
  type: "task" | "project";
  action: boolean;
};

type Task = TreeNode<TaskData>;
export type Tasks = Tree<TaskData>;

export const empty: Tasks = [
  {
    id: "0",
    title: "Task 1",
    status: "active",
    action: true,
    type: "task",
    children: [{id: "1", title: "Task 2", status: "done", action: true, children: [], type: "task"}],
  },
  {
    id: "2",
    title: "Task 3",
    status: "active",
    action: true,
    type: "task",
    children: [{id: "3", title: "Task 4", status: "paused", action: false, children: [], type: "task"}],
  },
  {id: "4", title: "Task 5", status: "active", action: true, children: [], type: "task"},
];

type DropTarget = {width: number | "full"; indentation: number; side: "above" | "below"};

export type TaskListView = {
  id: string;
  title: string;
  indentation: number;
  done: boolean;
  paused: boolean;
  project: boolean;
  badges: ("ready" | "stalled")[];
  dropIndicator: null | {side: "above" | "below"; indentation: number};
  dropTargets: DropTarget[];
}[];

export function merge(tasks: Tasks, updates: ({id: string} & Partial<Task>)[]): Tasks {
  return mergeNodes(tasks, updates);
}

export function add(tasks: Tasks, values: Partial<Task>): Tasks {
  function randomId() {
    return Math.floor(Math.random() * 36 ** 8).toString(36);
  }

  return [
    ...tasks,
    {
      id: randomId(),
      title: values.title ?? "",
      action: false,
      status: "active",
      type: "task",
      children: [],
    },
  ];
}

export function find(tasks: Tasks, id: string): TaskData | null {
  return findNode(tasks, {id});
}

export type EditOperation =
  | {type: "delete"}
  | {type: "set"; property: "title"; value: string}
  | {type: "set"; property: "status"; value: "active" | "paused" | "done"}
  | {type: "set"; property: "type"; value: "task" | "project"}
  | {type: "set"; property: "action"; value: boolean}
  | {type: "move"; side: "above" | "below"; target: string; indentation: number}
  | {type: "moveToFilter"; filter: FilterId};

export function edit(tasks: Tasks, id: string, ...operations: EditOperation[]): Tasks {
  function edit_(tasks: Tasks, operation: EditOperation): Tasks {
    if (operation.type === "delete") {
      return fromList(toList(tasks.filter((task) => task.id !== id)));
    } else if (operation.type === "set") {
      return fromList(
        toList(tasks).map((task) => {
          if (task.id === id) {
            return {...task, [operation.property]: operation.value};
          }
          return task;
        }),
      );
    } else if (operation.type === "moveToFilter") {
      const filter = operation.filter;

      const update =
        filter === "ready"
          ? ({property: "action", value: true} as const)
          : filter === "done"
          ? ({property: "status", value: "done"} as const)
          : filter === "stalled"
          ? ({property: "action", value: false} as const)
          : filter === "not-done"
          ? ({property: "status", value: "active"} as const)
          : (null as never);

      return edit(tasks, id, {type: "set", ...update});
    } else if (operation.type === "move") {
      return moveItemInTree(tasks, {id}, operation);
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
  if (task.status === "paused") return true;
  const parent = findParent(tasks, task);
  if (parent) return isPaused(tasks, parent);
  return false;
}

function badges(tasks: Tasks, task: Task): ("ready" | "stalled")[] {
  if (isPaused(tasks, task)) return [];
  if (isDone(task)) return [];

  if (task.action && !task.children.some((child) => !isDone(child))) return ["ready"];
  if (!task.children.some((child) => !isDone(child) && !isPaused(tasks, child))) return ["stalled"];

  return [];
}

export type FilterId = "all" | "ready" | "done" | "stalled" | "not-done";

function doesTaskMatch(tasks: Tasks, task: Task, filter: FilterId): boolean {
  if (filter === "ready") return badges(tasks, task).includes("ready");
  else if (filter === "done") return isDone(task);
  else if (filter === "stalled") return badges(tasks, task).includes("stalled");
  else if (filter === "not-done") return !isDone(task);
  else return true;
}

function filterTasks(tasks: Tasks, filter: FilterId): Tasks {
  function filter_(tasks_: TreeNode<TaskData>[]): TreeNode<TaskData>[] {
    return tasks_.flatMap((task) => {
      const matches = doesTaskMatch(tasks, task, filter);
      if (matches) return [task];
      return filter_(task.children);
    });
  }

  return filter_(tasks);
}

export function view(args: {tasks: Tasks; filter: FilterId; taskDrag: DragState<DragId, DropId>}): TaskListView {
  const {tasks, filter, taskDrag} = args;

  const filtered = filterTasks(tasks, filter);

  function dropIndicator(task: TaskData) {
    if (taskDrag.hovering?.type !== "task") return null;
    if (taskDrag.hovering.id !== task.id) return null;
    return {side: taskDrag.hovering.side, indentation: taskDrag.hovering.indentation};
  }

  function dropTargetsBelow(tasks_: Task[], index: number): DropTarget[] {
    function dropTargetsBetween(lower: number, upper: number): DropTarget[] {
      const result: DropTarget[] = [];
      for (let i = lower; i < upper; ++i) result.push({width: 1, indentation: i, side: "below"});
      return [...result, {width: "full", indentation: upper, side: "below"}];
    }

    if (index === -1) return [{width: "full", indentation: 0, side: "below"}];

    const tasks = toList(tasks_);
    const task = tasks[index];

    const dragging = taskDrag.dragging!.id;
    const draggingIndex = tasks.findIndex((task) => task.id === dragging.id);

    const preceedingTask = tasks[index - 1];
    const preceedingTaskIndentation = preceedingTask?.indentation ?? -1;

    const followingTasks = tasks.slice(index + 1);
    const followingNonDescendentsOfDragging = followingTasks.filter(
      (task) => !isDescendant(tasks_, task, dragging),
    );

    const followingTask = tasks[index + 1];
    const followingIndentation = followingNonDescendentsOfDragging[0]?.indentation ?? 0;

    if (followingTask?.id === dragging.id) return dropTargetsBelow(tasks_, index + 1);

    const isDragging = task.id === dragging.id;

    return dropTargetsBetween(
      followingIndentation,
      isDescendant(tasks_, task, dragging)
        ? tasks[draggingIndex].indentation
        : Math.max(
            isDragging ? preceedingTaskIndentation : 0,
            isDragging ? task.indentation - 1 : task.indentation,
          ) + 1,
    );
  }

  return toList(filtered).map((task, index) => ({
    id: task.id,
    title: task.title,
    indentation: task.indentation,
    done: isDone(task),
    paused: isPaused(tasks, findNode(tasks, task)!),
    badges: badges(tasks, findNode(tasks, task)!),
    project: task.type === "project",
    dropIndicator: dropIndicator(task),
    dropTargets: taskDrag.dragging
      ? [
          ...dropTargetsBelow(filtered, index - 1).map((dropTarget) => ({
            ...dropTarget,
            side: "above" as const,
          })),
          ...dropTargetsBelow(filtered, index),
        ]
      : [],
  }));
}
