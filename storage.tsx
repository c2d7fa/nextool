import * as Tasks from "./tasks";
import * as App from "./app";

export type Event =
  | {tag: "storage"; type: "clickSaveButton"}
  | {tag: "storage"; type: "clickLoadButton"}
  | {tag: "storage"; type: "loadFile"; name: string; contents: string};

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

    const planned: string = (() => {
      if (has(data, "planned", "string")) {
        return data.planned;
      } else {
        return "";
      }
    })();

    return {id: data.id, title: data.title, children, status, type, archived, action, planned};
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
  const exampleData = `[{"id":"0","title":"Task 1","status":"active","action":true,"type":"task","archived":false,"planned":"","children":[{"id":"1","title":"Task 2","status":"done","action":true,"children":[],"type":"task","archived":false,"planned":""}]},{"id":"5","title":"Project1","status":"active","action":false,"archived":false,"planned":"","children":[{"id":"2","title":"Task 3","status":"active","action":true,"type":"task","archived":false,"planned":"","children":[{"id":"3","title":"Task 4","status":"paused","action":false,"children":[],"type":"task","archived":false,"planned":""}]},{"id":"4","title":"Task 5","status":"active","action":true,"children":[],"type":"task","archived":false,"planned":""}],"type":"project"},{"id":"6","title":"Project2","status":"active","action":false,"children":[],"type":"project","archived":false,"planned":""}]`;

  try {
    const tasks = convertTasks(JSON.parse(data ? data : exampleData));
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
