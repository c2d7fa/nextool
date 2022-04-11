import * as React from "react";
import {BadgeId, DropTargetView, TaskListView, TaskView} from "./tasks";
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

function DropTarget(props: {view: DropTargetView; send: Send}) {
  return (
    <div className={style.dropContainer}>
      <Drag.DropTarget id={{type: "list", target: props.view.target}} send={props.send}>
        <div
          className={style.dropTarget}
          style={{
            left: `${props.view.indentation * 2}em`,
            width: props.view.width === "full" ? undefined : `${props.view.width * 2}em`,
          }}
        />
      </Drag.DropTarget>
    </div>
  );
}

function TaskRow(props: {row: TaskListViewRow; send: Send}) {
  if (props.row.type === "dropTarget") {
    return <DropTarget view={props.row} send={props.send} />;
  } else if (props.row.type === "dropIndicator") {
    return (
      <div className={style.dropContainer}>
        <div className={style.dropIndicator} style={{left: `${2 * props.row.indentation}em`}} />
      </div>
    );
  } else {
    const task: TaskView = props.row;

    return (
      <>
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
