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
};

type Task = IndentedList.TreeNode<TaskData>;
export type Tasks = IndentedList.Tree<TaskData>;

export const empty: Tasks = [
  {
    id: "0",
    title: "Task 1",
    status: "active",
    action: true,
    type: "task",
    archived: false,
    children: [
      {id: "1", title: "Task 2", status: "done", action: true, children: [], type: "task", archived: false},
    ],
  },
  {
    id: "5",
    title: "Project 1",
    status: "active",
    action: false,
    archived: false,
    children: [
      {
        id: "2",
        title: "Task 3",
        status: "active",
        action: true,
        type: "task",
        archived: false,
        children: [
          {id: "3", title: "Task 4", status: "paused", action: false, children: [], type: "task", archived: false},
        ],
      },
      {id: "4", title: "Task 5", status: "active", action: true, children: [], type: "task", archived: false},
    ],
    type: "project",
  },
  {
    id: "6",
    title: "Project 2",
    status: "active",
    action: false,
    children: [],
    type: "project",
    archived: false,
  },
];

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
    },
  ];

  return edit(result, id, {type: "moveToFilter", filter});
}

export function find(tasks: Tasks, id: string): TaskData | null {
  return IndentedList.findNode(tasks, {id});
}

export type EditOperation =
  | {type: "set"; property: "title"; value: string}
  | {type: "set"; property: "status"; value: "active" | "paused" | "done"}
  | {type: "set"; property: "type"; value: "task" | "project"}
  | {type: "set"; property: "action" | "archived"; value: boolean}
  | {type: "move"; side: "above" | "below"; target: string; indentation: number}
  | {type: "moveToFilter"; filter: FilterId}
  | null;

export function edit(tasks: Tasks, id: string, ...operations: EditOperation[]): Tasks {
  function edit_(tasks: Tasks, operation: EditOperation): Tasks {
    if (operation === null) return tasks;

    if (operation.type === "set") {
      return IndentedList.fromList(
        IndentedList.toList(tasks).map((task) => {
          if (task.id === id) {
            return {...task, [operation.property]: operation.value};
          }
          return task;
        }),
      );
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

      return edit(tasks, id, update, archiveUpdate);
    } else if (operation.type === "move") {
      return IndentedList.moveItemInTree(tasks, {id}, operation);
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
    return isPaused(tasks, task) || isDone(task);
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

    const tasks = IndentedList.toList(tasks_);
    const task = tasks[index];

    const dragging = taskDrag.dragging!.id;
    const draggingIndex = tasks.findIndex((task) => task.id === dragging.id);

    const preceedingTask = tasks[index - 1];
    const preceedingTaskIndentation = preceedingTask?.indentation ?? -1;

    const followingTasks = tasks.slice(index + 1);
    const followingNonDescendentsOfDragging = followingTasks.filter(
      (task) => !IndentedList.isDescendant(tasks_, task, dragging),
    );

    const followingTask = tasks[index + 1];
    const followingIndentation = followingNonDescendentsOfDragging[0]?.indentation ?? 0;

    if (followingTask?.id === dragging.id) return dropTargetsBelow(tasks_, index + 1);

    const isDragging = task.id === dragging.id;

    return dropTargetsBetween(
      followingIndentation,
      IndentedList.isDescendant(tasks_, task, dragging)
        ? tasks[draggingIndex].indentation
        : Math.max(
            isDragging ? preceedingTaskIndentation : 0,
            isDragging ? task.indentation - 1 : task.indentation,
          ) + 1,
    );
  }

  return IndentedList.toList(filtered).map((task, index) => ({
    id: task.id,
    title: task.title,
    indentation: task.indentation,
    done: isDone(task),
    paused: isPaused(tasks, IndentedList.findNode(tasks, task)!),
    badges: badges(tasks, IndentedList.findNode(tasks, task)!),
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
