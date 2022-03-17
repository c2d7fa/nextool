import {updateApp, State, view, Event, empty, DragId, DropId, View} from "./app";
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

function dragAndDrop(drag: DragId, drop: DropId): Event[] {
  return [
    {tag: "drag", type: "drag", id: drag, x: 100, y: 100},
    {tag: "drag", type: "hover", target: drop},
    {tag: "drag", type: "drop"},
  ];
}

function dragToFilter(id: string, filter: FilterId): Event[] {
  return dragAndDrop({type: "task", id}, {type: "filter", id: filter});
}

function reorderTask(source: string, target: string, side: "above" | "below"): Event[] {
  return dragAndDrop({type: "task", id: source}, {type: "task", id: target, side, indentation: 0});
}

function viewed(state: State | View): View {
  return "tasks" in state ? view(state) : state;
}

function nthTask(view: View | State, n: number) {
  return viewed(view).taskList[n];
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

    const action = updateAll(example, dragToFilter(nthTask(example, 0).id, "actions"));
    test("dragging a task to the action filter gives it the action badge", () => {
      expect(view(action).taskList.map((t) => t.badges)).toEqual([["action"], ["stalled"], ["stalled"]]);
    });

    const done = updateAll(example, dragToFilter(nthTask(example, 0).id, "done"));
    test("dragging a task to the done filter marks it as done", () => {
      expect(view(done).taskList.map((t) => t.done)).toEqual([true, false, false]);
    });

    test("dragging a task marked action to stalled gives it the stalled badge again", () => {
      const stalled = updateAll(action, dragToFilter(nthTask(action, 0).id, "stalled"));
      expect(view(stalled).taskList.map((t) => t.badges)).toEqual([["stalled"], ["stalled"], ["stalled"]]);
    });

    test("dragging a task marked done to unfinished marks it as unfinished again", () => {
      const unfinished = updateAll(done, dragToFilter(nthTask(done, 0).id, "not-done"));
      expect(view(unfinished).taskList.every((t) => !t.done)).toBe(true);
    });
  });
});

describe("reordering tasks with drag and drop", () => {
  describe("in an example with three tasks", () => {
    const example = updateAll(empty, [...addTask("Task 1"), ...addTask("Task 2"), ...addTask("Task 3")]);

    function testReorder(from: number, to: number, side: "above" | "below", result: number[]): void {
      test(`dragging task ${from} to ${side} ${to}`, () => {
        const moved = updateAll(example, [
          ...reorderTask(nthTask(example, from - 1).id, nthTask(example, to - 1).id, side),
        ]);
        expect(view(moved).taskList.map((t) => t.title)).toEqual(result.map((x) => `Task ${x}`));
      });
    }

    describe("dragging task down", () => {
      testReorder(1, 2, "below", [2, 1, 3]);
      testReorder(1, 3, "above", [2, 1, 3]);
    });

    describe("dragging task up", () => {
      testReorder(2, 1, "above", [2, 1, 3]);
      testReorder(3, 1, "below", [1, 3, 2]);
    });

    describe("examples where position isn't changed", () => {
      testReorder(1, 2, "above", [1, 2, 3]);
      testReorder(1, 1, "below", [1, 2, 3]);
      testReorder(1, 1, "above", [1, 2, 3]);
    });
  });
});

describe("nesting tasks with drag and drop", () => {
  describe("with a flat list of items", () => {
    const example = updateAll(empty, [...addTask("Task 1"), ...addTask("Task 2"), ...addTask("Task 3")]);

    test("the first item has one drop target above it and two drop below it", () => {
      expect(nthTask(example, 0).dropTargets).toEqual([
        {width: "full", indentation: 0, side: "above"},
        {width: 1, indentation: 0, side: "below"},
        {width: "full", indentation: 1, side: "below"},
      ]);
    });

    test("the second item has two drop targets both above and below it", () => {
      expect(nthTask(example, 1).dropTargets).toEqual([
        {width: 1, indentation: 0, side: "above"},
        {width: "full", indentation: 1, side: "above"},
        {width: 1, indentation: 0, side: "below"},
        {width: "full", indentation: 1, side: "below"},
      ]);
    });
  });

  describe("when dragging one task into another", () => {
    const example = updateAll(empty, [...addTask("Task 1"), ...addTask("Task 2")]);

    test("before dragging anything, neither task is indented", () => {
      expect(view(example).taskList.map((t) => t.indentation)).toEqual([0, 0]);
    });

    const afterDragging = updateAll(example, [
      ...dragAndDrop(
        {type: "task", id: nthTask(example, 0).id},
        {type: "task", id: nthTask(example, 1).id, side: "below", indentation: 1},
      ),
    ]);

    describe("after dragging the second task into the first", () => {
      test("the first task is not indented", () => {
        expect(nthTask(afterDragging, 0).indentation).toBe(0);
      });

      test("the second task is indented", () => {
        expect(nthTask(afterDragging, 1).indentation).toBe(1);
      });

      test.skip("the drop targets for the first task are updated", () => {
        expect(nthTask(afterDragging, 0).dropTargets).toEqual([
          {width: "full", indentation: 0, side: "above"},
          {width: "full", indentation: 1, side: "below"},
        ]);
      });

      test.skip("the drop targets for the second task are updated", () => {
        expect(nthTask(afterDragging, 1).dropTargets).toEqual([
          {width: "full", indentation: 1, side: "above"},
          {width: 1, indentation: 0, side: "below"},
          {width: 1, indentation: 1, side: "below"},
          {width: "full", indentation: 2, side: "below"},
        ]);
      });
    });
  });
});
