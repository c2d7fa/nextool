import * as React from "react";

const style = require("./task-list.module.scss");

export type Task = {id: string; title: string; done: boolean};

function CheckBox(props: {task: Task}) {
  return <div className={[style.checkBox, props.task.done ? style.checked : style.unchecked].join(" ")} />;
}

function Title(props: {task: Task}) {
  return (
    <span className={[style.task, props.task.done ? style.done : style.todo].join(" ")}>
      <span className={style.title}>{props.task.title}</span> <span className={style.id}>{props.task.id}</span>
    </span>
  );
}

function TaskRow(props: {task: Task}) {
  return (
    <tr>
      <td>
        <CheckBox task={props.task} />
      </td>
      <td>
        <Title task={props.task} />
      </td>
    </tr>
  );
}

export function TaskList(props: {tasks: Task[]}) {
  return (
    <table className={style.taskList}>
      <tbody>
        {props.tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </tbody>
    </table>
  );
}
