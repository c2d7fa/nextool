import {TextFieldEvent, TextFieldStates} from "./text-field";
import {CheckedEvent, SelectEditingTask} from "./task-list";
import {Task} from "./tasks";
import {TaskEditorEvent, TaskEditorState} from "./task-editor";

type TextFieldId = "addTitle";

export type AddEvent = {tag: "add"};
export type SelectFilterEvent = {tag: "selectFilter"; filter: "all" | "actions" | "done" | "stalled"};

export type App = {
  filter: "all" | "actions" | "done" | "stalled";
  tasks: Task[];
  textFields: TextFieldStates<TextFieldId>;
  editor: TaskEditorState;
};

export type Event =
  | CheckedEvent
  | AddEvent
  | TextFieldEvent<TextFieldId>
  | SelectEditingTask
  | SelectFilterEvent
  | TaskEditorEvent;
