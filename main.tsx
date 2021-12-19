import * as React from "react";
import * as ReactDOM from "react-dom";
import {Task, TaskList} from "./task-list";

const style = require("./main.module.scss");

const tasks: Task[] = [
  {id: "0", title: "Task 1", done: false},
  {id: "1", title: "Task 2", done: true},
  {id: "2", title: "Task 3", done: false},
];

function Main() {
  return <TaskList tasks={tasks} />;
}

ReactDOM.render(<Main />, document.getElementById("root"));
