import {DragId, DropId} from "./app";
import {DragState} from "./drag";
import {reposition} from "./reposition";

export type Task = {
  id: string;
  title: string;
  children: Task[];
  done?: boolean;
  action?: boolean;
};

export type Tasks = Task[];

type DropTarget = {width: number | "full"; indentation: number; side: "above" | "below"};

export type TaskListView = {
  id: string;
  title: string;
  indentation: number;
  done: boolean;
  badges: ("action" | "stalled")[];
  dropIndicator: null | {side: "above" | "below"; indentation: number};
  dropTargets: DropTarget[];
}[];

export function merge(tasks: Tasks, updates: Partial<Task>[]): Tasks {
  return tasks.map((task) => {
    const update = updates.find((u) => u.id === task.id);
    return update ? {...task, ...update} : task;
  });
}

function randomId() {
  return Math.floor(Math.random() * 36 ** 8).toString(36);
}

export function add(tasks: Tasks, values: Partial<Task>): Tasks {
  return [
    ...tasks,
    {
      id: randomId(),
      title: values.title ?? "",
      children: [],
    },
  ];
}

export function find(
  tasks: Tasks,
  id: string,
): {id: string; title: string; done: boolean; action: boolean} | null {
  const task = tasks.find((task) => task.id === id) ?? null;
  if (task === null) return null;
  return {
    id: task.id,
    title: task.title,
    done: task.done ?? false,
    action: task.action ?? false,
  };
}

export type EditOperation =
  | {type: "delete"}
  | {type: "set"; property: "title"; value: string}
  | {type: "set"; property: "done"; value: boolean}
  | {type: "set"; property: "action"; value: boolean}
  | {type: "move"; side: "above" | "below"; target: string}
  | {type: "moveToFilter"; filter: FilterId};

export function edit(tasks: Tasks, id: string, operation: EditOperation): Tasks {
  if (operation.type === "delete") {
    return tasks.filter((task) => task.id !== id);
  } else if (operation.type === "set") {
    return tasks.map((task) => {
      if (task.id === id) {
        return {...task, [operation.property]: operation.value};
      }
      return task;
    });
  } else if (operation.type === "moveToFilter") {
    const filter = operation.filter;

    const update =
      filter === "actions"
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
    const sourceIndex = tasks.findIndex((task) => task.id === id);
    if (sourceIndex === -1) return tasks;

    const targetIndex = tasks.findIndex((task) => task.id === operation.target);
    if (targetIndex === -1) return tasks;

    return reposition(tasks, sourceIndex, {index: targetIndex, side: operation.side});
  } else {
    const unreachable: never = operation;
    return unreachable;
  }
}

export function badges(task: Task): ("action" | "stalled")[] {
  if (task.action && !task.done) return ["action"];
  else if (!task.done) return ["stalled"];
  else return [];
}

export type FilterId = "all" | "actions" | "done" | "stalled" | "not-done";

function unnest<T extends {children: T[]}>(items: T[]): (T & {indentation: number})[] {
  function unnest_(items: T[], indentation: number): (T & {indentation: number})[] {
    let result: (T & {indentation: number})[] = [];
    for (const item of items) {
      result = [...result, {...item, indentation}, ...unnest_(item.children, indentation + 1)];
    }
    return result;
  }

  return unnest_(items, 0);
}

export function view(args: {tasks: Tasks; filter: FilterId; taskDrag: DragState<DragId, DropId>}): TaskListView {
  const {tasks: nestedTasks, filter, taskDrag} = args;
  const tasks = unnest(nestedTasks);

  const filtered = tasks.filter((task) => {
    if (filter === "actions") return badges(task).includes("action");
    else if (filter === "done") return task.done;
    else if (filter === "stalled") return badges(task).includes("stalled");
    else if (filter === "not-done") return !task.done;
    else return true;
  });

  function dropIndicator(task: Task) {
    if (taskDrag.hovering?.type !== "task") return null;
    if (taskDrag.hovering.id !== task.id) return null;
    return {side: taskDrag.hovering.side, indentation: taskDrag.hovering.indentation};
  }

  function dropTargetsBelow(task: Task | null): DropTarget[] {
    return [
      {indentation: 0, width: 1, side: "below"},
      {indentation: 1, width: "full", side: "below"},
    ];
  }

  return filtered.map((task, index) => ({
    id: task.id,
    title: task.title,
    indentation: task.indentation,
    done: task.done ?? false,
    badges: badges(task),
    dropIndicator: dropIndicator(task),
    dropTargets: [
      ...(index === 0
        ? [{indentation: 0, width: "full", side: "above"} as const]
        : dropTargetsBelow(filtered[index - 1]).map((dropTarget) => ({...dropTarget, side: "above" as const}))),
      ...dropTargetsBelow(task),
    ],
  }));
}
