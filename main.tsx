import * as React from "react";
import * as ReactDOM from "react-dom";
import {App, Event, SelectFilterEvent} from "./app";
import {TextField, update as updateTextFields, value as textFieldValue} from "./text-field";
import {loadTasks, saveTasks} from "./storage";
import {TaskList} from "./task-list";
import {add, edit, list, merge} from "./tasks";
import {Button} from "./ui";
import {reload, TaskEditor, updateEditor} from "./task-editor";
import * as Drag from "./drag";

const style = require("./main.module.scss");

const AppContext = React.createContext<App>(null as any);

function useApp(): App {
  return React.useContext(AppContext);
}

function compose<T>(fns: ((x: T) => T)[]): (x: T) => T {
  return (x) => fns.reduce((x, f) => f(x), x);
}

function always<T>(x: T): (...args: unknown[]) => T {
  return () => x;
}

function updateApp(app: App, ev: Event): App {
  function handleDrop(app: App, ev: Event) {
    if (ev.tag !== "drag") return app;

    const dropped_ = Drag.dropped(app.taskDrag, ev);
    if (!dropped_) return app;

    const [drag, drop] = dropped_;

    const taskId = drag.substring("task:".length);
    const filter = drop.substring("filter:".length);

    const operation =
      filter === "actions"
        ? ({property: "action", value: true} as const)
        : filter === "done"
        ? ({property: "done", value: true} as const)
        : filter === "stalled"
        ? ({property: "action", value: false} as const)
        : null;

    if (!operation) return app;
    const tasks = edit(app.tasks, taskId, {type: "set", ...operation});
    return {...app, tasks};
  }

  function handleDragState(app: App, ev: Event) {
    if (ev.tag !== "drag") return app;
    return {...app, taskDrag: Drag.update(app.taskDrag, ev, {isCompatible: always(true)})};
  }

  function handleSelectFilter(app: App, ev: Event) {
    if (ev.tag !== "selectFilter") return app;
    return {...app, filter: ev.filter};
  }

  function handleAdd(app: App, ev: Event) {
    let result = app;
    if ((ev.tag === "textField" && ev.field === "addTitle" && ev.type === "submit") || ev.tag === "add") {
      result = {...app, tasks: add(app.tasks, {title: textFieldValue(app.textFields, "addTitle")})};
    }
    if (ev.tag === "add") {
      result = {
        ...app,
        textFields: updateTextFields(app.textFields, {tag: "textField", field: "addTitle", type: "submit"}),
      };
    }
    return result;
  }

  function handleTextField(app: App, ev: Event) {
    if (ev.tag !== "textField") return app;
    return {...app, textFields: updateTextFields(app.textFields, ev)};
  }

  function handleEdit(app: App, ev: Event) {
    if (ev.tag !== "edit") return app;
    return {...app, editor: updateEditor(app, ev), tasks: edit(app.tasks, ev.id, ev.operation)};
  }

  function handleChecked(app: App, ev: Event) {
    if (ev.tag !== "checked") return app;
    return {...app, tasks: merge(app.tasks, [{id: ev.id, done: ev.checked}])};
  }

  function handleSelectEditingTask(app: App, ev: Event) {
    if (ev.tag !== "selectEditingTask") return app;
    return {...app, editor: reload(app, ev.id)};
  }

  return compose<App>([
    (app) => handleAdd(app, ev),
    (app) => handleChecked(app, ev),
    (app) => handleEdit(app, ev),
    (app) => handleSelectFilter(app, ev),
    (app) => handleSelectEditingTask(app, ev),
    (app) => handleDrop(app, ev),
    (app) => handleDragState(app, ev),
    (app) => handleTextField(app, ev),
  ])(app);
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
  send(ev: SelectFilterEvent | Drag.DragEvent<never, `filter:actions` | `filter:done` | `filter:stalled`>): void;
}) {
  return (
    <div className={style.filterSelector}>
      <button
        onClick={() => props.send({tag: "selectFilter", filter: "all"})}
        className={props.filter === "all" ? style.selected : ""}
      >
        <span className={style.label}>All</span>
      </button>
      <Drag.DropTarget id="filter:stalled" send={props.send}>
        <button
          onClick={() => props.send({tag: "selectFilter", filter: "stalled"})}
          className={props.filter === "stalled" ? style.selected : ""}
        >
          <span className={style.label}>Stalled</span>
        </button>
      </Drag.DropTarget>
      <Drag.DropTarget id="filter:actions" send={props.send}>
        <button
          onClick={() => props.send({tag: "selectFilter", filter: "actions"})}
          className={props.filter === "actions" ? style.selected : ""}
        >
          <span className={style.label}>Actions</span>
        </button>
      </Drag.DropTarget>
      <Drag.DropTarget id="filter:done" send={props.send}>
        <button
          onClick={() => props.send({tag: "selectFilter", filter: "done"})}
          className={props.filter === "done" ? style.selected : ""}
        >
          <span className={style.label}>Finished</span>
        </button>
      </Drag.DropTarget>
    </div>
  );
}

function Main() {
  const [app, setApp] = React.useState<App>({
    tasks: [],
    textFields: {addTitle: ""},
    editor: null,
    filter: "all",
    taskDrag: {dragging: null, hovering: null},
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
