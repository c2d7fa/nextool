import * as React from "react";
import {badges, TaskList} from "./tasks";
import {Badge} from "./ui";

const style = require("./task-list.module.scss");

export type CheckedEvent = {tag: "checked"; id: string; checked: boolean};
export type SelectEditingTask = {tag: "selectEditingTask"; id: string};
export type EventHandler<T> = (event: T) => void;

function CheckBox(props: {checked: boolean; id: string; send: EventHandler<CheckedEvent>}) {
  return (
    <div
      className={[style.checkBox, props.checked ? style.checked : style.unchecked].join(" ")}
      onClick={() => props.send({tag: "checked", id: props.id, checked: !props.checked})}
    />
  );
}

function BadgeFor(props: {type: "action" | "stalled"}) {
  if (props.type === "action") return <Badge color="green">Action</Badge>;
  else if (props.type === "stalled") return <Badge color="orange">Stalled</Badge>;
  else return null;
}

function Badges(props: {task: TaskList[number]}) {
  return (
    <span className={style.badge}>
      {props.task.badges.map((badge) => (
        <BadgeFor type={badge} key={badge} />
      ))}
    </span>
  );
}

function Title(props: {task: TaskList[number]}) {
  return (
    <span className={[style.task, props.task.done ? style.done : style.todo].join(" ")}>
      <span className={style.title}>{props.task.title}</span>
      <Badges task={props.task} />
    </span>
  );
}

function TaskRow(props: {task: TaskList[number]; send: EventHandler<CheckedEvent | SelectEditingTask>}) {
  return (
    <tr onClick={() => props.send({tag: "selectEditingTask", id: props.task.id})}>
      <td>
        <CheckBox checked={props.task.done} id={props.task.id} send={props.send} />
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

export function TaskList(props: {taskList: TaskList; send: EventHandler<CheckedEvent | SelectEditingTask>}) {
  return (
    <table className={style.taskList}>
      <tbody>
        {props.taskList.map((task) => (
          <TaskRow key={task.id} task={task} send={props.send} />
        ))}
      </tbody>
    </table>
  );
}
