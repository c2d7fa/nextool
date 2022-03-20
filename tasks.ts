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
} from "./indented-list";

type TaskData = {
  id: string;
  title: string;
  done: boolean;
  action: boolean;
};

type Task = TreeNode<TaskData>;
export type Tasks = Tree<TaskData>;

export const empty: Tasks = [
  {id: "0", title: "Task 1", done: false, action: false, children: []},
  {id: "1", title: "Task 2", done: true, action: true, children: []},
  {id: "2", title: "Task 3", done: false, action: true, children: []},
  {id: "3", title: "Task 4", done: false, action: false, children: []},
  {id: "4", title: "Task 5", done: false, action: true, children: []},
];

type DropTarget = {width: number | "full"; indentation: number; side: "above" | "below"};

export type TaskListView = {
  id: string;
  title: string;
  indentation: number;
  done: boolean;
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
      done: false,
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
  | {type: "set"; property: "done"; value: boolean}
  | {type: "set"; property: "action"; value: boolean}
  | {type: "move"; side: "above" | "below"; target: string; indentation: number}
  | {type: "moveToFilter"; filter: FilterId};

export function edit(tasks: Tasks, id: string, operation: EditOperation): Tasks {
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
        ? ({property: "done", value: true} as const)
        : filter === "stalled"
        ? ({property: "action", value: false} as const)
        : filter === "not-done"
        ? ({property: "done", value: false} as const)
        : (null as never);

    return edit(tasks, id, {type: "set", ...update});
  } else if (operation.type === "move") {
    return moveItemInTree(tasks, {id}, operation);
  } else {
    const unreachable: never = operation;
    return unreachable;
  }
}

function badges(task: Task): ("ready" | "stalled")[] {
  if (task.action && !task.done && !task.children.some((child) => !child.done)) return ["ready"];
  else if (!task.done && !task.children.some((child) => !child.done)) return ["stalled"];
  else return [];
}

export type FilterId = "all" | "ready" | "done" | "stalled" | "not-done";

function doesTaskMatch(task: Task, filter: FilterId): boolean {
  if (filter === "ready") return badges(task).includes("ready");
  else if (filter === "done") return task.done;
  else if (filter === "stalled") return badges(task).includes("stalled");
  else if (filter === "not-done") return !task.done;
  else return true;
}

function filterTasks(tasks: Tasks, filter: FilterId): Tasks {
  return tasks.flatMap((task) => {
    const matches = doesTaskMatch(task, filter);
    if (matches) return [task];
    return filterTasks(task.children, filter);
  });
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
    if (index === -1) return [{width: "full", indentation: 0, side: "below"}];

    const tasks = toList(tasks_);
    const task = tasks[index];

    const dragging = taskDrag.dragging!.id;

    const followingTask = tasks[index + 1];
    const followingIndentation = followingTask?.indentation ?? 0;

    if (followingTask?.id === dragging.id) return dropTargetsBelow(tasks_, index + 1);

    if (task.id === dragging.id) {
      let result: DropTarget[] = [];
      for (let i = 0; i <= task.indentation - 1; i++) {
        result.push({width: 1, indentation: i, side: "below"});
      }
      result.push({indentation: task.indentation, width: "full", side: "below"});
      return result;
    }

    if (isDescendant(tasks_, task, dragging)) {
      return [];
    }

    let result: DropTarget[] = [];
    for (let i = followingIndentation; i <= task.indentation; i++) {
      result.push({width: 1, indentation: i, side: "below"});
    }
    result.push({indentation: task.indentation + 1, width: "full", side: "below"});
    return result;
  }

  return toList(filtered).map((task, index) => ({
    id: task.id,
    title: task.title,
    indentation: task.indentation,
    done: task.done ?? false,
    badges: badges(findNode(tasks, task)!),
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
