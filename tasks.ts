export type Task = {
  id: string;
  title: string;
  done?: boolean;
  action?: boolean;
};

export type Tasks = Task[];

export type TaskList = {id: string; title: string; done: boolean; badges: ("action" | "stalled")[]}[];

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

export function badges(task: Task): ("action" | "stalled")[] {
  if (task.action && !task.done) return ["action"];
  else if (!task.done) return ["stalled"];
  else return [];
}

export function list(tasks: Tasks, filter: "all" | "actions" | "done" | "stalled"): TaskList {
  const filtered = tasks.filter((task) => {
    if (filter === "actions") return badges(task).includes("action");
    else if (filter === "done") return task.done;
    else if (filter === "stalled") return badges(task).includes("stalled");
    else return true;
  });

  return filtered.map((task) => ({
    id: task.id,
    title: task.title,
    done: task.done ?? false,
    badges: badges(task),
  }));
}
