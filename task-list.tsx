import * as React from "react";
import {TaskListView} from "./tasks";
import {Badge} from "./ui";
import * as Drag from "./drag";
import {Send} from "./app";

import style from "./task-list.module.scss";

function CheckBox(props: {checked: boolean; id: string; send: Send}) {
  return (
    <div
      className={[style.checkBox, props.checked ? style.checked : style.unchecked].join(" ")}
      onClick={() => props.send({tag: "check", id: props.id})}
    />
  );
}

function BadgeFor(props: {type: "ready" | "stalled"}) {
  if (props.type === "ready") return <Badge color="green">Ready</Badge>;
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
    <span
      className={[
        style.task,
        props.task.done ? style.done : style.todo,
        props.task.paused ? style.paused : "",
        props.task.project ? style.project : "",
      ].join(" ")}
    >
      <span className={style.title}>{props.task.title}</span>
      <Badges task={props.task} />
    </span>
  );
}

function DropTarget(props: {
  id: string;
  side: "below" | "above";
  indentation: number;
  width: number | "full";
  send: Send;
}) {
  return (
    <Drag.DropTarget
      id={{type: "task", id: props.id, side: props.side, indentation: props.indentation}}
      send={props.send}
    >
      <div
        className={`${style.dropTarget} ${style[props.side]}`}
        style={{
          left: `${props.indentation * 2}em`,
          width: props.width === "full" ? undefined : `${props.width * 2}em`,
        }}
      />
    </Drag.DropTarget>
  );
}

function TaskRow(props: {task: TaskListView[number]; send: Send}) {
  return (
    <Drag.Draggable id={{type: "task" as const, id: props.task.id}} send={props.send}>
      <div
        className={[style.taskRow, props.task.project ? style.project : ""].join(" ")}
        onClick={() => props.send({tag: "selectEditingTask", id: props.task.id})}
      >
        <span className={style.indentationColumn} style={{width: `${2 * props.task.indentation}em`}} />
        <span className={style.checkboxColumn}>
          <CheckBox checked={props.task.done} id={props.task.id} send={props.send} />
        </span>
        <span className={style.titleColumn}>
          <Title task={props.task} />
        </span>
        <span className={style.idColumn}>
          <span className={style.id}>{props.task.id}</span>
        </span>
        {props.task.dropIndicator && (
          <div
            className={`${style.dropIndicator} ${style[props.task.dropIndicator.side]}`}
            style={{left: `${2 * props.task.dropIndicator.indentation}em`}}
          />
        )}
        {props.task.dropTargets.map((dropTarget, index) => (
          <DropTarget key={index} id={props.task.id} {...dropTarget} send={props.send} />
        ))}
      </div>
    </Drag.Draggable>
  );
}

export function TaskList(props: {view: TaskListView; send: Send}) {
  return (
    <div className={style.taskList}>
      {props.view.length === 0 ? (
        <div className={style.empty}>There are no tasks in this view.</div>
      ) : (
        props.view.map((task) => <TaskRow key={task.id} task={task} send={props.send} />)
      )}
    </div>
  );
}
