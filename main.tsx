import * as React from "react";
import * as ReactDOM from "react-dom";
import {loadTasks, saveTasks} from "./storage";
import {CheckedEvent, TaskList} from "./task-list";
import {add, merge, Task} from "./tasks";
import {Button} from "./ui";

const style = require("./main.module.scss");

type AddEvent = {tag: "add"; title: string};

function update(tasks: Task[], ev: CheckedEvent | AddEvent): Task[] {
  if (ev.tag === "checked") return merge(tasks, [{id: ev.id, done: ev.checked}]);
  if (ev.tag === "add") return add(tasks, {title: ev.title});
}

function AddTask(props: {send(ev: AddEvent): void}) {
  return <Button onClick={() => props.send({tag: "add", title: "New task"})}>Add task</Button>;
}

function Main() {
  const [tasks, setTasks] = React.useState<Task[]>(loadTasks());

  const send = React.useCallback((ev: CheckedEvent | AddEvent) => {
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
        <AddTask send={send} />
        <TaskList tasks={tasks} send={send} />
      </div>
    </div>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
