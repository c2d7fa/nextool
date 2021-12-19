import * as React from "react";

const style = require("./task-list.module.scss");

export type Task = {id: string; title: string; done: boolean};

export type CheckedEvent = {tag: "checked"; id: string; checked: boolean};
export type EventHandler<T> = (event: T) => void;

function CheckBox(props: {task: Task; send: EventHandler<CheckedEvent>}) {
  return (
    <div
      className={[style.checkBox, props.task.done ? style.checked : style.unchecked].join(" ")}
      onClick={() => props.send({tag: "checked", id: props.task.id, checked: !props.task.done})}
    />
  );
}

function Title(props: {task: Task}) {
  return (
    <span className={[style.task, props.task.done ? style.done : style.todo].join(" ")}>
      <span className={style.title}>{props.task.title}</span> <span className={style.id}>{props.task.id}</span>
    </span>
  );
}

function TaskRow(props: {task: Task; send: EventHandler<CheckedEvent>}) {
  return (
    <tr>
      <td>
        <CheckBox task={props.task} send={props.send} />
      </td>
      <td>
        <Title task={props.task} />
      </td>
    </tr>
  );
}

export function TaskList(props: {tasks: Task[]; send: EventHandler<CheckedEvent>}) {
  return (
    <table className={style.taskList}>
      <tbody>
        {props.tasks.map((task) => (
          <TaskRow key={task.id} task={task} send={props.send} />
        ))}
      </tbody>
    </table>
  );
}
