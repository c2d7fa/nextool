import * as React from "react";
import * as ReactDOM from "react-dom";
import {loadTasks, saveTasks} from "./storage";
import {CheckedEvent, TaskList} from "./task-list";
import {merge, Task} from "./tasks";

const style = require("./main.module.scss");

function update(tasks: Task[], ev: CheckedEvent): Task[] {
  return merge(tasks, [{id: ev.id, done: ev.checked}]);
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

  return (
    <div className={style.outerContainer}>
      <div className={style.topBar} />
      <div className={style.sidebar} />
      <div className={style.taskList}>
        <TaskList tasks={tasks} send={send} />
      </div>
    </div>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
