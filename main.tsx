import * as React from "react";
import * as App from "./app";
import * as ReactDOMClient from "react-dom/client";
import {loadState, saveTasks} from "./storage";
import {TaskEditor} from "./task-editor";
import {TextField, TextFieldButton, value as textFieldValue} from "./text-field";
import * as Drag from "./drag";
import {TaskList} from "./task-list";

import * as style from "./main.module.scss";
import {Button} from "./ui";

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

function Filter(props: {
  filter: App.FilterView;
  send(ev: App.SelectFilterEvent | Drag.DragEvent<never, App.DropId>): void;
}) {
  const indicator =
    props.filter.indicator === null ? null : "text" in props.filter.indicator ? (
      <span className={style.indicator}>
        <span className={style.text}>{props.filter.indicator.text}</span>
      </span>
    ) : (
      <span className={[style.indicator, style.small].join(" ")} />
    );

  const inner = (
    <button
      onClick={() => props.send({tag: "selectFilter", filter: props.filter.filter})}
      className={props.filter.selected ? style.selected : ""}
    >
      <span className={style.label}>{props.filter.label}</span>
      {indicator}
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

function Main(props: {platform: Platform}) {
  const [app, setApp] = React.useState<App.State>(() => loadState());

  const view = App.view(app, {today: new Date()});

  const send = (ev: App.Event) => {
    const effects = App.effects(app, ev);
    execute(effects, send, props.platform);

    setApp((app) => {
      const app_ = App.updateApp(app, ev);
      saveTasks(app_.tasks);
      return app_;
    });
  };

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
