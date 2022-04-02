import * as Tasks from "./tasks";
import * as App from "./app";

type TypeNames = {
  string: string;
  number: number;
  boolean: boolean;
  object: object;
};

function has<Type extends keyof TypeNames, K extends string>(
  data: unknown,
  key: K,
  type: Type,
): data is {[key in K]: TypeNames[Type]} {
  if (typeof data !== "object" || data === null) return false;
  if (!(key in data)) return false;
  if (typeof (data as any)[key] !== type) return false;
  return true;
}

function convertTasks(data: unknown): Tasks.Tasks | null {
  function convertTask(data: unknown): Tasks.Tasks[number] | null {
    if (typeof data !== "object" || data === null) return null;
    if (!has(data, "id", "string")) return null;
    if (!has(data, "title", "string")) return null;

    const children = (() => {
      if (!has(data, "children", "object")) return [];
      if (!(data.children instanceof Array)) return null;
      let result: Tasks.Tasks[number][] = [];
      for (const child of data.children) {
        const converted = convertTask(child);
        if (converted === null) return null;
        result.push(converted);
      }
      return result;
    })();

    if (children === null) return null;

    const status: "active" | "paused" | "done" = (() => {
      if (has(data, "status", "string")) {
        return data.status === "paused" ? "paused" : data.status === "done" ? "done" : "active";
      } else if (has(data, "done", "boolean")) {
        return data.done ? "done" : "active";
      } else {
        return "active";
      }
    })();

    const type: "task" | "project" = (() => {
      if (has(data, "type", "string")) {
        return data.type === "project" ? "project" : "task";
      } else {
        return "task";
      }
    })();

    const archived: boolean = (() => {
      if (has(data, "archived", "boolean")) {
        return data.archived;
      } else {
        return false;
      }
    })();

    const action: boolean = (() => {
      if (has(data, "action", "boolean")) {
        return data.action;
      } else {
        return false;
      }
    })();

    return {id: data.id, title: data.title, children, status, type, archived, action};
  }

  if (typeof data !== "object" || !(data instanceof Array)) return null;

  let tasks: Tasks.Tasks = [];

  for (const taskData of data) {
    const task = convertTask(taskData);
    if (task === null) return null;
    tasks.push(task);
  }

  return tasks;
}

export function loadString(data: string | null): App.State {
  try {
    const tasks = data ? convertTasks(JSON.parse(data)) : Tasks.empty;
    if (tasks === null) return App.empty;
    return {...App.empty, tasks};
  } catch (e) {
    return App.empty;
  }
}

export function saveString(tasks: Tasks.Tasks): string {
  return JSON.stringify(tasks);
}

export function loadState(): App.State {
  return loadString(window.localStorage.getItem("tasks"));
}

export function saveTasks(tasks: Tasks.Tasks) {
  window.localStorage.setItem("tasks", saveString(tasks));
}
