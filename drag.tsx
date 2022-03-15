import * as React from "react";

import styles from "./drag.module.scss";

export type DragEvent<DragId, DropId> =
  | {tag: "drag"; type: "drag"; id: DragId; x: number; y: number}
  | {tag: "drag"; type: "hover"; target: DropId}
  | {tag: "drag"; type: "leave"; target: DropId}
  | {tag: "drag"; type: "drop"};

export type DragState<DragId, DropId> = {
  dragging: {
    id: DragId;
    x: number;
    y: number;
  } | null;
  hovering: DropId | null;
};

export function update<DragId, DropId>(
  state: DragState<DragId, DropId>,
  ev: DragEvent<DragId, DropId>,
  {isCompatible}: {isCompatible: (a: DragId, b: DropId) => boolean},
): DragState<DragId, DropId> {
  return {
    ...state,
    dragging: ev.type === "drag" ? {id: ev.id, x: ev.x, y: ev.y} : ev.type === "drop" ? null : state.dragging,
    hovering:
      ev.type === "hover" && state.dragging && isCompatible(state.dragging.id, ev.target)
        ? ev.target
        : ev.type === "leave" || ev.type === "drop"
        ? null
        : state.hovering,
  };
}

export function dropped<DragId, DropId>(
  state: DragState<DragId, DropId>,
  ev: DragEvent<DragId, DropId>,
): [DragId, DropId] | null {
  return ev.type === "drop" && state.hovering && state.dragging ? [state.dragging.id, state.hovering] : null;
}

export function Draggable<DragId, DropId>(props: {
  id: DragId;
  children: React.ReactNode;
  send(ev: DragEvent<DragId, DropId>): void;
}) {
  return (
    <div
      onDrag={(ev) => props.send({tag: "drag", type: "drag", id: props.id, x: ev.clientX, y: ev.clientY})}
      onDragEnd={(ev) => {
        ev.preventDefault();
        props.send({tag: "drag", type: "drop"});
      }}
      draggable
    >
      {props.children}
    </div>
  );
}

export function DropTarget<DragId, DropId>(props: {
  id: DropId;
  children: React.ReactNode;
  send(ev: DragEvent<DragId, DropId>): void;
}) {
  return (
    <div
      className={styles.dropTarget}
      onDragOver={(ev) => {
        props.send({tag: "drag", type: "hover", target: props.id});
        ev.preventDefault();
      }}
      onDragEnter={(ev) => {
        props.send({tag: "drag", type: "hover", target: props.id});
        ev.preventDefault();
      }}
      onDragLeaveCapture={(ev) => {
        props.send({tag: "drag", type: "leave", target: props.id});
        ev.preventDefault();
      }}
    >
      {props.children}
    </div>
  );
}
