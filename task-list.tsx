import * as React from "react";
import {BadgeId, TaskListView, TaskView} from "./tasks";
import {Badge} from "./ui";
import * as Drag from "./drag";
import {Send} from "./app";

import * as style from "./task-list.module.scss";

type TaskListViewSection = TaskListView[number];
type TaskListViewRow = TaskListViewSection["rows"][number];

function CheckBox(props: {checked: boolean; id: string; send: Send}) {
  return (
    <div
      className={[style.checkBox, props.checked ? style.checked : style.unchecked].join(" ")}
      onClick={() => props.send({tag: "check", id: props.id})}
    />
  );
}

function BadgeFor(props: {type: BadgeId}) {
  if (props.type === "ready") {
    return <Badge color="green">Ready</Badge>;
  } else if (props.type === "stalled") {
    return <Badge color="orange">Stalled</Badge>;
  } else if (props.type === "project") {
    return <Badge color="project">Project</Badge>;
  } else if (props.type === "today") {
    return <Badge color="red">Today</Badge>;
  } else {
    const unreachable: never = props.type;
    return unreachable;
  }
}

function Badges(props: {task: TaskView}) {
  return (
    <span className={style.badges}>
      {props.task.badges.map((badge) => (
        <BadgeFor type={badge} key={badge} />
      ))}
    </span>
  );
}

function Title(props: {task: TaskView}) {
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
    <div className={style.dropContainer}>
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
    </div>
  );
}

function TaskRow(props: {row: TaskListViewRow; send: Send}) {
  if (props.row.type === "dropTarget") {
    return <DropTarget {...props.row} send={props.send} />;
  } else {
    const task: TaskView = props.row;

    const dropIndicatorBelow = task.dropIndicator?.side === "below" ? task.dropIndicator : null;
    const dropIndicatorAbove = task.dropIndicator?.side === "above" ? task.dropIndicator : null;

    return (
      <>
        <div className={style.dropContainer}>
          {dropIndicatorAbove && (
            <div
              className={`${style.dropIndicator} ${style[dropIndicatorAbove.side]}`}
              style={{left: `${2 * dropIndicatorAbove.indentation}em`}}
            />
          )}
        </div>
        <Drag.Draggable id={{type: "task" as const, id: task.id}} send={props.send}>
          <div
            className={[style.taskRow, task.project ? style.project : "", task.today ? style.today : ""].join(" ")}
            onClick={() => props.send({tag: "selectEditingTask", id: task.id})}
          >
            <span className={style.indentationColumn} style={{width: `${2 * task.indentation}em`}} />
            <span className={style.checkboxColumn}>
              <CheckBox checked={task.done} id={task.id} send={props.send} />
            </span>
            <span className={style.titleColumn}>
              <Title task={task} />
            </span>
            <span className={style.idColumn}>
              <span className={style.id}>{task.id}</span>
            </span>
          </div>
        </Drag.Draggable>
        <div className={style.dropContainer}>
          {dropIndicatorBelow && (
            <div
              className={`${style.dropIndicator} ${style[dropIndicatorBelow.side]}`}
              style={{left: `${2 * dropIndicatorBelow.indentation}em`}}
            />
          )}
        </div>
      </>
    );
  }
}

function TaskListSection(props: {view: TaskListViewSection; send: Send}) {
  return (
    <>
      {props.view.title && <h1 className={style.listSection}>{props.view.title}</h1>}
      <div className={style.taskList}>
        {props.view.rows.length === 0 ? (
          <div className={style.empty}>There are no tasks in this view.</div>
        ) : (
          props.view.rows.map((row, index) => (
            <TaskRow key={row.type === "task" ? row.id : `drop:${index}`} row={row} send={props.send} />
          ))
        )}
      </div>
    </>
  );
}

export function TaskList(props: {view: TaskListView; send: Send}) {
  return (
    <>
      {props.view.map((section, index) => (
        <TaskListSection key={index} view={section} send={props.send} />
      ))}
    </>
  );
}
