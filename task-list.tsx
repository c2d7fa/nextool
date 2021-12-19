import * as React from "react";

const style = require("./task-list.module.scss");

export type Task = {id: string; title: string; done: boolean};

function CheckBox(props: {task: Task}) {
  return <input type="checkbox" checked={props.task.done} readOnly />;
}

function Title(props: {task: Task}) {
  return (
    <span>
      <strong>{props.task.title}</strong> ({props.task.id})
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
