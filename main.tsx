import * as React from "react";
import * as ReactDOM from "react-dom";
import {App, Event, SelectFilterEvent} from "./app";
import {TextField, update as updateTextFields, value as textFieldValue} from "./text-field";
import {loadTasks, saveTasks} from "./storage";
import {TaskList} from "./task-list";
import {add, edit, list, merge} from "./tasks";
import {Button} from "./ui";
import {reload, TaskEditor, updateEditor} from "./task-editor";

const style = require("./main.module.scss");

const AppContext = React.createContext<App>(null);

function useApp(): App {
  return React.useContext(AppContext);
}

function updateApp(app: App, ev: Event): App {
  const tasks = (() => {
    if (ev.tag === "checked") return merge(app.tasks, [{id: ev.id, done: ev.checked}]);
    else if (ev.tag === "add") return add(app.tasks, {title: textFieldValue(app.textFields, "addTitle")});
    else if (ev.tag === "textField" && ev.field === "addTitle" && ev.type === "submit")
      return updateApp(app, {tag: "add"}).tasks;
    else if (ev.tag === "edit") return edit(app.tasks, ev.id, ev.operation);
    else return app.tasks;
  })();

  const textFields = (() => {
    if (ev.tag === "textField") return updateTextFields(app.textFields, ev);
    if (ev.tag === "add")
      return updateApp(app, {tag: "textField", type: "edit", field: "addTitle", value: ""}).textFields;
    else return app.textFields;
  })();

  const editor = (() => {
    if (ev.tag === "selectEditingTask") return reload(app, ev.id);
    else if (ev.tag === "edit") return updateEditor(app, ev);
    else return app.editor;
  })();

  const filter = (() => {
    if (ev.tag === "selectFilter") return ev.filter;
    else return app.filter;
  })();

  return {tasks, textFields, filter, editor};
}

function AddTask(props: {send(ev: Event): void}) {
  const textFields = useApp().textFields;
  return (
    <div className={style.newTask}>
      <TextField
        field="addTitle"
        placeholder="New Task"
        value={textFieldValue(textFields, "addTitle")}
        send={props.send}
      />
      <Button onClick={() => props.send({tag: "add"})}>Add Task</Button>
    </div>
  );
}

function FilterSelector(props: {
  filter: "all" | "actions" | "done" | "stalled";
  send(ev: SelectFilterEvent): void;
}) {
  return (
    <div className={style.filterSelector}>
      <button
        onClick={() => props.send({tag: "selectFilter", filter: "all"})}
        className={props.filter === "all" ? style.selected : ""}
      >
        <span className={style.label}>All</span>
      </button>
      <button
        onClick={() => props.send({tag: "selectFilter", filter: "stalled"})}
        className={props.filter === "stalled" ? style.selected : ""}
      >
        <span className={style.label}>Stalled</span>
      </button>
      <button
        onClick={() => props.send({tag: "selectFilter", filter: "actions"})}
        className={props.filter === "actions" ? style.selected : ""}
      >
        <span className={style.label}>Actions</span>
      </button>
      <button
        onClick={() => props.send({tag: "selectFilter", filter: "done"})}
        className={props.filter === "done" ? style.selected : ""}
      >
        <span className={style.label}>Finished</span>
      </button>
    </div>
  );
}

function Main() {
  const [app, setApp] = React.useState<App>({
    tasks: [],
    textFields: {addTitle: ""},
    editor: null,
    filter: "all",
  });

  React.useEffect(() => {
    setApp((app) => ({...app, tasks: loadTasks()}));
  }, []);

  const send = React.useCallback((ev: Event) => {
    setApp((app) => {
      const app_ = updateApp(app, ev);
      saveTasks(app_.tasks);
      return app_;
    });
  }, []);

  return (
    <AppContext.Provider value={app}>
      <div className={style.outerContainer}>
        <div className={style.topBar} />
        <div className={style.sidebar}>
          <FilterSelector filter={app.filter} send={send} />
        </div>
        <div className={style.innerContainer}>
          <div className={style.left}>
            <TaskList taskList={list(app.tasks, app.filter)} send={send} />
            <AddTask send={send} />
          </div>
          <div className={style.right}>
            <TaskEditor editor={app.editor} send={send} />
          </div>
        </div>
      </div>
    </AppContext.Provider>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
