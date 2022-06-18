import * as React from "react";
import {DropTargetView, TaskListView, TaskView} from "./tasks";
import {Badge} from "./ui";
import * as Drag from "./drag";
import {Send} from "./app";

import * as style from "./task-list.module.scss";

type TaskListViewSection = TaskListView[number];
type TaskListViewRow = TaskListViewSection["rows"][number];

function CheckBox(props: {checked: boolean; id: string; send: Send}) {
  return (
    <div
      className={[style.checkBox, props.checked ? style.checked : ""].join(" ")}
      onClick={() => props.send({tag: "check", id: props.id})}
    />
  );
}

function Badges(props: {task: TaskView}) {
  return (
    <span className={style.badges}>
      {props.task.badges.map((badge) => (
        <Badge badge={badge} key={JSON.stringify(badge)} />
      ))}
    </span>
  );
}

function Title(props: {task: TaskView}) {
  return (
    <span
      className={[
        style.task,
        props.task.done ? style.done : "",
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
      <Drag.DropTarget id={{type: "list", target: props.view.handle}} send={props.send}>
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

const TaskRow = React.memo(
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
              className={[
                style.taskRow,
                task.project ? style.project : "",
                task.today ? style.today : "",
                task.archived ? style.archived : "",
                task.borderBelow ? style.borderBelow : "",
              ].join(" ")}
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
  },
  (prev, next) => JSON.stringify(prev) === JSON.stringify(next),
);

function TaskListSection(props: {view: TaskListViewSection; send: Send}) {
  return (
    <>
      {props.view.title && <h1 className={style.listSection}>{props.view.title}</h1>}
      <div className={style.taskList}>
        {!props.view.rows.find((row) => row.type === "task") && (
          <div className={style.empty}>There are no tasks in this view.</div>
        )}
        {props.view.rows.map((row, index) => (
          <TaskRow key={JSON.stringify(row)} row={row} send={props.send} />
        ))}
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
