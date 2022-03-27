import * as React from "react";
import * as ReactDOM from "react-dom";
import * as App from "./app";
import {loadTasks, saveTasks} from "./storage";
import {TaskEditor} from "./task-editor";
import {TextField, TextFieldButton, value as textFieldValue} from "./text-field";
import * as Drag from "./drag";
import {TaskList} from "./task-list";

import style from "./main.module.scss";

const AppContext = React.createContext<App.State>(null as any);

function useApp(): App.State {
  return React.useContext(AppContext);
}

function AddTask(props: {send(ev: App.Event): void}) {
  const textFields = useApp().textFields;
  return (
    <div className={style.newTask}>
      <TextField
        field="addTitle"
        placeholder="New Task"
        value={textFieldValue(textFields, "addTitle")}
        send={props.send}
      />
      <TextFieldButton send={props.send} field="addTitle">
        Add Task
      </TextFieldButton>
    </div>
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
      <h1>{props.section.title}</h1>
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

function Main() {
  const [app, setApp] = React.useState<App.State>(App.empty);

  const view_ = App.view(app);

  React.useEffect(() => {
    setApp((app) => ({...app, tasks: loadTasks()}));
  }, []);

  const send = React.useCallback((ev: App.Event) => {
    setApp((app) => {
      const app_ = App.updateApp(app, ev);
      saveTasks(app_.tasks);
      return app_;
    });
  }, []);

  return (
    <AppContext.Provider value={app}>
      <div className={style.outerContainer}>
        <div className={style.topBar} />
        <SideBar sections={view_.sideBar} send={send} />
        <div className={style.innerContainer}>
          <div className={style.left}>
            <TaskList view={view_.taskList} send={send} />
            <AddTask send={send} />
          </div>
          <div className={style.right}>
            <TaskEditor view={view_.editor} send={send} />
          </div>
        </div>
      </div>
    </AppContext.Provider>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
