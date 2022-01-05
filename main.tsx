import * as React from "react";
import * as ReactDOM from "react-dom";
import {State, Event, SelectFilterEvent, View, view as viewApp} from "./app";
import {TextField, update as updateTextFields, value as textFieldValue} from "./text-field";
import {loadTasks, saveTasks} from "./storage";
import {TaskList} from "./task-list";
import {add, edit, FilterId, list, merge} from "./tasks";
import {Button} from "./ui";
import {reload, TaskEditor, updateEditor} from "./task-editor";
import * as Drag from "./drag";

const style = require("./main.module.scss");

const AppContext = React.createContext<State>(null as any);

function useApp(): State {
  return React.useContext(AppContext);
}

function compose<T>(fns: ((x: T) => T)[]): (x: T) => T {
  return (x) => fns.reduce((x, f) => f(x), x);
}

function always<T>(x: T): (...args: unknown[]) => T {
  return () => x;
}

function updateApp(app: State, ev: Event): State {
  function handleDrop(app: State, ev: Event) {
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

  function handleDragState(app: State, ev: Event) {
    if (ev.tag !== "drag") return app;
    return {...app, taskDrag: Drag.update(app.taskDrag, ev, {isCompatible: always(true)})};
  }

  function handleSelectFilter(app: State, ev: Event) {
    if (ev.tag !== "selectFilter") return app;
    return {...app, filter: ev.filter};
  }

  function handleAdd(app: State, ev: Event) {
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

  function handleTextField(app: State, ev: Event) {
    if (ev.tag !== "textField") return app;
    return {...app, textFields: updateTextFields(app.textFields, ev)};
  }

  function handleEdit(app: State, ev: Event) {
    if (ev.tag !== "edit") return app;
    return {...app, editor: updateEditor(app.editor, ev), tasks: edit(app.tasks, ev.id, ev.operation)};
  }

  function handleChecked(app: State, ev: Event) {
    if (ev.tag !== "checked") return app;
    return {...app, tasks: merge(app.tasks, [{id: ev.id, done: ev.checked}])};
  }

  function handleSelectEditingTask(app: State, ev: Event) {
    if (ev.tag !== "selectEditingTask") return app;
    return {...app, editor: reload(app, ev.id)};
  }

  return compose<State>([
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

function Filter(props: {
  filter: View["filters"][number];
  send(ev: SelectFilterEvent | Drag.DragEvent<never, `filter:${FilterId}`>): void;
}) {
  const inner = (
    <button
      onClick={() => props.send({tag: "selectFilter", filter: props.filter.filter})}
      className={props.filter.selected ? style.selected : ""}
    >
      <span className={style.label}>{props.filter.label}</span>
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

function FilterSelector(props: {
  filters: View["filters"];
  send(ev: SelectFilterEvent | Drag.DragEvent<never, `filter:${FilterId}`>): void;
}) {
  return (
    <div className={style.filterSelector}>
      {props.filters.map((filter, i) => (
        <Filter key={i} filter={filter} send={props.send} />
      ))}
    </div>
  );
}

function Main() {
  const [app, setApp] = React.useState<State>({
    tasks: [],
    textFields: {addTitle: ""},
    editor: null,
    filter: "not-done",
    taskDrag: {dragging: null, hovering: null},
  });

  const view = viewApp(app);

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
          <FilterSelector filters={view.filters} send={send} />
        </div>
        <div className={style.innerContainer}>
          <div className={style.left}>
            <TaskList taskList={view.taskList} send={send} />
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
