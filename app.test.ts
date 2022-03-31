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

function check(view: View | State, n: number): Event[] {
  return [{tag: "check", id: nthTask(view, n).id}];
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

function openNth(n: number) {
  return (view: View) => [{tag: "selectEditingTask", id: nthTask(view, n).id} as const];
}

function sideBarActiveProjects(view: View) {
  return view.sideBar.find((section) => section.title === "Active projects")?.filters ?? [];
}

describe("adding tasks", () => {
  describe("with empty state", () => {
    test("there are no tasks", () => {
      expect(view(empty).taskList).toEqual([]);
    });
  });

  describe("after adding three new tasks", () => {
    const example = updateAll(empty, [
      ...switchToFilter("all"),
      ...addTask("Task 1"),
      ...addTask("Task 2"),
      ...addTask("Task 3"),
    ]);

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

describe("checking and unchecking tasks", () => {
  const step1 = updateAll(empty, [...switchToFilter("all"), ...addTask("Task 1")]);

  test("the task is marked as unfinished by default", () => {
    expect(nthTask(step1, 0).done).toBe(false);
  });

  const step2 = updateAll(step1, [...check(step1, 0)]);

  test("after checking once, the task becomes finished", () => {
    expect(nthTask(step2, 0).done).toBe(true);
  });

  const step3 = updateAll(step2, [...check(step2, 0)]);

  test("after checking twice, the task becomes unfinished again", () => {
    expect(nthTask(step3, 0).done).toBe(false);
  });
});

describe("adding tasks in filter", () => {
  describe("in ready filter", () => {
    const example = updateAll(empty, [...switchToFilter("ready"), ...addTask("Task 1")]);

    test("the task is shown in the current task list", () => {
      expect(view(example).taskList.map((t) => t.title)).toEqual(["Task 1"]);
    });
  });

  describe("in a project filter", () => {
    const step1 = updateAll(empty, [
      ...switchToFilter("all"),
      ...addTask("Project"),
      ...addTask("Outside project"),
      openNth(0),
      setComponentValue("Type", "project"),
      (view) => switchToFilter(sideBarActiveProjects(view)[0].filter),
    ]);

    describe("before adding any tasks", () => {
      test("no tasks are shown", () => {
        expect(view(step1).taskList).toEqual([]);
      });
    });

    const step2 = updateAll(step1, [...addTask("Inside project")]);

    describe("after adding a task", () => {
      test("the task is shown in the current task list", () => {
        expect(view(step2).taskList.map((t) => t.title)).toEqual(["Inside project"]);
      });
    });

    const step3 = updateAll(step2, [...addTask("Another task")]);

    describe("after adding another task", () => {
      test("the task is added to the end of the list", () => {
        expect(view(step3).taskList.map((t) => t.title)).toEqual(["Inside project", "Another task"]);
      });
    });
  });
});

describe("dragging tasks to filters", () => {
  describe("in an example with three tasks", () => {
    const example = updateAll(empty, [
      ...switchToFilter("all"),
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
    const example = updateAll(empty, [
      ...switchToFilter("all"),
      ...addTask("Task 1"),
      ...addTask("Task 2"),
      ...addTask("Task 3"),
    ]);

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
    const example = updateAll(empty, [
      ...switchToFilter("all"),
      ...addTask("Task 1"),
      ...addTask("Task 2"),
      ...addTask("Task 3"),
      ...addTask("Task 4"),
    ]);

    const draggingFourth = updateAll(example, [startDragNthTask(3)]);

    test("the first item has one drop target above it and two drop below it", () => {
      expect(nthTask(draggingFourth, 0).dropTargets).toEqual([
        {width: "full", indentation: 0, side: "above"},
        {width: 1, indentation: 0, side: "below"},
        {width: "full", indentation: 1, side: "below"},
      ]);
    });

    test("the second item has two drop targets both above and below it", () => {
      expect(nthTask(draggingFourth, 1).dropTargets).toEqual([
        {width: 1, indentation: 0, side: "above"},
        {width: "full", indentation: 1, side: "above"},
        {width: 1, indentation: 0, side: "below"},
        {width: "full", indentation: 1, side: "below"},
      ]);
    });
  });

  describe("when dragging one task into another", () => {
    const example = updateAll(empty, [
      ...switchToFilter("all"),
      ...addTask("Task 1"),
      ...addTask("Task 2"),
      ...addTask("Task 3"),
      ...addTask("Task 4"),
    ]);

    test("before dragging anything, neither task is indented", () => {
      expect(view(example).taskList.map((t) => t.indentation)).toEqual([0, 0, 0, 0]);
    });

    const afterDragging = updateAll(example, [
      ...dragAndDrop(
        {type: "task", id: nthTask(example, 0).id},
        {type: "task", id: nthTask(example, 1).id, side: "below", indentation: 1},
      ),
    ]);

    const draggingFourthAfter = updateAll(afterDragging, [startDragNthTask(3)]);

    describe("after dragging the second task into the first", () => {
      test("the first task is not indented", () => {
        expect(nthTask(afterDragging, 0).indentation).toBe(0);
      });

      test("the second task is indented", () => {
        expect(nthTask(afterDragging, 1).indentation).toBe(1);
      });

      test("the drop targets for the first task are updated", () => {
        expect(nthTask(draggingFourthAfter, 0).dropTargets).toEqual([
          {width: "full", indentation: 0, side: "above"},
          {width: "full", indentation: 1, side: "below"},
        ]);
      });

      test("the drop targets for the second task are updated", () => {
        expect(nthTask(draggingFourthAfter, 1).dropTargets).toEqual([
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
      ...switchToFilter("all"),
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
      const example = updateAll(empty, [...switchToFilter("all"), ...addTask("Task 1"), startDragNthTask(0)]);

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
        ...switchToFilter("all"),
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

  describe("dragging a task onto itself (or direct neighbors)", () => {
    function expectNthTaskNearbyDropTargetsToHave(
      state: State,
      n: number,
      dropTargets: {width: number | "full"; indentation: number}[],
    ) {
      expect(nthTask(state, n).dropTargets).toEqual([
        ...dropTargets.map((dropTarget) => ({...dropTarget, side: "above"})),
        ...dropTargets.map((dropTarget) => ({...dropTarget, side: "below"})),
      ]);
      expect(nthTask(state, n - 1).dropTargets.filter((dropTarget) => dropTarget.side === "below")).toEqual([
        ...dropTargets.map((dropTarget) => ({...dropTarget, side: "below"})),
      ]);
      expect(nthTask(state, n + 1).dropTargets.filter((dropTarget) => dropTarget.side === "above")).toEqual([
        ...dropTargets.map((dropTarget) => ({...dropTarget, side: "above"})),
      ]);
    }

    describe("in a flat list", () => {
      const example = updateAll(empty, [
        ...switchToFilter("all"),
        ...addTask("Task 0"),
        ...addTask("Task 1"),
        ...addTask("Task 2"),
        startDragNthTask(1),
      ]);

      test("the task can be dropped in the same place or indented one spot", () => {
        expectNthTaskNearbyDropTargetsToHave(example, 1, [
          {width: 1, indentation: 0},
          {width: "full", indentation: 1},
        ]);
      });

      [
        {description: "after dropping the task below itself with indentation", drop: 1, side: "below"} as const,
        {
          description: "after dropping the task above the next task with indentation",
          drop: 2,
          side: "above",
        } as const,
      ].forEach((testCase) => {
        describe(testCase.description, () => {
          const afterDrop = updateAll(example, [
            ...dragAndDropNth(1, testCase.drop, {side: testCase.side, indentation: 1}),
          ]);

          test("there are still three tasks in the example", () => {
            expect(view(afterDrop).taskList).toHaveLength(3);
          });

          test("they are still in the same order", () => {
            expect(view(afterDrop).taskList.map((t) => t.title)).toEqual(["Task 0", "Task 1", "Task 2"]);
          });

          test("the indentation has changed", () => {
            expect(view(afterDrop).taskList.map((t) => t.indentation)).toEqual([0, 1, 0]);
          });
        });
      });
    });

    describe("unindenting the last item in the subtree of a top-level item", () => {
      const example = updateAll(empty, [
        ...switchToFilter("all"),
        ...addTask("Task 0"),
        ...addTask("Task 1"),
        ...addTask("Task 2"),
        ...addTask("Task 3"),
        ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
        ...dragAndDropNth(2, 1, {side: "below", indentation: 2}),
        startDragNthTask(2),
      ]);

      test("the drop targets can be used to unindent the task", () => {
        expectNthTaskNearbyDropTargetsToHave(example, 2, [
          {width: 1, indentation: 0},
          {width: 1, indentation: 1},
          {width: "full", indentation: 2},
        ]);
      });
    });

    describe("unindenting an item in-place is disallowed when it would mess with following tasks", () => {
      test("when the task has logical sibling following it, it cannot be unindented at all", () => {
        const example = updateAll(empty, [
          ...switchToFilter("all"),
          ...addTask("Task 0"),
          ...addTask("Task 1"),
          ...addTask("Task 2"),
          ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
          ...dragAndDropNth(2, 1, {side: "below", indentation: 1}),
          startDragNthTask(1),
        ]);

        expectNthTaskNearbyDropTargetsToHave(example, 1, [{width: "full", indentation: 1}]);
      });

      test("even at the end of a subtree, task cannot be dragged beyong following task", () => {
        const example = updateAll(empty, [
          ...switchToFilter("all"),
          ...addTask("Task 0"),
          ...addTask("Task 1"),
          ...addTask("Task 2"),
          ...addTask("Task 3"),
          ...addTask("Task 4"),
          ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
          ...dragAndDropNth(2, 1, {side: "below", indentation: 2}),
          ...dragAndDropNth(3, 2, {side: "below", indentation: 2}),
          ...dragAndDropNth(4, 3, {side: "below", indentation: 1}),
          startDragNthTask(3),
        ]);

        expectNthTaskNearbyDropTargetsToHave(example, 3, [
          {width: 1, indentation: 1},
          {width: 1, indentation: 2},
          {width: "full", indentation: 3},
        ]);
      });

      test("however, tasks that are descendants of the task being dragged are not taken into account", () => {
        const example = updateAll(empty, [
          ...switchToFilter("all"),
          ...addTask("Task 0"),
          ...addTask("Task 1"),
          ...addTask("Task 2"),
          ...addTask("Task 3"),
          ...addTask("Task 4"),
          ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
          ...dragAndDropNth(2, 1, {side: "below", indentation: 1}),
          ...dragAndDropNth(3, 2, {side: "below", indentation: 2}),
          startDragNthTask(2),
        ]);

        expectNthTaskNearbyDropTargetsToHave(example, 2, [
          {width: 1, indentation: 0},
          {width: 1, indentation: 1},
          {width: "full", indentation: 2},
        ]);
      });
    });

    test("dragging a task below its last descendant is like dragging the item to itself except it can't be indented further", () => {
      const example = updateAll(empty, [
        ...switchToFilter("all"),
        ...addTask("Task 0"),
        ...addTask("Task 1"),
        ...addTask("Task 2"),
        ...addTask("Task 3"),
        ...addTask("Task 4"),
        ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
        ...dragAndDropNth(2, 1, {side: "below", indentation: 1}),
        ...dragAndDropNth(3, 2, {side: "below", indentation: 2}),
        startDragNthTask(2),
      ]);

      expect(nthTask(example, 3).dropTargets.filter((dropTarget) => dropTarget.side === "below")).toEqual([
        {width: 1, indentation: 0, side: "below"},
        {width: "full", indentation: 1, side: "below"},
      ]);
    });

    describe("bugs", () => {
      test("the indentation of the preceeding item would be taken into account when it shouldn't", () => {
        const example = updateAll(empty, [
          ...switchToFilter("all"),
          ...addTask("Task 0"),
          ...addTask("Task 1"),
          ...addTask("Task 2"),
          ...addTask("Task 3"),
          ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
          ...dragAndDropNth(3, 2, {side: "below", indentation: 1}),
          startDragNthTask(0),
        ]);

        expect(nthTask(example, 2).dropTargets.filter((dropTarget) => dropTarget.side === "below")).toEqual([
          {width: "full", indentation: 1, side: "below"},
        ]);
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

    const childFinished = updateAll(example, [...check(view(example), 1)]);

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

    const childFinished = updateAll(example, [...check(view(example), 1)]);

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
    ...switchToFilter("all"),
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

    const exampleAfterAll = updateAll(exampleBeforeAll, [...check(view(exampleBeforeAll), 1)]);

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
        ...check(view(exampleAfterAll), 2),
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

function componentTitled(view: View, title: string) {
  function groups(view: View) {
    return view.editor?.sections.flatMap((section) => section) ?? [];
  }

  return groups(view).find((group) => group.title === title)?.components[0] ?? null;
}

function setComponentValue(componentTitle: string, value: string) {
  return (view: View) => {
    const component = componentTitled(view, componentTitle);
    if (component == null) throw "no such component";
    return [{tag: "editor", type: "component", component, value} as const];
  };
}

describe("the task editor", () => {
  describe("editing task title", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), ...addTask("Task")]);

    describe("initially", () => {
      test("the example task is shown in the task list", () => {
        expect(view(step1).taskList.map((t) => t.title)).toEqual(["Task"]);
      });

      test("the task editor is hidden", () => {
        expect(view(step1).editor).toEqual(null);
      });
    });

    const step2 = updateAll(step1, [openNth(0)]);

    describe("after opening the task in the editor", () => {
      test("the task editor is shown", () => {
        expect(view(step2).editor).not.toBeNull();
      });

      test("there is a component called 'Title'", () => {
        expect(componentTitled(view(step2), "Title")).not.toBeNull();
      });

      test("the component contains the task title", () => {
        expect(componentTitled(view(step2), "Title")).toMatchObject({type: "text", value: "Task"});
      });
    });

    const step3 = updateAll(step2, [setComponentValue("Title", "Task with edited title")]);

    describe("after editing title in the editor", () => {
      test("the title component contains the new title", () => {
        expect(componentTitled(view(step3), "Title")).toMatchObject({
          type: "text",
          value: "Task with edited title",
        });
      });

      test("the task in the task list has the new title", () => {
        expect(view(step3).taskList.map((t) => t.title)).toEqual(["Task with edited title"]);
      });
    });
  });

  describe("setting task status", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), ...addTask("Task"), openNth(0)]);

    describe("initially", () => {
      test("the example task is not checked in the task list", () => {
        expect(view(step1).taskList.map((t) => t.done)).toEqual([false]);
      });

      test("there is a component titled 'Status'", () => {
        expect(componentTitled(view(step1), "Status")).not.toBeNull();
      });

      test("it is a picker component", () => {
        expect(componentTitled(view(step1), "Status")).toMatchObject({type: "picker"});
      });

      test("it has the correct options", () => {
        expect((componentTitled(view(step1), "Status") as any).options.map((option: any) => option.value)).toEqual(
          ["active", "paused", "done"],
        );
      });

      test("the selected option is 'Active'", () => {
        expect(
          (componentTitled(view(step1), "Status") as any).options.map((option: any) => option.active),
        ).toEqual([true, false, false]);
      });
    });

    const step2a = updateAll(step1, [...check(view(step1), 0)]);

    describe("if the task is checked in the task list", () => {
      test("the task is marked as done in the task list", () => {
        expect(view(step2a).taskList.map((t) => t.done)).toEqual([true]);
      });

      test("the selected status option is changed", () => {
        expect(
          (componentTitled(view(step2a), "Status") as any).options.map((option: any) => option.active),
        ).toEqual([false, false, true]);
      });
    });

    const step2b = updateAll(step1, [setComponentValue("Status", "done")]);

    describe("if the task status is changed in the editor instead", () => {
      test("the task is marked as done in the task list", () => {
        expect(view(step2b).taskList.map((t) => t.done)).toEqual([true]);
      });

      test("the selected status option is changed", () => {
        expect(
          (componentTitled(view(step2b), "Status") as any).options.map((option: any) => option.active),
        ).toEqual([false, false, true]);
      });
    });
  });

  describe("marking tasks as action", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), ...addTask("Task"), openNth(0)]);

    describe("initially", () => {
      test("the example task has the stalled badge in the task list", () => {
        expect(view(step1).taskList.map((t) => t.badges)).toEqual([["stalled"]]);
      });

      test("there is a component titled 'Actionable'", () => {
        expect(componentTitled(view(step1), "Actionable")).not.toBeNull();
      });

      test("it is a picker component", () => {
        expect(componentTitled(view(step1), "Actionable")).toMatchObject({type: "picker"});
      });

      test("it has the correct options", () => {
        expect(
          (componentTitled(view(step1), "Actionable") as any).options.map((option: any) => option.value),
        ).toEqual(["yes", "no"]);
      });

      test("the selected option is 'Not Ready'", () => {
        expect(
          (componentTitled(view(step1), "Actionable") as any).options.map((option: any) => option.active),
        ).toEqual([false, true]);
      });
    });

    const step2 = updateAll(step1, [...dragToFilter(nthTask(step1, 0).id, "ready")]);

    describe("after dragging the task into the ready filter", () => {
      test("the task has the ready badge in the task list", () => {
        expect(view(step2).taskList.map((t) => t.badges)).toEqual([["ready"]]);
      });

      test("the selected option becomes 'Ready'", () => {
        expect(
          (componentTitled(view(step2), "Actionable") as any).options.map((option: any) => option.active),
        ).toEqual([true, false]);
      });
    });

    const step3 = updateAll(step2, [setComponentValue("Actionable", "no")]);

    describe("after changing the task status back in the editor", () => {
      test("the task reverts to the stalled badge", () => {
        expect(view(step3).taskList.map((t) => t.badges)).toEqual([["stalled"]]);
      });

      test("the selected option becomes 'Not Ready' again", () => {
        expect(
          (componentTitled(view(step3), "Actionable") as any).options.map((option: any) => option.active),
        ).toEqual([false, true]);
      });
    });
  });
});

describe("paused tasks", () => {
  describe("in an example with a single stalled task", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), ...addTask("Task"), openNth(0)]);

    describe("initially", () => {
      test("the task has the stalled badge", () => {
        expect(view(step1).taskList.map((t) => t.badges)).toEqual([["stalled"]]);
      });

      test("the task is not paused", () => {
        expect(view(step1).taskList.map((t) => t.paused)).toEqual([false]);
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Status", "paused")]);

    describe("after changing the task status to paused in the editor", () => {
      test("the task loses its badges", () => {
        expect(view(step2).taskList.map((t) => t.badges)).toEqual([[]]);
      });

      test("the task is paused", () => {
        expect(view(step2).taskList.map((t) => t.paused)).toEqual([true]);
      });
    });
  });

  describe("in an example with a child task", () => {
    const step1 = updateAll(empty, [
      ...switchToFilter("all"),
      ...addTask("Parent"),
      ...addTask("Child"),
      ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
      openNth(0),
    ]);

    describe("initially", () => {
      test("neither the parent nor the child is paused", () => {
        expect(view(step1).taskList.map((t) => t.paused)).toEqual([false, false]);
      });

      test("the child has the stalled badge", () => {
        expect(view(step1).taskList.map((t) => t.badges)).toEqual([[], ["stalled"]]);
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Status", "paused")]);

    describe("after changing the parent's task status to paused in the editor", () => {
      test("both the parent and the child are paused", () => {
        expect(view(step2).taskList.map((t) => t.paused)).toEqual([true, true]);
      });

      test("neither task has any badges", () => {
        expect(view(step2).taskList.map((t) => t.badges)).toEqual([[], []]);
      });
    });

    const step3 = updateAll(step2, [...switchToFilter("stalled")]);

    describe("after switching to the stalled filter", () => {
      test("the task list is empty", () => {
        expect(view(step3).taskList).toEqual([]);
      });
    });
  });

  describe("when paused tasks are children of non-paused parents", () => {
    describe("paused children prevents otherwise actionable parent from being ready", () => {
      const step1 = updateAll(empty, [
        ...switchToFilter("all"),
        ...addTask("Parent"),
        ...addTask("Child"),
        ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
        openNth(0),
        setComponentValue("Actionable", "yes"),
        openNth(1),
        setComponentValue("Status", "paused"),
      ]);

      describe("when child is paused", () => {
        test("parent is stalled", () => {
          expect(view(step1).taskList.map((t) => t.badges)).toEqual([["stalled"], []]);
        });

        test("child is paused", () => {
          expect(view(step1).taskList.map((t) => t.paused)).toEqual([false, true]);
        });
      });

      const step2 = updateAll(step1, [...check(view(step1), 1)]);

      describe("after marking child as done", () => {
        test("parent becomes ready", () => {
          expect(view(step2).taskList.map((t) => t.badges)).toEqual([["ready"], []]);
        });

        test("child is not paused", () => {
          expect(view(step2).taskList.map((t) => t.paused)).toEqual([false, false]);
        });
      });
    });

    describe("task that would be stalled without paused child is still stalled", () => {
      const step1 = updateAll(empty, [
        ...switchToFilter("all"),
        ...addTask("Parent"),
        ...addTask("Child"),
        ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
        openNth(1),
        setComponentValue("Status", "paused"),
      ]);

      describe("when child is paused", () => {
        test("parent is stalled", () => {
          expect(view(step1).taskList.map((t) => t.badges)).toEqual([["stalled"], []]);
        });

        test("child is paused", () => {
          expect(view(step1).taskList.map((t) => t.paused)).toEqual([false, true]);
        });
      });

      const step2 = updateAll(step1, [...check(view(step1), 1)]);

      describe("after marking child as done", () => {
        test("parent is still stalled", () => {
          expect(view(step2).taskList.map((t) => t.badges)).toEqual([["stalled"], []]);
        });

        test("child is not paused", () => {
          expect(view(step2).taskList.map((t) => t.paused)).toEqual([false, false]);
        });
      });
    });
  });
});

describe("counter next to filters", () => {
  function indicatorForFilter(view: View, label: string) {
    return view.sideBar.flatMap((section) => section.filters).find((filter) => filter.label === label)?.indicator;
  }

  const step1 = updateAll(empty, []);

  test("with no tasks, the counter isn't shown", () => {
    expect(indicatorForFilter(view(step1), "Stalled")).toEqual(null);
  });

  const step2 = updateAll(empty, [...switchToFilter("all"), ...addTask("Task")]);

  test("after adding task, the counter is shown", () => {
    expect(indicatorForFilter(view(step2), "Stalled")).toEqual({text: "1"});
  });

  const step3 = updateAll(step2, [...dragToFilter(nthTask(step2, 0).id, "ready")]);

  test("after dragging task into ready filter, the counter is hidden again", () => {
    expect(indicatorForFilter(view(step3), "Stalled")).toEqual(null);
  });
});

function pickerValue(view: View, title: string) {
  const component = componentTitled(view, title);
  if (component?.type !== "picker") return null;
  return component.options.find((option) => option.active)?.value;
}

describe("projects", () => {
  describe("marking a task as a project in the task list updates type", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), ...addTask("Project"), openNth(0)]);

    describe("initially", () => {
      test("the task has type task in editor", () => {
        expect(pickerValue(view(step1), "Type")).toEqual("task");
      });

      test("the task is not a project in task list", () => {
        expect(view(step1).taskList.map((t) => t.project)).toEqual([false]);
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Type", "project")]);

    describe("after changing the type to project", () => {
      test("the task has type project in editor", () => {
        expect(pickerValue(view(step2), "Type")).toEqual("project");
      });

      test("the task is a project in task list", () => {
        expect(view(step2).taskList.map((t) => t.project)).toEqual([true]);
      });
    });
  });

  describe("projects cannot be marked as actionable", () => {
    const step1 = updateAll(empty, [
      ...switchToFilter("all"),
      ...addTask("Project"),
      openNth(0),
      setComponentValue("Actionable", "yes"),
    ]);

    describe("before marking an action as a project", () => {
      test("there is a component in the editor called 'Actionable'", () => {
        expect(componentTitled(view(step1), "Actionable")).not.toBeNull();
      });

      test("the task has the ready badge", () => {
        expect(view(step1).taskList.map((t) => t.badges)).toEqual([["ready"]]);
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Type", "project")]);

    describe("after marking a task as a project", () => {
      test("there is no component in the editor called 'Actionable'", () => {
        expect(componentTitled(view(step2), "Actionable")).toBeNull();
      });

      test("the project has the stalled badge", () => {
        expect(view(step2).taskList.map((t) => t.badges)).toEqual([["stalled"]]);
      });
    });
  });

  describe("list of projects in the sidebar", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), ...addTask("Project"), openNth(0)]);

    describe("without any projects", () => {
      test("the list of active projects in the sidebar is empty", () => {
        expect(sideBarActiveProjects(view(step1))).toEqual([]);
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Type", "project")]);

    describe("after marking a task as a project", () => {
      test("the project is added to the list of active projects in the sidebar", () => {
        expect(sideBarActiveProjects(view(step2)).map((project) => project.label)).toEqual(["Project"]);
      });
    });

    const step3a = updateAll(step2, [setComponentValue("Status", "paused")]);

    describe("after marking the project as paused", () => {
      test("the sidebar becomes empty again", () => {
        expect(sideBarActiveProjects(view(step3a))).toEqual([]);
      });

      test("but the item is still shown as a project in the task list", () => {
        expect(view(step3a).taskList.map((t) => t.project)).toEqual([true]);
      });
    });

    const step3b = updateAll(step2, [setComponentValue("Status", "done")]);

    describe("after marking the project as done", () => {
      test("the sidebar becomes empty again", () => {
        expect(sideBarActiveProjects(view(step3b))).toEqual([]);
      });

      test("but the item is still shown as a project in the task list", () => {
        expect(view(step3b).taskList.map((t) => t.project)).toEqual([true]);
      });
    });
  });

  describe("stalled projects have indicators in sidebar", () => {
    const step1 = updateAll(empty, [
      ...switchToFilter("all"),
      ...addTask("Project"),
      openNth(0),
      setComponentValue("Type", "project"),
    ]);

    test("stalled project has indicator in sidebar", () => {
      expect(sideBarActiveProjects(view(step1))[0]).toMatchObject({
        label: "Project",
        indicator: {},
      });
    });

    const step2 = updateAll(step1, [
      ...addTask("Action"),
      openNth(1),
      setComponentValue("Type", "action"),
      ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
    ]);

    test("after adding action as child, indicator is removed", () => {
      expect(sideBarActiveProjects(view(step2))[0]).toMatchObject({
        label: "Project",
        indicator: null,
      });
    });
  });

  describe("opening project from sidebar", () => {
    const step1 = updateAll(empty, [
      ...switchToFilter("all"),
      ...addTask("Example project"),
      openNth(0),
      setComponentValue("Type", "project"),
      ...addTask("Inside project"),
      ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
      ...addTask("Outside project"),
    ]);

    describe("in the 'all' filter", () => {
      test("there are three tasks", () => {
        expect(view(step1).taskList.length).toEqual(3);
      });

      test("the 'all' filter is the only active filter in the sidebar", () => {
        expect(
          view(step1)
            .sideBar.flatMap((section) => section.filters)
            .filter((filter) => filter.selected)
            .map((filter) => filter.label),
        ).toEqual(["All"]);
      });
    });

    const projectFilter = sideBarActiveProjects(view(step1))[0].filter;
    const step2 = updateAll(step1, [...switchToFilter(projectFilter)]);

    describe("after switching to the project filter", () => {
      test("it becomes the only active filter in the sidebar", () => {
        expect(
          view(step2)
            .sideBar.flatMap((section) => section.filters)
            .filter((filter) => filter.selected)
            .map((filter) => filter.label),
        ).toEqual(["Example project"]);
      });

      test("only one task (which is in the project) is shown now", () => {
        expect(view(step2).taskList.length).toEqual(1);
      });
    });
  });
});

describe("archiving tasks", () => {
  function archive(n: number) {
    return (view: View) => dragToFilter(nthTask(view, n).id, "archive");
  }

  describe("when the archived task is a subtask", () => {
    const step1 = updateAll(empty, [
      ...switchToFilter("all"),
      ...addTask("Task 1"),
      ...addTask("Task 2"),
      ...addTask("Task 3"),
      ...dragAndDropNth(1, 0, {side: "below", indentation: 1}),
      ...dragAndDropNth(2, 1, {side: "below", indentation: 1}),
    ]);

    test("initially all tasks are shown in the view", () => {
      expect(view(step1).taskList.map(({title, indentation}) => ({title, indentation}))).toEqual([
        {title: "Task 1", indentation: 0},
        {title: "Task 2", indentation: 1},
        {title: "Task 3", indentation: 1},
      ]);
    });

    const step2 = updateAll(step1, [archive(1)]);

    test("after archiving, the subtask is removed from the main view", () => {
      expect(view(step2).taskList.map(({title, indentation}) => ({title, indentation}))).toEqual([
        {title: "Task 1", indentation: 0},
        {title: "Task 3", indentation: 1},
      ]);
    });

    const step3 = updateAll(step2, [...switchToFilter("archive")]);

    test("switching to the archive view shows the archived task", () => {
      expect(view(step3).taskList.map(({title, indentation}) => ({title, indentation}))).toEqual([
        {title: "Task 2", indentation: 0},
      ]);
    });

    const step4 = updateAll(step3, [...dragToFilter(nthTask(view(step3), 0).id, "all"), ...switchToFilter("all")]);

    test("after unarchiving the task, it is restored to the original location in the main view", () => {
      expect(view(step4).taskList.map(({title, indentation}) => ({title, indentation}))).toEqual([
        {title: "Task 1", indentation: 0},
        {title: "Task 2", indentation: 1},
        {title: "Task 3", indentation: 1},
      ]);
    });
  });

  describe("archiving project removes it from active projects list", () => {
    const step1 = updateAll(empty, [
      ...switchToFilter("all"),
      ...addTask("Project"),
      openNth(0),
      setComponentValue("Type", "project"),
    ]);

    test("initially the project is shown in the sidebar", () => {
      expect(sideBarActiveProjects(view(step1)).map(({label}) => ({label}))).toEqual([{label: "Project"}]);
    });

    const step2 = updateAll(step1, [archive(0)]);

    test("after archiving, the project is removed from the sidebar", () => {
      expect(sideBarActiveProjects(view(step2))).toEqual([]);
    });
  });
});
