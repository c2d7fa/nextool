import * as React from "react";
import * as App from "./app";
import * as ReactDOMClient from "react-dom/client";
import {TaskEditor} from "./task-editor";
import {TextField, TextFieldButton, value as textFieldValue} from "./text-field";
import * as Drag from "./drag";
import {TaskList} from "./task-list";

import * as style from "./main.module.scss";
import {Button, IconLabel} from "./ui";

function AddTask(props: {view: App.View["addTask"]; send(ev: App.Event): void}) {
  return (
    <>
      <TextField
        field="addTitle"
        placeholder="New Task"
        value={props.view.value}
        send={props.send}
        color="magenta"
      />
      <TextFieldButton color="magenta" send={props.send} field="addTitle">
        Add Task
      </TextFieldButton>
    </>
  );
}

function Indicator(props: {indicator: App.FilterIndicator}) {
  if (props.indicator === null) return null;
  else if (props.indicator.type === "text") {
    return (
      <span className={[style.indicator, style[props.indicator.color]].join(" ")}>
        <span className={style.text}>{props.indicator.text}</span>
      </span>
    );
  } else if (props.indicator.type === "dot") {
    return <span className={[style.indicator, style.dot].join(" ")} />;
  } else {
    const unreachable: never = props.indicator;
    return unreachable;
  }
}

function Filter(props: {
  filter: App.FilterView;
  send(ev: App.SelectFilterEvent | Drag.DragEvent<never, App.DropId>): void;
}) {
  const inner = (
    <button
      onClick={() => props.send({tag: "selectFilter", filter: props.filter.filter})}
      className={props.filter.selected ? style.selected : ""}
    >
      <span className={style.label}>
        <IconLabel extraSpace icon={props.filter.icon}>
          <span className={style.labelText}>{props.filter.label}</span>
        </IconLabel>
      </span>
      <Indicator indicator={props.filter.indicator} />
    </button>
  );

  return props.filter.dropTarget ? (
    <Drag.DropTarget id={props.filter.dropTarget} send={props.send}>
      {inner}
    </Drag.DropTarget>
  ) : (
    inner
  );
}

function FilterSelector(props: {filters: App.FilterView[]; send: App.Send}) {
  return (
    <div className={style.filterSelector}>
      {props.filters.map((filter, i) => (
        <Filter key={i} filter={filter} send={props.send} />
      ))}
    </div>
  );
}

function SideBarSection(props: {section: App.SideBarSectionView; send: App.Send}) {
  return (
    <>
      <h1
        className={style.sectionTitle}
        onClick={() => props.send({tag: "selectFilter", filter: props.section.filter})}
      >
        {props.section.title}
      </h1>
      <FilterSelector filters={props.section.filters} send={props.send} />
    </>
  );
}

function SideBar(props: {sections: App.SideBarSectionView[]; send: App.Send}) {
  return (
    <div className={style.sidebar}>
      {props.sections.map((section) => (
        <SideBarSection key={section.title} section={section} send={props.send} />
      ))}
    </div>
  );
}

function TopBarButton(props: {children: React.ReactNode; event: App.Event; send: App.Send}) {
  return (
    <Button color="magenta" onClick={() => props.send(props.event)}>
      {props.children}
    </Button>
  );
}

export type Platform = {
  readLocalStorage(): Promise<string | null>;
  saveLocalStorage(value: string): Promise<void>;
  fileDownload(args: {name: string; contents: string}): Promise<void>;
  fileUpload(): Promise<{name: string; contents: string} | null>;
};

function execute(effects: App.Effect[], send: App.Send, platform: Platform) {
  function execute_(effect: App.Effect) {
    if (effect.type === "fileDownload") {
      platform.fileDownload({name: effect.name, contents: effect.contents});
    } else if (effect.type === "fileUpload") {
      platform.fileUpload().then((file) => {
        if (file === null) return;
        send({tag: "storage", type: "loadFile", name: file.name, contents: file.contents});
      });
    } else if (effect.type === "saveLocalStorage") {
      platform.saveLocalStorage(effect.value);
    } else {
      const unreachable: never = effect;
      return unreachable;
    }
  }

  return effects.forEach(execute_);
}

function FileControls(props: {view: App.FileControlsView; send: App.Send}) {
  if (props.view === "saveLoad") {
    return (
      <>
        <TopBarButton send={props.send} event={{tag: "storage", type: "clickLoadButton"}}>
          Load
        </TopBarButton>
        <TopBarButton send={props.send} event={{tag: "storage", type: "clickSaveButton"}}>
          Save
        </TopBarButton>
      </>
    );
  } else if (props.view === null) {
    return null;
  } else {
    const unreachable: never = props.view;
    return unreachable;
  }
}

function FilterButton(props: {filter: App.FilterBarView["filters"][number]; send: App.Send}) {
  const [isDepressed, setIsDepressed] = React.useState(false);

  return (
    <div className={style.filterButtonContainer}>
      <button
        className={[style.filterButton, style[props.filter.state], isDepressed ? style.down : ""].join(" ")}
        onMouseDown={() => setIsDepressed(true)}
        onMouseLeave={() => setIsDepressed(false)}
        onMouseUp={(ev) => {
          setIsDepressed(false);
          props.send({
            tag: "filterBar",
            type: "set",
            id: props.filter.id,
            state: ev.button === 0 ? "include" : "exclude",
          });
        }}
        onContextMenu={(ev) => ev.preventDefault()}
      >
        <IconLabel icon={props.filter.icon}>{props.filter.label}</IconLabel>
      </button>
    </div>
  );
}

function FilterBar(props: {view: App.FilterBarView; send: App.Send}) {
  return (
    <div className={[style.bar, props.view.filters.length === 0 ? style.empty : ""].join(" ")}>
      {props.view.filters.map((filter, i) => (
        <FilterButton key={i} filter={filter} send={props.send} />
      ))}
    </div>
  );
}

export function Main(props: {platform: Platform}) {
  const [pendingEffects, setPendingEffects] = React.useState<App.Effect[]>([]);

  const [app, send] = React.useReducer((app: App.State, ev: App.Event) => {
    const state = {...app, today: new Date()};
    const [newState, newEffects] = App.handle(state, ev);
    setPendingEffects((effects) => [...effects, ...newEffects]);
    return newState;
  }, App.empty);

  React.useEffect(() => {
    if (pendingEffects.length === 0) return;
    execute(pendingEffects, send, props.platform);
    setPendingEffects([]);
  }, [pendingEffects]);

  React.useEffect(() => {
    props.platform.readLocalStorage().then((localStorage) => {
      send({tag: "storage", type: "loadFile", name: "localStorage", contents: localStorage ?? ""});
    });
  }, []);

  const view = App.view({...app, today: new Date()});

  return (
    <div className={style.outerContainer}>
      <div className={style.topBar}>
        <div className={style.middle}>
          <AddTask view={view.addTask} send={send} />
        </div>
        <div className={style.right}>
          <FileControls view={view.fileControls} send={send} />
        </div>
      </div>
      <SideBar sections={view.sideBar} send={send} />
      <div className={style.innerContainer}>
        <FilterBar view={view.filterBar} send={send} />
        <div className={style.left}>
          <TaskList view={view.taskList} send={send} />
        </div>
        <div className={style.right}>
          <TaskEditor view={view.editor} send={send} />
        </div>
      </div>
    </div>
  );
}

const demoPlatform: Platform = {
  readLocalStorage: () => Promise.resolve(""),
  saveLocalStorage: () => Promise.resolve(),
  fileDownload: () => Promise.resolve(),
  fileUpload: () => Promise.resolve(null),
};

export function SmallDemo(props: {}) {
  const [pendingEffects, setPendingEffects] = React.useState<App.Effect[]>([]);

  const [app, send] = React.useReducer((app: App.State, ev: App.Event) => {
    const state = {...app, today: new Date()};
    const [newState, newEffects] = App.handle(state, ev);
    setPendingEffects((effects) => [...effects, ...newEffects]);
    return newState;
  }, App.empty);

  React.useEffect(() => {
    if (pendingEffects.length === 0) return;
    execute(pendingEffects, send, demoPlatform);
    setPendingEffects([]);
  }, [pendingEffects]);

  React.useEffect(() => {
    demoPlatform.readLocalStorage().then((localStorage) => {
      send({tag: "storage", type: "loadFile", name: "localStorage", contents: localStorage ?? ""});
    });
  }, []);

  const view = App.view({...app, today: new Date()});

  return (
    <div className={[style.outerContainer, style.smallDemo].join(" ")}>
      <div className={style.topBar}>
        <div className={style.middle}>
          <AddTask view={view.addTask} send={send} />
        </div>
        <div className={style.right}>
          <FileControls view={view.fileControls} send={send} />
        </div>
      </div>
      <SideBar sections={view.sideBar} send={send} />
      <div className={style.innerContainer}>
        <FilterBar view={view.filterBar} send={send} />
        <div className={style.left}>
          <TaskList view={view.taskList} send={send} />
        </div>
        <div className={style.right}>
          <TaskEditor view={view.editor} send={send} />
        </div>
      </div>
    </div>
  );
}

export function start(platform: Platform) {
  const root = ReactDOMClient.createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <Main platform={platform} />
    </React.StrictMode>,
  );
}
