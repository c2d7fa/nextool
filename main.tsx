import * as React from "react";
import * as ReactDOM from "react-dom";
import {CheckedEvent, Task, TaskList} from "./task-list";

const style = require("./main.module.scss");

function update(tasks: Task[], ev: CheckedEvent): Task[] {
  return tasks.map((task) => (task.id === ev.id ? {...task, done: ev.checked} : task));
}

function Main() {
  const [tasks, setTasks] = React.useState<Task[]>([
    {id: "0", title: "Task 1", done: false},
    {id: "1", title: "Task 2", done: true},
    {id: "2", title: "Task 3", done: false},
  ]);

  const send = React.useCallback((ev: CheckedEvent) => {
    setTasks((tasks) => update(tasks, ev));
  }, []);

  return <TaskList tasks={tasks} send={send} />;
}

ReactDOM.render(<Main />, document.getElementById("root"));
