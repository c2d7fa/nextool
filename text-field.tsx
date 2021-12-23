import * as React from "react";

const styles = require("./text-field.module.scss");

export type TextFieldEvent<Id extends string> =
  | {tag: "textField"; type: "edit"; field: Id; value: string}
  | {tag: "textField"; type: "submit"; field: Id};

export type TextFieldStates<Id extends string> = {[field in Id]: string};

export function update<Id extends string>(
  state: TextFieldStates<Id>,
  ev: TextFieldEvent<Id>,
): TextFieldStates<Id> {
  if (ev.type === "edit") return {...state, [ev.field]: ev.value};
  if (ev.type === "submit") return {...state, [ev.field]: ""};
}

export function value<Id extends string>(state: TextFieldStates<Id>, field: Id): string {
  return state[field] ?? "";
}

export function TextField<Id extends string>(props: {
  field: Id;
  value: string;
  placeholder?: string;
  send: (ev: TextFieldEvent<Id>) => void;
}) {
  return (
    <input
      className={styles.textField}
      placeholder={props.placeholder}
      type="text"
      value={props.value}
      onChange={(e) => props.send({tag: "textField", type: "edit", field: props.field, value: e.target.value})}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          props.send({tag: "textField", type: "submit", field: props.field});
        }
      }}
    />
  );
}
