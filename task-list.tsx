import * as React from "react";
import {badges, Task} from "./tasks";
import {Badge} from "./ui";

const style = require("./task-list.module.scss");

export type CheckedEvent = {tag: "checked"; id: string; checked: boolean};
export type SelectEditingTask = {tag: "selectEditingTask"; id: string};
export type EventHandler<T> = (event: T) => void;

function CheckBox(props: {task: Task; send: EventHandler<CheckedEvent>}) {
  return (
    <div
      className={[style.checkBox, props.task.done ? style.checked : style.unchecked].join(" ")}
      onClick={() => props.send({tag: "checked", id: props.task.id, checked: !props.task.done})}
    />
  );
}

function BadgeFor(props: {type: "action" | "stalled"}) {
  if (props.type === "action") return <Badge color="green">Action</Badge>;
  else if (props.type === "stalled") return <Badge color="orange">Stalled</Badge>;
  else return null;
}

function Badges(props: {task: Task}) {
  return (
    <span className={style.badge}>
      {badges(props.task).map((badge) => (
        <BadgeFor key={badge} type={badge} />
      ))}
    </span>
  );
}

function Title(props: {task: Task}) {
  return (
    <span className={[style.task, props.task.done ? style.done : style.todo].join(" ")}>
      <span className={style.title}>{props.task.title}</span>
      <Badges task={props.task} />
    </span>
  );
}

function TaskRow(props: {task: Task; send: EventHandler<CheckedEvent | SelectEditingTask>}) {
  return (
    <tr onClick={() => props.send({tag: "selectEditingTask", id: props.task.id})}>
      <td>
        <CheckBox task={props.task} send={props.send} />
      </td>
      <td>
        <Title task={props.task} />
      </td>
      <td>
        <span className={style.id}>{props.task.id}</span>
      </td>
    </tr>
  );
}

export function TaskList(props: {tasks: Task[]; send: EventHandler<CheckedEvent | SelectEditingTask>}) {
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
