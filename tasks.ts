export type Task = {
  id: string;
  title: string;
  done?: boolean;
  action?: boolean;
};

export type Tasks = Task[];

export type TaskListView = {
  id: string;
  title: string;
  done: boolean;
  badges: ("action" | "stalled")[];
  dropIndicator: {top: boolean; bottom: boolean};
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
  | {type: "moveToFilter"; filter: "actions" | "done" | "stalled"};

export function moveToFilterSupported(filter: string): filter is "actions" | "done" | "stalled" {
  return filter === "actions" || filter === "done" || filter === "stalled";
}

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
        : (null as never);

    return edit(tasks, id, {type: "set", ...update});
  } else if (operation.type === "move") {
    const side = operation.side;
    const target = operation.target;

    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) return tasks;

    const newTasks = [...tasks];
    newTasks.splice(index, 1);
    const targetIndex = tasks.findIndex((task) => task.id === target);
    if (targetIndex === -1) return tasks;

    if (side === "above") {
      newTasks.splice(targetIndex, 0, {...tasks[index], id: tasks[index].id});
    } else {
      newTasks.splice(targetIndex + 1, 0, {...tasks[index], id: tasks[index].id});
    }

    return newTasks;
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

export function list(tasks: Tasks, filter: FilterId): TaskListView {
  const filtered = tasks.filter((task) => {
    if (filter === "actions") return badges(task).includes("action");
    else if (filter === "done") return task.done;
    else if (filter === "stalled") return badges(task).includes("stalled");
    else if (filter === "not-done") return !task.done;
    else return true;
  });

  return filtered.map((task, index) => ({
    id: task.id,
    title: task.title,
    done: task.done ?? false,
    badges: badges(task),
    dropIndicator: {top: false, bottom: index === 4},
  }));
}
