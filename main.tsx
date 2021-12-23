import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  TextField,
  TextFieldEvent,
  TextFieldStates,
  update as updateTextFields,
  value as textFieldValue,
} from "./text-field";
import {loadTasks, saveTasks} from "./storage";
import {CheckedEvent, TaskList} from "./task-list";
import {add, merge, Task} from "./tasks";
import {Button} from "./ui";

const style = require("./main.module.scss");

type AddEvent = {tag: "add"};

type TextFieldId = "addTitle";
type Event = CheckedEvent | AddEvent | TextFieldEvent<TextFieldId>;

type App = {
  tasks: Task[];
  textFields: TextFieldStates<TextFieldId>;
};

const AppContext = React.createContext<App>(null);

function useApp(): App {
  return React.useContext(AppContext);
}

function updateApp(app: App, ev: Event): App {
  const tasks = (() => {
    if (ev.tag === "checked") return merge(app.tasks, [{id: ev.id, done: ev.checked}]);
    if (ev.tag === "add") return add(app.tasks, {title: textFieldValue(app.textFields, "addTitle")});
    if (ev.tag === "textField" && ev.field === "addTitle" && ev.type === "submit")
      return updateApp(app, {tag: "add"}).tasks;
    else return app.tasks;
  })();

  const textFields = (() => {
    if (ev.tag === "textField") return updateTextFields(app.textFields, ev);
    if (ev.tag === "add")
      return updateApp(app, {tag: "textField", type: "edit", field: "addTitle", value: ""}).textFields;
    else return app.textFields;
  })();

  return {tasks, textFields};
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

function Main() {
  const [app, setApp] = React.useState<App>({tasks: [], textFields: {addTitle: ""}});

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
        <div className={style.sidebar} />
        <div className={style.taskList}>
          <AddTask send={send} />
          <TaskList tasks={app.tasks} send={send} />
        </div>
      </div>
    </AppContext.Provider>
  );
}

ReactDOM.render(<Main />, document.getElementById("root"));
