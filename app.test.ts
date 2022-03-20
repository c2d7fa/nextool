import {updateApp, State, view, Event, empty, DragId, DropId, View} from "./app";
import {FilterId} from "./tasks";

function updateAll(state: State, events: (Event | ((view: View) => Event[]))[]): State {
  return events.reduce(
    (state, event) =>
      typeof event === "function" ? updateAll(state, event(view(state))) : updateApp(state, event),
    state,
  );
}

function addTask(title: string): Event[] {
  return [
    {tag: "textField", type: "edit", field: "addTitle", value: title},
    {tag: "textField", field: "addTitle", type: "submit"},
  ];
}

function startDragNthTask(n: number): (view: View) => Event[] {
  return (view: View) => [
    {tag: "drag", type: "drag", id: {type: "task", id: nthTask(view, n).id}, x: 100, y: 100},
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

function dragAndDropNth(
  m: number,
  n: number,
  {side, indentation}: {side: "above" | "below"; indentation: number},
) {
  return [
    (view: View) =>
      dragAndDrop(
        {type: "task", id: nthTask(view, m).id},
        {type: "task", id: nthTask(view, n).id, side, indentation},
      ),
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

    const action = updateAll(example, dragToFilter(nthTask(example, 0).id, "ready"));
    test("dragging a task to the action filter gives it the ready badge", () => {
      expect(view(action).taskList.map((t) => t.badges)).toEqual([["ready"], ["stalled"], ["stalled"]]);
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

    const draggingThird = updateAll(example, [startDragNthTask(2)]);

    test("the first item has one drop target above it and two drop below it", () => {
      expect(nthTask(draggingThird, 0).dropTargets).toEqual([
        {width: "full", indentation: 0, side: "above"},
        {width: 1, indentation: 0, side: "below"},
        {width: "full", indentation: 1, side: "below"},
      ]);
    });

    test("the second item has two drop targets both above and below it", () => {
      expect(nthTask(draggingThird, 1).dropTargets).toEqual([
        {width: 1, indentation: 0, side: "above"},
        {width: "full", indentation: 1, side: "above"},
        {width: 1, indentation: 0, side: "below"},
        {width: "full", indentation: 1, side: "below"},
      ]);
    });
  });

  describe("when dragging one task into another", () => {
    const example = updateAll(empty, [...addTask("Task 1"), ...addTask("Task 2"), ...addTask("Task 3")]);

    test("before dragging anything, neither task is indented", () => {
      expect(view(example).taskList.map((t) => t.indentation)).toEqual([0, 0, 0]);
    });

    const afterDragging = updateAll(example, [
      ...dragAndDrop(
        {type: "task", id: nthTask(example, 0).id},
        {type: "task", id: nthTask(example, 1).id, side: "below", indentation: 1},
      ),
    ]);

    const draggingThirdAfter = updateAll(afterDragging, [startDragNthTask(2)]);

    describe("after dragging the second task into the first", () => {
      test("the first task is not indented", () => {
        expect(nthTask(afterDragging, 0).indentation).toBe(0);
      });

      test("the second task is indented", () => {
        expect(nthTask(afterDragging, 1).indentation).toBe(1);
      });

      test("the drop targets for the first task are updated", () => {
        expect(nthTask(draggingThirdAfter, 0).dropTargets).toEqual([
          {width: "full", indentation: 0, side: "above"},
          {width: "full", indentation: 1, side: "below"},
        ]);
      });

      test("the drop targets for the second task are updated", () => {
        expect(nthTask(draggingThirdAfter, 1).dropTargets).toEqual([
          {width: "full", indentation: 1, side: "above"},
          {width: 1, indentation: 0, side: "below"},
          {width: 1, indentation: 1, side: "below"},
          {width: "full", indentation: 2, side: "below"},
        ]);
      });
    });
  });

  describe("scenario where the following task is at a higher level of indentation", () => {
    const example = updateAll(empty, [
      ...addTask("Task 0"),
      ...addTask("Task 1"),
      ...addTask("Task 2"),
      ...addTask("Task 3"),
      ...addTask("Task 4"),
      ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
      ...dragAndDropNth(2, 1, {side: "below", indentation: 2}),
      ...dragAndDropNth(3, 2, {side: "below", indentation: 1}),
    ]);

    const draggingLast = updateAll(example, [startDragNthTask(4)]);

    test("tasks are indented correctly", () => {
      expect(view(example).taskList.map((t) => t.indentation)).toEqual([0, 1, 2, 1, 0]);
    });

    test("below the task above the task at a higer level of indentation, there are drop targets only at that level of indentation", () => {
      expect(nthTask(draggingLast, 2).dropTargets.filter((dropTarget) => dropTarget.side === "below")).toEqual([
        {width: 1, indentation: 1, side: "below"},
        {width: 1, indentation: 2, side: "below"},
        {width: "full", indentation: 3, side: "below"},
      ]);
    });

    test("above the task at a higer level of indentation, there are drop targets only at that level of indentation", () => {
      expect(nthTask(draggingLast, 3).dropTargets.filter((dropTarget) => dropTarget.side === "above")).toEqual([
        {width: 1, indentation: 1, side: "above"},
        {width: 1, indentation: 2, side: "above"},
        {width: "full", indentation: 3, side: "above"},
      ]);
    });
  });

  describe("making a task a descendant of itself is not allowed", () => {
    describe("in a list of just one task", () => {
      const example = updateAll(empty, [...addTask("Task 1"), startDragNthTask(0)]);

      test("there are drop targets above and below the task itself at the same level of indentation", () => {
        expect(nthTask(example, 0).dropTargets).toContainEqual({width: "full", indentation: 0, side: "above"});
        expect(nthTask(example, 0).dropTargets).toContainEqual({width: "full", indentation: 0, side: "below"});
      });

      test("there are no other drop targets", () => {
        expect(nthTask(example, 0).dropTargets).toHaveLength(2);
      });
    });

    describe("when dragging a subtree of tasks", () => {
      const example = updateAll(empty, [
        ...addTask("Task 0"),
        ...addTask("Task 1"),
        ...addTask("Task 2"),
        ...addTask("Task 3"),
        ...addTask("Task 4"),
        ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
        ...dragAndDropNth(2, 1, {side: "below", indentation: 2}),
        ...dragAndDropNth(3, 2, {side: "below", indentation: 3}),
        ...dragAndDropNth(4, 3, {side: "below", indentation: 1}),
        startDragNthTask(1),
      ]);

      test("the tasks are indented correctly", () => {
        expect(view(example).taskList.map((t) => t.indentation)).toEqual([0, 1, 2, 3, 1]);
      });

      function dropTargetsOfNthTaskAtOrAbove(state: State, n: number, indentation: number) {
        return nthTask(state, n).dropTargets.filter((dropTarget) => dropTarget.indentation >= indentation);
      }

      test("the task being dragged has no drop targets above its own level of indentation", () => {
        expect(dropTargetsOfNthTaskAtOrAbove(example, 1, 2)).toHaveLength(0);
      });

      test("no child has drop targets above the level of indentation of the task being dragged", () => {
        expect(dropTargetsOfNthTaskAtOrAbove(example, 2, 2)).toHaveLength(0);
        expect(dropTargetsOfNthTaskAtOrAbove(example, 3, 2)).toHaveLength(0);
      });
    });
  });
});

describe("a task that has an unfinished child task isn't stalled", () => {
  describe("when there is a parent with one child task", () => {
    const example = updateAll(empty, [
      {tag: "selectFilter", filter: "all"},
      ...addTask("Parent"),
      ...addTask("Child"),
      ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
    ]);

    const childFinished = updateAll(example, [{tag: "checked", id: nthTask(example, 1).id, checked: true}]);

    describe("when the child has not been marked as done", () => {
      test("the child is unfinished", () => {
        expect(nthTask(example, 1).done).toBe(false);
      });

      test("the child is stalled", () => {
        expect(nthTask(example, 1).badges).toEqual(["stalled"]);
      });

      test("the parent is not stalled", () => {
        expect(nthTask(example, 0).badges).toEqual([]);
      });
    });

    describe("when the child is marked as finished", () => {
      test("the child is finished", () => {
        expect(nthTask(childFinished, 1).done).toBe(true);
      });

      test("the child is not stalled", () => {
        expect(nthTask(childFinished, 1).badges).toEqual([]);
      });

      test("the parent is stalled", () => {
        expect(nthTask(childFinished, 0).badges).toEqual(["stalled"]);
      });
    });
  });
});

describe("an action that has unfinished children isn't ready", () => {
  describe("when there is a parent action with one child action", () => {
    const example = updateAll(empty, [
      {tag: "selectFilter", filter: "all"},
      ...addTask("Parent"),
      ...addTask("Child"),
      ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
      (view) => dragToFilter(nthTask(view, 0).id, "ready"),
      (view) => dragToFilter(nthTask(view, 1).id, "ready"),
    ]);

    const childFinished = updateAll(example, [{tag: "checked", id: nthTask(example, 1).id, checked: true}]);

    describe("when the child has not been marked as done", () => {
      test("the child is unfinished", () => {
        expect(nthTask(example, 1).done).toBe(false);
      });

      test("the child is ready", () => {
        expect(nthTask(example, 1).badges).toEqual(["ready"]);
      });

      test("the parent is not ready", () => {
        expect(nthTask(example, 0).badges).toEqual([]);
      });
    });

    describe("when the child is marked as finished", () => {
      test("the child is finished", () => {
        expect(nthTask(childFinished, 1).done).toBe(true);
      });

      test("the child has no badges", () => {
        expect(nthTask(childFinished, 1).badges).toEqual([]);
      });

      test("the parent becomes ready", () => {
        expect(nthTask(childFinished, 0).badges).toEqual(["ready"]);
      });
    });
  });
});

describe("dragging a subtree of tasks", () => {
  const example = updateAll(empty, [
    ...addTask("Task 0"),
    ...addTask("Task 1"),
    ...addTask("Task 2"),
    ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
  ]);

  describe("initially", () => {
    test("the example has three tasks", () => {
      expect(view(example).taskList.length).toBe(3);
    });

    test("the example has tasks in the correct order", () => {
      expect(view(example).taskList.map((t) => t.title)).toEqual(["Task 0", "Task 1", "Task 2"]);
    });

    test("the example is indented correctly", () => {
      expect(view(example).taskList.map((t) => t.indentation)).toEqual([0, 1, 0]);
    });
  });

  const afterDragging = updateAll(example, [...dragAndDropNth(0, 2, {side: "below", indentation: 1})]);

  describe("after dragging the subtree into another task", () => {
    test("there are still three tasks", () => {
      expect(view(afterDragging).taskList.length).toBe(3);
    });

    test("the tasks have changed order", () => {
      expect(view(afterDragging).taskList.map((t) => t.title)).toEqual(["Task 2", "Task 0", "Task 1"]);
    });

    test("the tasks have changed indentation", () => {
      expect(view(afterDragging).taskList.map((t) => t.indentation)).toEqual([0, 1, 2]);
    });
  });
});

describe("filtered views of tasks", () => {
  describe("in an example where a child task is finished but the parent is not", () => {
    const exampleBeforeAll = updateAll(empty, [
      {tag: "selectFilter", filter: "all"},
      ...addTask("Task 0"),
      ...addTask("Task 1"),
      ...addTask("Task 2"),
      ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
      ...dragAndDropNth(2, 1, {side: "below", indentation: 2}),
    ]);

    const exampleAfterAll = updateAll(exampleBeforeAll, [
      {tag: "checked", id: nthTask(exampleBeforeAll, 1).id, checked: true},
    ]);

    const exampleBeforeDone = updateAll(exampleBeforeAll, [{tag: "selectFilter", filter: "done"}]);

    const exampleAfterDone = updateAll(exampleAfterAll, [{tag: "selectFilter", filter: "done"}]);

    describe("before marking the task as done", () => {
      test("the correct tasks are shown in the 'all' view", () => {
        expect(view(exampleBeforeAll).taskList.map((t) => t.title)).toEqual(["Task 0", "Task 1", "Task 2"]);
      });

      test("the tasks have the correct indentation", () => {
        expect(view(exampleBeforeAll).taskList.map((t) => t.indentation)).toEqual([0, 1, 2]);
      });

      test("the filtered view is empty", () => {
        expect(view(exampleBeforeDone).taskList.length).toBe(0);
      });
    });

    describe("after marking the task as done", () => {
      test("the same tasks are shown in the 'all' view", () => {
        expect(view(exampleAfterAll).taskList.map((t) => t.title)).toEqual(["Task 0", "Task 1", "Task 2"]);
      });

      test("the tasks have the same indentation in the 'all' view", () => {
        expect(view(exampleAfterAll).taskList.map((t) => t.indentation)).toEqual([0, 1, 2]);
      });

      test("the filtered view now contains the task", () => {
        expect(view(exampleAfterDone).taskList.map((t) => t.title)).toContainEqual("Task 1");
      });

      test("the filtered view also contains the subtask, even though it doesn't match filter itself", () => {
        expect(view(exampleAfterDone).taskList.map((t) => t.title)).toContainEqual("Task 2");
      });

      test("the filtered view contains no other tasks", () => {
        expect(view(exampleAfterDone).taskList).toHaveLength(2);
      });

      test("the tasks in the filtered view have the correct indentation", () => {
        expect(view(exampleAfterDone).taskList.map((t) => t.indentation)).toEqual([0, 1]);
      });
    });

    describe("after marking the leaf task as done", () => {
      const example2 = updateAll(exampleAfterAll, [
        {tag: "checked", id: nthTask(exampleAfterAll, 2).id, checked: true},
        {tag: "selectFilter", filter: "done"},
      ]);

      test("the same tasks are shown in the 'done' view (since it was already included)", () => {
        expect(view(example2).taskList.map((t) => t.title)).toEqual(["Task 1", "Task 2"]);
      });

      test("the task is now marked as done", () => {
        expect(nthTask(example2, 1).done).toBe(true);
      });
    });
  });
});
