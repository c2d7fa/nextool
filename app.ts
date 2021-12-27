import {TextFieldEvent, TextFieldStates} from "./text-field";
import {CheckedEvent, SelectEditingTask} from "./task-list";
import {Task} from "./tasks";

type TextFieldId = "addTitle";

export type AddEvent = {tag: "add"};
export type SelectFilterEvent = {tag: "selectFilter"; filter: "all" | "actions" | "done" | "stalled"};

export type App = {
  filter: "all" | "actions" | "done" | "stalled";
  tasks: Task[];
  textFields: TextFieldStates<TextFieldId>;
  editingTask: {id: string} | null;
};

export type Event = CheckedEvent | AddEvent | TextFieldEvent<TextFieldId> | SelectEditingTask | SelectFilterEvent;
