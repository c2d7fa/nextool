import * as React from "react";
import * as ReactDOM from "react-dom";
import {loadTasks, saveTasks} from "./storage";
import {CheckedEvent, Task, TaskList} from "./task-list";

const style = require("./main.module.scss");

function update(tasks: Task[], ev: CheckedEvent): Task[] {
  return tasks.map((task) => (task.id === ev.id ? {...task, done: ev.checked} : task));
}

function Main() {
  const [tasks, setTasks] = React.useState<Task[]>(loadTasks());

  const send = React.useCallback((ev: CheckedEvent) => {
    setTasks((tasks) => {
      const newTasks = update(tasks, ev);
      saveTasks(newTasks);
      return newTasks;
    });
  }, []);

  return <TaskList tasks={tasks} send={send} />;
}

ReactDOM.render(<Main />, document.getElementById("root"));
