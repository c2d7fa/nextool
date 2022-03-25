import * as React from "react";
import style from "./task-editor.module.scss";

import {Tasks, find, EditOperation} from "./tasks";
import {Send} from "./app";
import {UnnamedTextField} from "./text-field";

type StateSection = StateGroup[];
type StateGroup = {title: string; components: StateComponent[]};
type StateComponent =
  | {type: "text"; value: string; property: "title"}
  | {type: "picker"; options: {value: string; label: string; active: boolean}[]; property: string};

export type State = null | {
  id: string;
  sections: StateSection[];
};

export const empty: State = null;

type ViewSection = ViewGroup[];
type ViewGroup = {title: string; components: ViewComponent[]};
type ViewComponent =
  | {type: "text"; value: string; property: "title"; id: {property: string; taskId: string}}
  | {
      type: "picker";
      options: {value: string; label: string; active: boolean}[];
      id: {property: string; taskId: string};
    };

export type View = null | {sections: ViewSection[]};

export type Event = {
  tag: "editor";
  type: "component";
  component: {id: {property: string; taskId: string}};
  value: string;
};

export function update(state: State, ev: Event): State {
  if (state === null) return null;

  function updateComponent(component: StateComponent, value: string): StateComponent {
    if (component.type === "text") {
      return {type: "text", value, property: component.property};
    } else if (component.type === "picker") {
      return {
        ...component,
        options: component.options.map((option) => ({
          ...option,
          active: option.value === value,
        })),
      };
    } else {
      return component;
    }
  }

  if (ev.type === "component") {
    return {
      ...state,
      sections: state.sections.map((section) => {
        return section.map((group) => ({
          ...group,
          components: group.components.map((component) => {
            if (component.property !== ev.component.id.property) return component;
            return updateComponent(component, ev.value);
          }),
        }));
      }),
    };
  }

  return state;
}

export function editOperationsFor(state: State, ev: Event): EditOperation[] {
  if (ev.component.id.property === "title") {
    return [{type: "set", property: "title", value: ev.value}];
  } else if (ev.component.id.property === "status") {
    if (ev.value === "active") return [{type: "set", property: "status", value: "active"}];
    if (ev.value === "paused") return [{type: "set", property: "status", value: "paused"}];
    if (ev.value === "done") return [{type: "set", property: "status", value: "done"}];
    else return [];
  } else if (ev.component.id.property === "action") {
    if (ev.value === "yes") return [{type: "set", property: "action", value: true}];
    if (ev.value === "no") return [{type: "set", property: "action", value: false}];
    else return [];
  } else if (ev.component.id.property === "type") {
    if (ev.value === "task") return [{type: "set", property: "type", value: "task"}];
    if (ev.value === "project") return [{type: "set", property: "type", value: "project"}];
    else return [];
  } else return [];
}

export function load({tasks}: {tasks: Tasks}, taskId: string): State {
  const task = find(tasks, taskId);
  if (task === null) return null;

  return {
    id: taskId,
    sections: [
      [
        {
          title: "Title",
          components: [{type: "text", value: task.title, property: "title"}],
        },
        {
          title: "Status",
          components: [
            {
              type: "picker",
              options: [
                {value: "active", label: "Active", active: task.status === "active"},
                {value: "paused", label: "Paused", active: task.status === "paused"},
                {value: "done", label: "Completed", active: task.status === "done"},
              ],
              property: "status",
            },
          ],
        },
      ],
      [
        {
          title: "Type",
          components: [
            {
              type: "picker",
              options: [
                {value: "task", label: "Task", active: task.type === "task"},
                {value: "project", label: "Project", active: task.type === "project"},
              ],
              property: "type",
            },
          ],
        },
        {
          title: "Actionable",
          components: [
            {
              type: "picker",
              options: [
                {value: "yes", label: "Action", active: task.action},
                {value: "no", label: "Not Ready", active: !task.action},
              ],
              property: "action",
            },
          ],
        },
      ],
    ],
  };
}

export function reload({editor, tasks}: {editor: State; tasks: Tasks}): State {
  if (editor === null) return null;
  else return load({tasks}, editor.id);
}

export function view(state: State): View {
  if (state === null) return null;
  return {
    sections: state.sections.map((section) =>
      section.map((group) => ({
        title: group.title,
        components: group.components.map((component) => ({
          ...component,
          id: {property: component.property, taskId: state.id},
        })),
      })),
    ),
  };
}

function TextComponent(props: {view: ViewComponent & {type: "text"}; send: Send}) {
  return (
    <UnnamedTextField
      value={props.view.value}
      send={(ev) => {
        if (ev.type === "submit") return;
        props.send({
          tag: "editor",
          type: "component",
          component: {id: props.view.id},
          value: ev.value,
        });
      }}
    />
  );
}

function PickerComponent(props: {view: ViewComponent & {type: "picker"}; send: Send}) {
  return (
    <div className={`${style.picker}`}>
      {props.view.options.map((option) => (
        <button
          className={`${style.option} ${option.active ? style.active : style.inactive}`}
          key={option.value}
          onClick={() =>
            props.send({
              tag: "editor",
              type: "component",
              component: {id: props.view.id},
              value: option.value,
            })
          }
        >
          <div className={style.label}>{option.label}</div>
        </button>
      ))}
    </div>
  );
}

function Component(props: {view: ViewComponent; send: Send}) {
  if (props.view.type === "text") return <TextComponent view={props.view} send={props.send} />;
  else if (props.view.type === "picker") return <PickerComponent view={props.view} send={props.send} />;
  else return <div>Unknown component</div>;
}

function Group(props: {view: ViewGroup; send: Send}) {
  return (
    <div className={style.group}>
      <h1>{props.view.title}</h1>
      <div className={style.components}>
        {props.view.components.map((component, index) => (
          <Component key={index} view={component} send={props.send} />
        ))}
      </div>
    </div>
  );
}

function Section(props: {view: ViewSection; send: Send}) {
  return (
    <div className={style.section}>
      {props.view.map((group, index) => (
        <Group key={index} view={group} send={props.send} />
      ))}
    </div>
  );
}

export function TaskEditor(props: {view: View; send: Send}) {
  if (props.view === null) return null;
  return (
    <div className={style.taskEditor}>
      {props.view.sections.map((section, index) => (
        <Section key={index} view={section} send={props.send} />
      ))}
    </div>
  );
}
