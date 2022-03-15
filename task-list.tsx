import * as React from "react";
import {TaskListView} from "./tasks";
import {Badge} from "./ui";
import * as Drag from "./drag";
import {DropId, Send} from "./app";

import style from "./task-list.module.scss";

function CheckBox(props: {checked: boolean; id: string; send: Send}) {
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

function Badges(props: {task: TaskListView[number]}) {
  return (
    <span className={style.badge}>
      {props.task.badges.map((badge) => (
        <BadgeFor type={badge} key={badge} />
      ))}
    </span>
  );
}

function Title(props: {task: TaskListView[number]}) {
  return (
    <span className={[style.task, props.task.done ? style.done : style.todo].join(" ")}>
      <span className={style.title}>{props.task.title}</span>
      <Badges task={props.task} />
    </span>
  );
}

function TaskRow(props: {task: TaskListView[number]; send: Send}) {
  return (
    <Drag.Draggable id={{type: "task" as const, id: props.task.id}} send={props.send}>
      <div className={style.taskRow} onClick={() => props.send({tag: "selectEditingTask", id: props.task.id})}>
        <span>
          <CheckBox checked={props.task.done} id={props.task.id} send={props.send} />
        </span>
        <span>
          <Title task={props.task} />
        </span>
        <span>
          <span className={style.id}>{props.task.id}</span>
        </span>
        <div className={`${style.dropIndicatorTop} ${props.task.dropIndicator.top ? style.shown : ""}`} />
        <div className={`${style.dropIndicatorBottom} ${props.task.dropIndicator.bottom ? style.shown : ""}`} />
        <Drag.DropTarget id={{type: "task" as const, id: props.task.id, side: "above"}} send={props.send}>
          <div className={style.dropTop} />
        </Drag.DropTarget>
        <Drag.DropTarget id={{type: "task", id: props.task.id, side: "below"}} send={props.send}>
          <div className={style.dropBottom} />
        </Drag.DropTarget>
      </div>
    </Drag.Draggable>
  );
}

export function TaskList(props: {view: TaskListView; send: Send}) {
  return (
    <div className={style.taskList}>
      {props.view.map((task) => (
        <TaskRow key={task.id} task={task} send={props.send} />
      ))}
    </div>
  );
}
