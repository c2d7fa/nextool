import * as Tasks from "./tasks";

export function loadTasks() {
  const tasks = window.localStorage.getItem("tasks");
  return tasks ? JSON.parse(tasks) : Tasks.empty;
}

export function saveTasks(tasks: Tasks.Tasks) {
  window.localStorage.setItem("tasks", JSON.stringify(tasks));
}
