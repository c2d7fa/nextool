import * as React from "react";
import * as styles from "./text-field.module.scss";

import {Button} from "./ui";

export type TextFieldEvent<Id extends string> =
  | {tag: "textField"; type: "edit"; field: Id; value: string}
  | {tag: "textField"; type: "submit"; field: Id};

export type TextFieldStates<Id extends string> = {[field in Id]: string};

export function update<Id extends string>(
  state: TextFieldStates<Id>,
  ev: TextFieldEvent<Id>,
): TextFieldStates<Id> {
  if (ev.type === "edit") return {...state, [ev.field]: ev.value};
  else if (ev.type === "submit") return {...state, [ev.field]: ""};
  else return state;
}

export function value<Id extends string>(state: TextFieldStates<Id>, field: Id): string {
  return state[field] ?? "";
}

export function UnnamedTextField(props: {
  value: string;
  placeholder?: string;
  send(ev: {type: "edit"; value: string} | {type: "submit"}): void;
  color?: "magenta";
}) {
  return (
    <input
      className={[styles.textField, props.color ? styles[props.color] : ""].join(" ")}
      placeholder={props.placeholder}
      type="text"
      value={props.value}
      onChange={(e) => props.send({type: "edit", value: e.target.value})}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          props.send({type: "submit"});
        } else if (e.key === "Escape") {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function TextField<Id extends string>(props: {
  field: Id;
  value: string;
  placeholder?: string;
  send: (ev: TextFieldEvent<Id>) => void;
  color?: "magenta";
}) {
  return (
    <UnnamedTextField
      color={props.color}
      value={props.value}
      placeholder={props.placeholder}
      send={(ev) => {
        props.send({...ev, tag: "textField", field: props.field});
      }}
    />
  );
}

export function TextFieldButton<Id extends string>(props: {
  field: Id;
  children: React.ReactNode;
  send: (ev: TextFieldEvent<Id>) => void;
  color?: "magenta";
}) {
  return (
    <Button onClick={() => props.send({tag: "textField", type: "submit", field: props.field})} color={props.color}>
      {props.children}
    </Button>
  );
}
