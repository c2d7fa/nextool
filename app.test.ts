import {updateApp, State, view, Event, empty} from "./app";
import {FilterId} from "./tasks";

function updateAll(state: State, events: Event[]): State {
  return events.reduce(updateApp, state);
}

function addTask(title: string): Event[] {
  return [
    {tag: "textField", type: "edit", field: "addTitle", value: title},
    {tag: "textField", field: "addTitle", type: "submit"},
  ];
}

function dragToFilter(id: string, filter: FilterId): Event[] {
  return [
    {tag: "drag", type: "drag", id: {type: "task", id}, x: 100, y: 100},
    {tag: "drag", type: "hover", target: {type: "filter", id: filter}},
    {tag: "drag", type: "drop"},
  ];
}

function switchToFilter(filter: FilterId): Event[] {
  return [{tag: "selectFilter", filter}];
}

describe("adding tasks", () => {
  describe("with empty state", () => {
    test("there are no tasks", () => {
      expect(view(empty).taskList).toEqual([]);
    });
  });

  describe("after adding three new tasks", () => {
    const example = updateAll(empty, [...addTask("Task 1"), ...addTask("Task 2"), ...addTask("Task 3")]);

    test("there are three tasks in the task list", () => {
      expect(view(example).taskList.length).toEqual(3);
    });

    test("they are added from top to bottom", () => {
      expect(view(example).taskList.map((t) => t.title)).toEqual(["Task 1", "Task 2", "Task 3"]);
    });

    test("they are all marked unfinished", () => {
      expect(view(example).taskList.every((t) => !t.done)).toBe(true);
    });

    test("they are marked as stalled", () => {
      expect(view(example).taskList.map((t) => t.badges)).toEqual([["stalled"], ["stalled"], ["stalled"]]);
    });
  });
});

describe("dragging tasks to filters", () => {
  describe("in an example with three tasks", () => {
    const example = updateAll(empty, [
      ...addTask("Task 1"),
      ...addTask("Task 2"),
      ...addTask("Task 3"),
      ...switchToFilter("all"),
    ]);

    test("they are all marked as stalled at first", () => {
      expect(view(example).taskList.map((t) => t.badges)).toEqual([["stalled"], ["stalled"], ["stalled"]]);
    });

    test("they are all marked unfinished at first", () => {
      expect(view(example).taskList.every((t) => !t.done)).toBe(true);
    });

    const action = updateAll(example, dragToFilter(view(example).taskList[0].id, "actions"));
    test("dragging a task to the action filter gives it the action badge", () => {
      expect(view(action).taskList.map((t) => t.badges)).toEqual([["action"], ["stalled"], ["stalled"]]);
    });

    const done = updateAll(example, dragToFilter(view(example).taskList[0].id, "done"));
    test("dragging a task to the done filter marks it as done", () => {
      expect(view(done).taskList.map((t) => t.done)).toEqual([true, false, false]);
    });

    test("dragging a task marked action to stalled gives it the stalled badge again", () => {
      const stalled = updateAll(action, dragToFilter(view(action).taskList[0].id, "stalled"));
      expect(view(stalled).taskList.map((t) => t.badges)).toEqual([["stalled"], ["stalled"], ["stalled"]]);
    });

    test("dragging a task marked done to unfinished marks it as unfinished again", () => {
      const unfinished = updateAll(done, dragToFilter(view(done).taskList[0].id, "not-done"));
      expect(view(unfinished).taskList.every((t) => !t.done)).toBe(true);
    });
  });
});
