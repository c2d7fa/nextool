import * as Tasks from "./tasks";
import * as App from "./app";

function convertTasks(data: unknown): Tasks.Tasks | null {
  if (typeof data !== "object" || !(data instanceof Array)) return null;
  return data;
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
