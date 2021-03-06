import * as process from "process";
import {updateApp, State, view as viewApp, Event, empty, DragId, DropId, View, effects, Effect} from "./app";
import {DropTargetView, FilterId, TaskView} from "./tasks";

function view(app: State): View {
  return viewApp({...app, today: new Date("2020-03-15T12:00:00Z")});
}

type Modifications = Event | ((view: View) => readonly Event[]) | readonly Modifications[];

function updateAll(state: State, mods: Modifications): State {
  return stateAndEffectsAfter(state, mods)[0];
}

function stateAndEffectsAfter(app: State, mods: Modifications): [State, Effect[]] {
  const state = {...app, today: new Date("2020-03-15T12:00:00Z")};
  if (typeof mods === "function") {
    return stateAndEffectsAfter(app, mods(view(app)));
  } else if (Array.isArray(mods)) {
    return mods.reduce(([state, effects], mod) => stateAndEffectsAfter(state, mod), [app, []]);
  } else {
    return [updateApp(state, mods as Event), effects(state, mods as Event)];
  }
}

function addTask(title: string, ...opts: (number | FilterId | "project")[]): Modifications {
  const indentation = (opts?.find((o) => typeof o === "number") as number | undefined) ?? 0;
  const filters = opts?.filter((o) => typeof o === "string" && o !== "project");
  const project = opts.some((o) => o === "project");

  return [
    [
      {tag: "textField", type: "edit", field: "addTitle", value: title},
      {tag: "textField", field: "addTitle", type: "submit"},
    ],
    (view: View) =>
      indentation === 0
        ? []
        : dragAndDropNth(tasks(view, []).length - 1, tasks(view, []).length - 2, {
            side: "below",
            indentation,
          }),
    (view: View) => filters.map((filter) => dragToFilter(tasks(view, []).length - 1, filter as FilterId)),
    (view: View) => (project ? [openNth(tasks(view, []).length - 1), setComponentValue("Type", "project")] : []),
  ] as Modifications;
}

function startDragNthTask(n: number) {
  return (view: View) =>
    [{tag: "drag", type: "drag", id: {type: "task", id: nthTask(view, n).id}, x: 100, y: 100}] as const;
}

function dragAndDrop(drag: DragId, drop: DropId) {
  return [
    {tag: "drag", type: "drag", id: drag, x: 100, y: 100},
    {tag: "drag", type: "hover", target: drop},
    {tag: "drag", type: "drop"},
  ] as const;
}

function hoverNth(n: number, {side, indentation}: {side: "above" | "below"; indentation: number}) {
  return (view: View) => {
    const dropTarget = dropTargetsAfter_(view, side === "above" ? n - 1 : n).find(
      (dropTarget) => dropTarget.indentation === indentation,
    );
    if (!dropTarget) throw "no such drop target";
    return [
      {
        tag: "drag" as const,
        type: "hover" as const,
        target: {type: "list" as const, target: dropTarget.handle},
      },
    ];
  };
}

function dragToFilter(n: number, filter: FilterId) {
  return (view: View) => dragAndDrop({type: "task", id: nthTask(view, n).id}, {type: "filter", id: filter});
}

function viewed(state: State | View): View {
  return "tasks" in state ? view(state) : state;
}

function nthTask(view: View | State, n: number): TaskView {
  const result = viewed(view)
    .taskList.flatMap((section) => section.rows)
    .filter((row) => row.type === "task")[n];
  if (!result) throw "no such task";
  return result as TaskView;
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
    startDragNthTask(m),
    (view: View) => {
      const dropTarget = dropTargetsAfter_(view, side === "above" ? n - 1 : n).find(
        (dropTarget) => dropTarget.indentation === indentation,
      );
      if (!dropTarget) throw "no such drop target";
      return dragAndDrop({type: "task", id: nthTask(view, m).id}, {type: "list", target: dropTarget.handle});
    },
  ];
}

function switchToFilter(filter: FilterId): Event[] {
  return [{tag: "selectFilter", filter}];
}

function switchToFilterCalled(label: string) {
  return (view: View) => {
    const filter = view.sideBar.flatMap((section) => section.filters).find((row) => row.label === label);
    if (!filter) {
      console.error("No filter called %o", label);
      throw "no such filter";
    }
    return switchToFilter(filter.filter);
  };
}

function dragToTab(n: number, label: string) {
  return (view: View) => {
    const filter = view.sideBar.flatMap((section) => section.filters).find((row) => row.label === label);
    if (!filter || !filter.dropTarget) throw "no such filter";
    return dragAndDrop({type: "task", id: nthTask(view, n).id}, filter.dropTarget);
  };
}

function openNth(n: number) {
  return (view: View) => [{tag: "selectEditingTask", id: nthTask(view, n).id} as const];
}

function sideBarActiveProjects(view: View) {
  return view.sideBar.find((section) => section.title === "Active projects")?.filters ?? [];
}

function select<T extends object, P extends (keyof T)[] | keyof T>(
  x: T,
  properties: P,
): P extends keyof T ? T[P] : P extends any[] ? {[K in P[number]]: T[K]} : never {
  if (typeof properties === "string") return (x as any)[properties];
  return (properties as any).reduce(
    (result: any, property: keyof T) => ({...result, [property]: x[property]}),
    {},
  );
}

function tasks<P extends (keyof TaskView)[] | keyof TaskView>(
  view: View | State,
  properties: P,
): P extends keyof TaskView ? TaskView[P][] : P extends any[] ? {[K in P[number]]: TaskView[K]}[] : never {
  return viewed(view)
    .taskList.flatMap((section) => section.rows)
    .filter((row) => row.type === "task")
    .map((task: any) => select(task, properties)) as any;
}

function tasksInSection(view: View | State, title: string, properties: (keyof TaskView)[] | keyof TaskView) {
  return viewed(view)
    .taskList.flatMap((section) => (section.title === title ? section.rows : []))
    .filter((row) => row.type === "task")
    .map((task: any) => select(task, properties));
}

function pickerOptions(view: View | State, title: string): string[] {
  const component = componentTitled(view, title);
  if (component == null) return [];
  if (component.type !== "picker") return [];
  return component.options.map((option) => option.value);
}

function pickerValue(view: View | State, title: string): string {
  const component = componentTitled(view, title);
  if (component?.type !== "picker") return "";
  return component.options.find((option) => option.active)?.value ?? "";
}

function dropTargetsAfter_(view: View | State, n: number): DropTargetView[] {
  let foundStart = n === -1;
  let result: DropTargetView[] = [];

  for (const row of viewed(view).taskList.flatMap((section) => section.rows)) {
    if (row.type === "task") {
      if (n >= 0 && row.id === nthTask(view, n).id) {
        foundStart = true;
      } else if (foundStart) {
        return result;
      }
    } else if (row.type === "dropTarget") {
      if (foundStart) {
        result.push(row);
      }
    }
  }

  return result;
}

function dropTargetsAfter(view: View | State, n: number) {
  return dropTargetsAfter_(view, n).map((dropTarget) => select(dropTarget, ["width", "indentation"]));
}

function indicatorForFilter(view: View | State, label: string) {
  return viewed(view)
    .sideBar.flatMap((section) => section.filters)
    .find((filter) => filter.label === label)?.indicator;
}

const bStalled = {label: "Stalled", icon: "stalled", color: "orange"};
const bReady = {label: "Ready", icon: "ready", color: "green"};
const bProject = {label: "Project", icon: "project", color: "project"};
const bToday = {label: "Today", icon: "today", color: "red"};

// -----

describe("adding tasks", () => {
  describe("with empty state", () => {
    test("there are no tasks", () => {
      expect(tasks(empty, [])).toEqual([]);
    });
  });

  describe("after adding three new tasks", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 1"),
      addTask("Task 2"),
      addTask("Task 3"),
    ]);

    test("there are three tasks in the task list", () => {
      expect(tasks(example, [])).toEqual([{}, {}, {}]);
    });

    test("they are added from top to bottom", () => {
      expect(tasks(example, "title")).toEqual(["Task 1", "Task 2", "Task 3"]);
    });

    test("they are all marked unfinished", () => {
      expect(tasks(example, "done")).toEqual([false, false, false]);
    });

    test("they are marked as stalled", () => {
      expect(tasks(example, "badges")).toEqual([[bStalled], [bStalled], [bStalled]]);
    });
  });
});

describe("checking and unchecking tasks", () => {
  const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Task 1")]);

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
    const example = updateAll(empty, [...switchToFilter("ready"), addTask("Task 1")]);

    test("the task is shown in the current task list", () => {
      expect(tasks(example, "title")).toEqual(["Task 1"]);
    });
  });

  describe("in a project filter", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Project", "project"),
      addTask("Outside project"),
      (view) => switchToFilter(sideBarActiveProjects(view)[0]?.filter!),
    ]);

    describe("before adding any tasks", () => {
      test("no tasks are shown", () => {
        expect(tasks(step1, [])).toEqual([]);
      });
    });

    const step2 = updateAll(step1, [addTask("Inside project")]);

    describe("after adding a task", () => {
      test("the task is shown in the current task list", () => {
        expect(tasks(step2, "title")).toEqual(["Inside project"]);
      });
    });

    const step3 = updateAll(step2, [addTask("Another task")]);

    describe("after adding another task", () => {
      test("the task is added to the end of the list", () => {
        expect(tasks(step3, "title")).toEqual(["Inside project", "Another task"]);
      });
    });
  });
});

describe("dragging tasks to filters", () => {
  describe("in an example with three tasks", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 1"),
      addTask("Task 2"),
      addTask("Task 3"),
      switchToFilter("all"),
    ]);

    test("they are all marked as stalled at first", () => {
      expect(tasks(example, "badges")).toEqual([[bStalled], [bStalled], [bStalled]]);
    });

    test("they are all marked unfinished at first", () => {
      expect(tasks(example, "done")).toEqual([false, false, false]);
    });

    const action = updateAll(example, [dragToFilter(0, "ready")]);
    test("dragging a task to the action filter gives it the ready badge", () => {
      expect(tasks(action, "badges")).toEqual([[bReady], [bStalled], [bStalled]]);
    });

    const done = updateAll(example, [dragToFilter(0, "done")]);
    test("dragging a task to the done filter marks it as done", () => {
      expect(tasks(done, "done")).toEqual([true, false, false]);
    });

    test("dragging a task marked action to stalled gives it the stalled badge again", () => {
      const stalled = updateAll(action, [dragToFilter(0, "stalled")]);
      expect(tasks(stalled, "badges")).toEqual([[bStalled], [bStalled], [bStalled]]);
    });

    test("dragging a task marked done to unfinished marks it as unfinished again", () => {
      const unfinished = updateAll(done, [dragToFilter(0, "not-done")]);
      expect(tasks(unfinished, "done")).toEqual([false, false, false]);
    });
  });

  describe("project filter", () => {
    const step1 = updateAll(empty, [switchToFilter("all"), addTask("Project", "project"), addTask("Task 1")]);

    const step2 = updateAll(step1, [dragToTab(1, "Project")]);

    test("dragging a task to a project filter nests it under that project", () => {
      expect(tasks(step2, ["title", "indentation"])).toEqual([
        {title: "Project", indentation: 0},
        {title: "Task 1", indentation: 1},
      ]);
    });
  });

  describe("paused filter", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Task 1")]);

    test("initially, the task is not paused", () => {
      expect(tasks(step1, "paused")).toEqual([false]);
    });

    const step2 = updateAll(step1, [dragToTab(0, "Paused")]);

    test("dragging a task to the paused filter marks it as paused", () => {
      expect(tasks(step2, "paused")).toEqual([true]);
    });
  });
});

describe("reordering tasks with drag and drop", () => {
  describe("in an example with three tasks", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 1"),
      addTask("Task 2"),
      addTask("Task 3"),
    ]);

    function testReorder(from: number, to: number, side: "above" | "below", result: number[]): void {
      test(`dragging task ${from} to ${side} ${to}`, () => {
        const moved = updateAll(example, [...dragAndDropNth(from - 1, to - 1, {side, indentation: 0})]);
        expect(tasks(moved, "title")).toEqual(result.map((x) => `Task ${x}`));
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
      switchToFilter("all"),
      addTask("Task 1"),
      addTask("Task 2"),
      addTask("Task 3"),
      addTask("Task 4"),
    ]);

    const draggingFourth = updateAll(example, [startDragNthTask(3)]);

    test("there is one drop target at the beginning of the list", () => {
      expect(dropTargetsAfter(draggingFourth, -1)).toEqual([{width: "full", indentation: 0}]);
    });

    test("the first item has two drop targets below it", () => {
      expect(dropTargetsAfter(draggingFourth, 0)).toEqual([
        {width: 1, indentation: 0},
        {width: "full", indentation: 1},
      ]);
    });

    test("the second item has two drop targets below it", () => {
      expect(dropTargetsAfter(draggingFourth, 1)).toEqual([
        {width: 1, indentation: 0},
        {width: "full", indentation: 1},
      ]);
    });
  });

  describe("when dragging one task into another", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 1"),
      addTask("Task 2"),
      addTask("Task 3"),
      addTask("Task 4"),
    ]);

    test("before dragging anything, neither task is indented", () => {
      expect(tasks(example, "indentation")).toEqual([0, 0, 0, 0]);
    });

    const afterDragging = updateAll(example, [...dragAndDropNth(0, 1, {side: "below", indentation: 1})]);

    const draggingFourthAfter = updateAll(afterDragging, [startDragNthTask(3)]);

    describe("after dragging the second task into the first", () => {
      test("the first task is not indented", () => {
        expect(nthTask(afterDragging, 0).indentation).toBe(0);
      });

      test("the second task is indented", () => {
        expect(nthTask(afterDragging, 1).indentation).toBe(1);
      });

      test("the drop targets after the first task are updated", () => {
        expect(dropTargetsAfter(draggingFourthAfter, 0)).toEqual([{width: "full", indentation: 1}]);
      });

      test("the drop targets for the second task are updated", () => {
        expect(dropTargetsAfter(draggingFourthAfter, 1)).toEqual([
          {width: 1, indentation: 0},
          {width: 1, indentation: 1},
          {width: "full", indentation: 2},
        ]);
      });
    });
  });

  describe("scenario where the following task is at a higher level of indentation", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 0"),
      addTask("Task 1", 1),
      addTask("Task 2", 2),
      addTask("Task 3", 1),
      addTask("Task 4"),
    ]);

    const draggingLast = updateAll(example, [startDragNthTask(4)]);

    test("tasks are indented correctly", () => {
      expect(tasks(example, "indentation")).toEqual([0, 1, 2, 1, 0]);
    });

    test("below the task above the task at a higer level of indentation, there are drop targets only at that level of indentation", () => {
      expect(dropTargetsAfter(draggingLast, 2)).toEqual([
        {width: 1, indentation: 1},
        {width: 1, indentation: 2},
        {width: "full", indentation: 3},
      ]);
    });
  });

  describe("making a task a descendant of itself is not allowed", () => {
    describe("in a list of just one task", () => {
      const example = updateAll(empty, [...switchToFilter("all"), addTask("Task 1"), startDragNthTask(0)]);

      test("there are drop targets above and below the task itself at the same level of indentation", () => {
        expect(dropTargetsAfter(example, -1)).toContainEqual({width: "full", indentation: 0});
        expect(dropTargetsAfter(example, 0)).toContainEqual({width: "full", indentation: 0});
      });

      test("there are no other drop targets", () => {
        expect(dropTargetsAfter(example, -1)).toHaveLength(1);
        expect(dropTargetsAfter(example, 0)).toHaveLength(1);
      });
    });

    describe("when dragging a subtree of tasks", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 0"),
        addTask("Task 1", 1),
        addTask("Task 2", 2),
        addTask("Task 3", 3),
        addTask("Task 4", 1),
        startDragNthTask(1),
      ]);

      test("the tasks are indented correctly", () => {
        expect(tasks(example, "indentation")).toEqual([0, 1, 2, 3, 1]);
      });

      function dropTargetsOfNthTaskAtOrAbove(state: State, n: number, indentation: number) {
        return dropTargetsAfter(state, n).filter((dropTarget) => dropTarget.indentation >= indentation);
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

  function expectNthTaskToHaveDropTargetsNearAtItself(
    state: State,
    n: number,
    dropTargets: {width: number | "full"; indentation: number}[],
  ) {
    expect(dropTargetsAfter(state, n)).toEqual(dropTargets);
    expect(dropTargetsAfter(state, n - 1)).toEqual(dropTargets);
  }

  describe("dragging a task onto itself (or direct neighbors)", () => {
    describe("in a flat list", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 0"),
        addTask("Task 1"),
        addTask("Task 2"),
        startDragNthTask(1),
      ]);

      test("the task can be dropped in the same place or indented one spot", () => {
        expectNthTaskToHaveDropTargetsNearAtItself(example, 1, [
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
            dragAndDropNth(1, testCase.drop, {side: testCase.side, indentation: 1}),
          ]);

          test("there are still three tasks in the example", () => {
            expect(tasks(afterDrop, []).length).toEqual(3);
          });

          test("they are still in the same order", () => {
            expect(tasks(afterDrop, "title")).toEqual(["Task 0", "Task 1", "Task 2"]);
          });

          test("the indentation has changed", () => {
            expect(tasks(afterDrop, "indentation")).toEqual([0, 1, 0]);
          });
        });
      });
    });

    describe("unindenting the last item in the subtree of a top-level item", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 0"),
        addTask("Task 1", 1),
        addTask("Task 2", 2),
        addTask("Task 3"),
        startDragNthTask(2),
      ]);

      test("the drop targets can be used to unindent the task", () => {
        expectNthTaskToHaveDropTargetsNearAtItself(example, 2, [
          {width: 1, indentation: 0},
          {width: 1, indentation: 1},
          {width: "full", indentation: 2},
        ]);
      });
    });

    describe("unindenting an item in-place is disallowed when it would mess with following tasks", () => {
      test("when the task has logical sibling following it, it cannot be unindented at all", () => {
        const example = updateAll(empty, [
          switchToFilter("all"),
          addTask("Task 0"),
          addTask("Task 1", 1),
          addTask("Task 2", 1),
          startDragNthTask(1),
        ]);

        expectNthTaskToHaveDropTargetsNearAtItself(example, 1, [{width: "full", indentation: 1}]);
      });

      test("even at the end of a subtree, task cannot be dragged beyong following task", () => {
        const example = updateAll(empty, [
          switchToFilter("all"),
          addTask("Task 0"),
          addTask("Task 1", 1),
          addTask("Task 2", 2),
          addTask("Task 3", 2),
          addTask("Task 4", 1),
          startDragNthTask(3),
        ]);

        expectNthTaskToHaveDropTargetsNearAtItself(example, 3, [
          {width: 1, indentation: 1},
          {width: 1, indentation: 2},
          {width: "full", indentation: 3},
        ]);
      });

      test("however, tasks that are descendants of the task being dragged are not taken into account", () => {
        const example = updateAll(empty, [
          switchToFilter("all"),
          addTask("Task 0"),
          addTask("Task 1", 1),
          addTask("Task 2", 1),
          addTask("Task 3", 2),
          addTask("Task 4"),
          startDragNthTask(2),
        ]);

        expectNthTaskToHaveDropTargetsNearAtItself(example, 2, [
          {width: 1, indentation: 0},
          {width: 1, indentation: 1},
          {width: "full", indentation: 2},
        ]);
      });
    });

    test("dragging a task below its last descendant is like dragging the item to itself except it can't be indented further", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 0"),
        addTask("Task 1", 1),
        addTask("Task 2", 1),
        addTask("Task 3", 2),
        addTask("Task 4"),
        startDragNthTask(2),
      ]);

      expect(dropTargetsAfter(example, 3)).toEqual([
        {width: 1, indentation: 0},
        {width: "full", indentation: 1},
      ]);
    });

    describe("bugs", () => {
      test("the indentation of the preceeding item would be taken into account when it shouldn't", () => {
        const example = updateAll(empty, [
          switchToFilter("all"),
          addTask("Task 0"),
          addTask("Task 1", 1),
          addTask("Task 2"),
          addTask("Task 3", 1),
          startDragNthTask(0),
        ]);

        expect(dropTargetsAfter(example, 2)).toEqual([{width: "full", indentation: 1}]);
      });
    });
  });

  describe("dragging a task out when there is an archived task below it", () => {
    describe.each([0, 1, 2])("when the archived task has indentation %d", (indentation) => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 0"),
        addTask("Task 1", 1),
        addTask("Task 2", indentation, "archive"),
        addTask("Task 3"),
        startDragNthTask(1),
      ]);

      describe("initially", () => {
        test("the tasks are indented correctly", () => {
          expect(tasks(step1, ["title", "indentation"])).toEqual([
            {title: "Task 0", indentation: 0},
            {title: "Task 1", indentation: 1},
            {title: "Task 3", indentation: 0},
          ]);
        });

        test("the task can be dropped near itself at the top level", () => {
          expectNthTaskToHaveDropTargetsNearAtItself(step1, 1, [
            {width: 1, indentation: 0},
            {width: "full", indentation: 1},
          ]);
        });
      });

      const step2 = updateAll(step1, [...dragAndDropNth(1, 2, {side: "above", indentation: 0})]);

      describe("after dropping task", () => {
        test("the task is now indented at the top level", () => {
          expect(tasks(step2, ["title", "indentation"])).toEqual([
            {title: "Task 0", indentation: 0},
            {title: "Task 1", indentation: 0},
            {title: "Task 3", indentation: 0},
          ]);
        });
      });
    });
  });

  describe("dragging a task into a parent when there is an archived task at the top-level below the parent", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 0"),
      addTask("Task 1", "archive"),
      addTask("Task 2"),
      startDragNthTask(1),
    ]);

    describe("initially", () => {
      test("the non-archived tasks are shown at the top-level", () => {
        expect(tasks(step1, ["title", "indentation"])).toEqual([
          {title: "Task 0", indentation: 0},
          {title: "Task 2", indentation: 0},
        ]);
      });

      test("the task can be dropped near itself at indentation levels 0 or 1", () => {
        expectNthTaskToHaveDropTargetsNearAtItself(step1, 1, [
          {width: 1, indentation: 0},
          {width: "full", indentation: 1},
        ]);
      });
    });

    const step2 = updateAll(step1, [...dragAndDropNth(1, 0, {side: "below", indentation: 1})]);

    describe("after dropping task", () => {
      test("the task is now indented under the parent", () => {
        expect(tasks(step2, ["title", "indentation"])).toEqual([
          {title: "Task 0", indentation: 0},
          {title: "Task 2", indentation: 1},
        ]);
      });
    });
  });

  describe("inside a project filter", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Project", "project"),
      addTask("Task 1", 1),
      addTask("Task 2", 1),
      switchToFilterCalled("Project"),
    ]);

    describe("initially", () => {
      test("the tasks are indented correctly", () => {
        expect(tasks(step1, ["title", "indentation"])).toEqual([
          {title: "Task 1", indentation: 0},
          {title: "Task 2", indentation: 0},
        ]);
      });
    });

    const step2 = updateAll(step1, [...dragAndDropNth(1, 0, {side: "below", indentation: 1})]);

    describe("after dragging second task into first task", () => {
      test("the indentation is updated", () => {
        expect(tasks(step2, ["title", "indentation"])).toEqual([
          {title: "Task 1", indentation: 0},
          {title: "Task 2", indentation: 1},
        ]);
      });
    });
  });
});

describe("drag and drop in filtered views", () => {
  describe("dragging task to first position in a project filter", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Project", "project"),
      addTask("Task 1", 1),
      addTask("Task 2", 1),
      switchToFilterCalled("Project"),
    ]);

    describe("initially", () => {
      test("the tasks are shown correctly", () => {
        expect(tasks(step1, ["title", "indentation"])).toEqual([
          {title: "Task 1", indentation: 0},
          {title: "Task 2", indentation: 0},
        ]);
      });
    });

    const step2 = updateAll(step1, [...dragAndDropNth(1, 0, {side: "above", indentation: 0})]);

    describe("after dragging second task into first position", () => {
      test("the tasks swap positions", () => {
        expect(tasks(step2, ["title", "indentation"])).toEqual([
          {title: "Task 2", indentation: 0},
          {title: "Task 1", indentation: 0},
        ]);
      });
    });
  });
});

describe("drag and drop with multiple sections shown", () => {
  describe("reordering subtasks within a section of a filtered view", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Project", "project"),
      addTask("Task 1", 1),
      addTask("Task 2", 1),
      switchToFilter({type: "section", section: "actions"}),
    ]);

    describe("initially", () => {
      test("the correct tasks are shown in each section", () => {
        expect(tasksInSection(step1, "Ready", ["title", "indentation"])).toEqual([]);
        expect(tasksInSection(step1, "Stalled", ["title", "indentation"])).toEqual([
          {title: "Project", indentation: 0},
          {title: "Task 1", indentation: 1},
          {title: "Task 2", indentation: 1},
        ]);
      });
    });

    const step2 = updateAll(step1, [...dragAndDropNth(1, 2, {side: "below", indentation: 1})]);

    describe("after dragging the first child below the second child", () => {
      test("they have switched places", () => {
        expect(tasksInSection(step2, "Stalled", ["title", "indentation"])).toEqual([
          {title: "Project", indentation: 0},
          {title: "Task 2", indentation: 1},
          {title: "Task 1", indentation: 1},
        ]);
      });
    });
  });

  describe("dragging a task from the stalled section into the ready section makes it ready", () => {
    const step1 = updateAll(empty, [
      switchToFilter({type: "section", section: "actions"}),
      addTask("Task 0", "ready"),
      addTask("Task 1"),
      addTask("Task 2"),
    ]);

    describe("initially", () => {
      test("the shown tasks are correct", () => {
        expect(tasksInSection(step1, "Ready", "title")).toEqual(["Task 0"]);
        expect(tasksInSection(step1, "Stalled", "title")).toEqual(["Task 1", "Task 2"]);
      });
    });

    const step2 = updateAll(step1, [...dragAndDropNth(1, 0, {side: "below", indentation: 0})]);

    describe("the dragged task is moved to the new section", () => {
      test("the shown tasks are correct", () => {
        expect(tasksInSection(step2, "Ready", "title")).toEqual(["Task 0", "Task 1"]);
        expect(tasksInSection(step2, "Stalled", "title")).toEqual(["Task 2"]);
      });
    });
  });

  describe("drop indicator when dragging task into first position in section", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 0", "ready"),
      addTask("Task 1"),
      switchToFilter({type: "section", section: "actions"}),
    ]);

    describe("initially", () => {
      test("the tasks are in the correct sections", () => {
        expect(tasksInSection(step1, "Ready", "title")).toEqual(["Task 0"]);
        expect(tasksInSection(step1, "Stalled", "title")).toEqual(["Task 1"]);
      });

      test("there is no drop indicator anywhere", () => {
        expect(
          view(step1)
            .taskList.flatMap((section) => section.rows)
            .filter((row) => row.type === "dropIndicator"),
        ).toEqual([]);
      });
    });

    const step2 = updateAll(step1, [startDragNthTask(1), hoverNth(0, {side: "above", indentation: 0})]);

    describe("after hovering over first position in second list", () => {
      test("there is exactly one drop indicator", () => {
        expect(
          view(step2)
            .taskList.flatMap((section) => section.rows)
            .filter((row) => row.type === "dropIndicator"),
        ).toHaveLength(1);
      });
    });
  });

  describe("when the same task is shown in multiple sections", () => {
    describe("a task planned today that is also ready or stalled", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 0"),
        addTask("Task 1"),
        dragToTab(0, "Today"),
        dragToTab(0, "Ready"),
        switchToFilter({type: "section", section: "actions"}),
      ]);

      describe("initially", () => {
        test("the example is set up as expected", () => {
          expect(tasksInSection(example, "Today", "title")).toEqual(["Task 0"]);
          expect(tasksInSection(example, "Ready", "title")).toEqual(["Task 0"]);
          expect(tasksInSection(example, "Stalled", "title")).toEqual(["Task 1"]);
        });
      });

      describe("dragging ready task", () => {
        describe.each([
          {section: "today", i: 0},
          {section: "ready", i: 1},
        ])("from $section section", ({i}) => {
          describe("into today section", () => {
            const step1 = updateAll(example, [...dragAndDropNth(i, 0, {side: "below", indentation: 0})]);

            test("changes nothing", () => {
              expect(tasksInSection(step1, "Today", "title")).toEqual(["Task 0"]);
              expect(tasksInSection(step1, "Ready", "title")).toEqual(["Task 0"]);
              expect(tasksInSection(step1, "Stalled", "title")).toEqual(["Task 1"]);
            });
          });

          describe("into ready section", () => {
            const step1 = updateAll(example, [...dragAndDropNth(i, 1, {side: "below", indentation: 0})]);

            test("changes nothing", () => {
              expect(tasksInSection(step1, "Today", "title")).toEqual(["Task 0"]);
              expect(tasksInSection(step1, "Ready", "title")).toEqual(["Task 0"]);
              expect(tasksInSection(step1, "Stalled", "title")).toEqual(["Task 1"]);
            });
          });

          describe("into stalled section", () => {
            const step1 = updateAll(example, [...dragAndDropNth(i, 2, {side: "below", indentation: 0})]);

            test("moves it to the stalled section", () => {
              expect(tasksInSection(step1, "Today", "title")).toEqual(["Task 0"]);
              expect(tasksInSection(step1, "Ready", "title")).toEqual([]);
              expect(tasksInSection(step1, "Stalled", "title")).toEqual(["Task 1", "Task 0"]);
            });
          });
        });
      });
    });
  });
});

describe("a task that has an unfinished child task isn't stalled", () => {
  describe("when there is a parent with one child task", () => {
    const example = updateAll(empty, [
      {tag: "selectFilter", filter: "all"},
      addTask("Parent"),
      addTask("Child", 1),
    ]);

    const childFinished = updateAll(example, [...check(view(example), 1)]);

    describe("when the child has not been marked as done", () => {
      test("the child is unfinished", () => {
        expect(nthTask(example, 1).done).toBe(false);
      });

      test("the child is stalled", () => {
        expect(nthTask(example, 1).badges).toEqual([bStalled]);
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
        expect(nthTask(childFinished, 0).badges).toEqual([bStalled]);
      });
    });
  });
});

describe("an action that has unfinished children isn't ready", () => {
  describe("when there is a parent action with one child action", () => {
    const example = updateAll(empty, [
      {tag: "selectFilter", filter: "all"},
      addTask("Parent", "ready"),
      addTask("Child", 1, "ready"),
    ]);

    const childFinished = updateAll(example, [...check(view(example), 1)]);

    describe("when the child has not been marked as done", () => {
      test("the child is unfinished", () => {
        expect(nthTask(example, 1).done).toBe(false);
      });

      test("the child is ready", () => {
        expect(nthTask(example, 1).badges).toEqual([bReady]);
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
        expect(nthTask(childFinished, 0).badges).toEqual([bReady]);
      });
    });
  });
});

describe("dragging a subtree of tasks", () => {
  const example = updateAll(empty, [
    switchToFilter("all"),
    addTask("Task 0"),
    addTask("Task 1", 1),
    addTask("Task 2"),
  ]);

  describe("initially", () => {
    test("the example has three tasks", () => {
      expect(tasks(example, []).length).toBe(3);
    });

    test("the example has tasks in the correct order", () => {
      expect(tasks(example, "title")).toEqual(["Task 0", "Task 1", "Task 2"]);
    });

    test("the example is indented correctly", () => {
      expect(tasks(example, "indentation")).toEqual([0, 1, 0]);
    });
  });

  const afterDragging = updateAll(example, [...dragAndDropNth(0, 2, {side: "below", indentation: 1})]);

  describe("after dragging the subtree into another task", () => {
    test("there are still three tasks", () => {
      expect(tasks(afterDragging, []).length).toBe(3);
    });

    test("the tasks have changed order", () => {
      expect(tasks(afterDragging, "title")).toEqual(["Task 2", "Task 0", "Task 1"]);
    });

    test("the tasks have changed indentation", () => {
      expect(tasks(afterDragging, "indentation")).toEqual([0, 1, 2]);
    });
  });
});

describe("filtered views of tasks", () => {
  describe("the completed view includes the hierarchy of completed tasks, but not their subtasks", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 0"),
      addTask("Task 1", 1, "done"),
      addTask("Task 2", 2),
      switchToFilter("done"),
    ]);

    test("the correct tasks are shown", () => {
      expect(tasks(example, ["title", "indentation", "done"])).toEqual([
        {title: "Task 0", indentation: 0, done: false},
        {title: "Task 1", indentation: 1, done: true},
      ]);
    });
  });

  describe("the paused filter shows paused tasks and their parents, and subtasks of paused tasks are automatically paused", () => {
    const example = updateAll(empty, [
      ...switchToFilter("all"),
      addTask("Task 0"),
      addTask("Task 1", 1, "paused"),
      addTask("Task 2", 2),
      addTask("Task 3"),
      switchToFilter("paused"),
    ]);

    test("the correct tasks are shown in this example", () => {
      expect(tasks(example, ["title", "indentation", "paused"])).toEqual([
        {title: "Task 0", indentation: 0, paused: false},
        {title: "Task 1", indentation: 1, paused: true},
        {title: "Task 2", indentation: 2, paused: true},
      ]);
    });
  });
});

describe("section filters", () => {
  describe("setting a section filter makes all filters in that section active", () => {
    function filtersInSection(view: View | State, sectionTitle: string): {label: string; selected: boolean}[] {
      return viewed(view)
        .sideBar.filter((section) => section.title === sectionTitle)
        .flatMap((section) => section.filters)
        .map((filter) => select(filter, ["label", "selected"]));
    }

    describe("for actions section", () => {
      const step1 = updateAll(empty, []);

      describe("initially", () => {
        test("only the 'ready' filter is active", () => {
          expect(filtersInSection(step1, "Actions")).toEqual([
            {label: "Today", selected: false},
            {label: "Ready", selected: true},
            {label: "Stalled", selected: false},
          ]);
        });
      });

      const step2 = updateAll(step1, [{tag: "selectFilter", filter: {type: "section", section: "actions"}}]);

      describe("after selecting the actions section filter", () => {
        test("all filters in the 'actions' section become active", () => {
          expect(filtersInSection(step2, "Actions")).toEqual([
            {label: "Today", selected: true},
            {label: "Ready", selected: true},
            {label: "Stalled", selected: true},
          ]);
        });
      });
    });

    describe("for the tasks section", () => {
      const step1 = updateAll(empty, []);

      describe("initially", () => {
        test("no filters are active", () => {
          expect(filtersInSection(step1, "Tasks")).toEqual([
            {label: "Waiting", selected: false},
            {label: "Paused", selected: false},
            {label: "All", selected: false},
            {label: "Unfinished", selected: false},
            {label: "Completed", selected: false},
          ]);
        });
      });

      const step2 = updateAll(step1, [{tag: "selectFilter", filter: {type: "section", section: "tasks"}}]);

      describe("after selecting the tasks section filter", () => {
        test("all filters in the 'tasks' section become active", () => {
          expect(filtersInSection(step2, "Tasks")).toEqual([
            {label: "Waiting", selected: true},
            {label: "Paused", selected: true},
            {label: "All", selected: true},
            {label: "Unfinished", selected: true},
            {label: "Completed", selected: true},
          ]);
        });
      });
    });

    describe("for the active project section", () => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Project 0", "project"),
        addTask("Project 1", "project"),
      ]);

      describe("initially", () => {
        test("no filters in the active project section are selected", () => {
          expect(filtersInSection(step1, "Active projects")).toEqual([
            {label: "Project 0", selected: false},
            {label: "Project 1", selected: false},
          ]);
        });
      });

      const step2 = updateAll(step1, [
        {tag: "selectFilter", filter: {type: "section", section: "activeProjects"}},
      ]);

      describe("after selecting the active project section filter", () => {
        test("all filters in the 'active project' section become active", () => {
          expect(filtersInSection(step2, "Active projects")).toEqual([
            {label: "Project 0", selected: true},
            {label: "Project 1", selected: true},
          ]);
        });
      });
    });
  });

  describe("the section filter shows tasks in its subfilters, with headings above each list", () => {
    describe("actions filter", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Ready 1", "ready", "today"),
        addTask("Ready 2", "ready"),
        addTask("Stalled 1"),
        addTask("Stalled 2"),
        switchToFilter({type: "section", section: "actions"}),
      ]);

      const taskListHeadings = (view: View | State) => viewed(view).taskList.map((section) => section.title);

      test("has sections titled 'Today', 'Ready' and 'Stalled'", () => {
        expect(taskListHeadings(example)).toEqual(["Today", "Ready", "Stalled"]);
      });

      test("the 'Today' section has the task that are planned today", () => {
        expect(tasksInSection(example, "Today", "title")).toEqual(["Ready 1"]);
      });

      test("the 'Ready' section has the two tasks that are ready", () => {
        expect(tasksInSection(example, "Ready", "title")).toEqual(["Ready 1", "Ready 2"]);
      });

      test("the 'Stalled' section has the two tasks that are stalled", () => {
        expect(tasksInSection(example, "Stalled", "title")).toEqual(["Stalled 1", "Stalled 2"]);
      });
    });
  });
});

function componentTitled(view: View | State, title: string) {
  function groups(view: View) {
    return view.editor?.sections.flatMap((section) => section) ?? [];
  }

  return groups(viewed(view)).find((group) => group.title === title)?.components[0] ?? null;
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
    const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Task")]);

    describe("initially", () => {
      test("the example task is shown in the task list", () => {
        expect(tasks(step1, "title")).toEqual(["Task"]);
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
        expect(componentTitled(step2, "Title")).not.toBeNull();
      });

      test("the component contains the task title", () => {
        expect(componentTitled(step2, "Title")).toMatchObject({type: "text", value: "Task"});
      });
    });

    const step3 = updateAll(step2, [setComponentValue("Title", "Task with edited title")]);

    describe("after editing title in the editor", () => {
      test("the title component contains the new title", () => {
        expect(componentTitled(step3, "Title")).toMatchObject({
          type: "text",
          value: "Task with edited title",
        });
      });

      test("the task in the task list has the new title", () => {
        expect(tasks(step3, "title")).toEqual(["Task with edited title"]);
      });
    });
  });

  describe("setting task status", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Task"), openNth(0)]);

    describe("initially", () => {
      test("the example task is not checked in the task list", () => {
        expect(tasks(step1, "done")).toEqual([false]);
      });

      test("there is a component titled 'Status'", () => {
        expect(componentTitled(step1, "Status")).not.toBeNull();
      });

      test("it is a picker component", () => {
        expect(componentTitled(step1, "Status")).toMatchObject({type: "picker"});
      });

      test("it has the correct options", () => {
        expect(pickerOptions(step1, "Status")).toEqual(["active", "paused", "done"]);
      });

      test("the selected option is 'Active'", () => {
        expect(pickerValue(step1, "Status")).toEqual("active");
      });
    });

    const step2a = updateAll(step1, [...check(view(step1), 0)]);

    describe("if the task is checked in the task list", () => {
      test("the task is marked as done in the task list", () => {
        expect(tasks(step2a, "done")).toEqual([true]);
      });

      test("the selected status option is changed", () => {
        expect(pickerValue(step2a, "Status")).toEqual("done");
      });
    });

    const step2b = updateAll(step1, [setComponentValue("Status", "done")]);

    describe("if the task status is changed in the editor instead", () => {
      test("the task is marked as done in the task list", () => {
        expect(tasks(step2b, "done")).toEqual([true]);
      });

      test("the selected status option is changed", () => {
        expect(pickerValue(step2b, "Status")).toEqual("done");
      });
    });
  });

  describe("marking tasks as action", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Task"), openNth(0)]);

    describe("initially", () => {
      test("the example task has the stalled badge in the task list", () => {
        expect(tasks(step1, "badges")).toEqual([[bStalled]]);
      });

      test("there is a component titled 'Actionable'", () => {
        expect(componentTitled(step1, "Actionable")).not.toBeNull();
      });

      test("it is a picker component", () => {
        expect(componentTitled(step1, "Actionable")).toMatchObject({type: "picker"});
      });

      test("it has the correct options", () => {
        expect(pickerOptions(step1, "Actionable")).toEqual(["yes", "no"]);
      });

      test("the selected option is 'Not Ready'", () => {
        expect(pickerValue(step1, "Actionable")).toEqual("no");
      });
    });

    const step2 = updateAll(step1, [dragToFilter(0, "ready")]);

    describe("after dragging the task into the ready filter", () => {
      test("the task has the ready badge in the task list", () => {
        expect(tasks(step2, "badges")).toEqual([[bReady]]);
      });

      test("the selected option becomes 'Ready'", () => {
        expect(pickerValue(step2, "Actionable")).toEqual("yes");
      });
    });

    const step3 = updateAll(step2, [setComponentValue("Actionable", "no")]);

    describe("after changing the task status back in the editor", () => {
      test("the task reverts to the stalled badge", () => {
        expect(tasks(step3, "badges")).toEqual([[bStalled]]);
      });

      test("the selected option becomes 'Not Ready' again", () => {
        expect(pickerValue(step3, "Actionable")).toEqual("no");
      });
    });
  });
});

describe("paused tasks", () => {
  describe("in an example with a single stalled task", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Task"), openNth(0)]);

    describe("initially", () => {
      test("the task has the stalled badge", () => {
        expect(tasks(step1, "badges")).toEqual([[bStalled]]);
      });

      test("the task is not paused", () => {
        expect(tasks(step1, "paused")).toEqual([false]);
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Status", "paused")]);

    describe("after changing the task status to paused in the editor", () => {
      test("the task loses its badges", () => {
        expect(tasks(step2, "badges")).toEqual([[]]);
      });

      test("the task is paused", () => {
        expect(tasks(step2, "paused")).toEqual([true]);
      });
    });
  });

  describe("in an example with a child task", () => {
    const step1 = updateAll(empty, [switchToFilter("all"), addTask("Parent"), addTask("Child", 1), openNth(0)]);

    describe("initially", () => {
      test("neither the parent nor the child is paused", () => {
        expect(tasks(step1, "paused")).toEqual([false, false]);
      });

      test("the child has the stalled badge", () => {
        expect(tasks(step1, "badges")).toEqual([[], [bStalled]]);
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Status", "paused")]);

    describe("after changing the parent's task status to paused in the editor", () => {
      test("both the parent and the child are paused", () => {
        expect(tasks(step2, "paused")).toEqual([true, true]);
      });

      test("neither task has any badges", () => {
        expect(tasks(step2, "badges")).toEqual([[], []]);
      });
    });

    const step3 = updateAll(step2, [...switchToFilter("stalled")]);

    describe("after switching to the stalled filter", () => {
      test("the task list is empty", () => {
        expect(tasks(step3, [])).toEqual([]);
      });
    });
  });

  describe("when paused tasks are children of non-paused parents", () => {
    describe("paused children prevents otherwise actionable parent from being ready", () => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Parent"),
        addTask("Child", 1),
        openNth(0),
        setComponentValue("Actionable", "yes"),
        openNth(1),
        setComponentValue("Status", "paused"),
      ]);

      describe("when child is paused", () => {
        test("parent is stalled", () => {
          expect(tasks(step1, "badges")).toEqual([[bStalled], []]);
        });

        test("child is paused", () => {
          expect(tasks(step1, "paused")).toEqual([false, true]);
        });
      });

      const step2 = updateAll(step1, [...check(view(step1), 1)]);

      describe("after marking child as done", () => {
        test("parent becomes ready", () => {
          expect(tasks(step2, "badges")).toEqual([[bReady], []]);
        });

        test("child is not paused", () => {
          expect(tasks(step2, "paused")).toEqual([false, false]);
        });
      });
    });

    describe("task that would be stalled without paused child is still stalled", () => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Parent"),
        addTask("Child", 1),
        openNth(1),
        setComponentValue("Status", "paused"),
      ]);

      describe("when child is paused", () => {
        test("parent is stalled", () => {
          expect(tasks(step1, "badges")).toEqual([[bStalled], []]);
        });

        test("child is paused", () => {
          expect(tasks(step1, "paused")).toEqual([false, true]);
        });
      });

      const step2 = updateAll(step1, [...check(view(step1), 1)]);

      describe("after marking child as done", () => {
        test("parent is still stalled", () => {
          expect(tasks(step2, "badges")).toEqual([[bStalled], []]);
        });

        test("child is not paused", () => {
          expect(tasks(step2, "paused")).toEqual([false, false]);
        });
      });
    });
  });
});

describe("the stalled filter", () => {
  describe("its counter", () => {
    describe("the counter shows stalled tasks", () => {
      const step1 = updateAll(empty, []);

      test("with no tasks, the counter isn't shown", () => {
        expect(indicatorForFilter(view(step1), "Stalled")).toEqual(null);
      });

      const step2 = updateAll(empty, [...switchToFilter("all"), addTask("Task")]);

      test("after adding task, the counter is shown", () => {
        expect(indicatorForFilter(view(step2), "Stalled")).toEqual({type: "text", text: "1", color: "orange"});
      });

      const step3 = updateAll(step2, [dragToFilter(0, "ready")]);

      test("after dragging task into ready filter, the counter is hidden again", () => {
        expect(indicatorForFilter(view(step3), "Stalled")).toEqual(null);
      });
    });

    describe("subtasks are included", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Project", "project"),
        addTask("Task 1", 1),
        switchToFilter("stalled"),
      ]);

      test("there is a stalled subtask", () => {
        expect(tasks(example, ["title", "indentation", "badges"])).toEqual([
          {
            title: "Project",
            indentation: 0,
            badges: [bProject, bStalled],
          },
          {title: "Task 1", indentation: 1, badges: [bStalled]},
        ]);
      });

      test("but the counter indicates two tasks", () => {
        expect(indicatorForFilter(view(example), "Stalled")).toEqual({type: "text", text: "2", color: "orange"});
      });
    });

    describe("when a parent of stalled subtask is shown, only the subtask is counted", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 0"),
        addTask("Task 1", 1),
        addTask("Task 2"),
        switchToFilter("stalled"),
      ]);

      test("in the example, there are three tasks shown in the view", () => {
        expect(tasks(example, ["title", "indentation", "badges"])).toEqual([
          {title: "Task 0", indentation: 0, badges: []},
          {title: "Task 1", indentation: 1, badges: [bStalled]},
          {title: "Task 2", indentation: 0, badges: [bStalled]},
        ]);
      });

      test("yet only two are counted", () => {
        expect(indicatorForFilter(view(example), "Stalled")).toEqual({type: "text", text: "2", color: "orange"});
      });
    });
  });

  describe("projects and their stalled subtasks are shown, but not non-stalled subtasks", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Project", "project"),
      addTask("Task 1", 1, "paused"),
      addTask("Task 2", 1, "done"),
      addTask("Task 3", 1),
      addTask("Task 4", 2),
      switchToFilter("stalled"),
    ]);

    test("the correct tasks are shown", () => {
      expect(tasks(example, ["title", "indentation", "badges"])).toEqual([
        {
          title: "Project",
          indentation: 0,
          badges: [bProject, bStalled],
        },
        {title: "Task 3", indentation: 1, badges: []},
        {title: "Task 4", indentation: 2, badges: [bStalled]},
      ]);
    });
  });

  describe("stalled subprojects of ready superproject are still grouped under that superproject", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Project 0", "project"),
      addTask("Task 1", 1, "ready"),
      addTask("Project 2", 1, "project"),
      addTask("Task 3", 2),
    ]);

    const step2 = updateAll(step1, [switchToFilter("ready")]);
    const step3 = updateAll(step2, [switchToFilter("stalled")]);

    test("the ready page shows the ready superproject and its ready task", () => {
      expect(tasks(step2, ["title", "indentation", "badges"])).toEqual([
        {
          title: "Project 0",
          indentation: 0,
          badges: [bProject, bReady],
        },
        {title: "Task 1", indentation: 1, badges: [bReady]},
      ]);
    });

    test("the stalled page shows the ready superproject and its stalled subproject and subtask", () => {
      expect(tasks(step3, ["title", "indentation", "badges"])).toEqual([
        {
          title: "Project 0",
          indentation: 0,
          badges: [bProject, bReady],
        },
        {
          title: "Project 2",
          indentation: 1,
          badges: [bProject, bStalled],
        },
        {title: "Task 3", indentation: 2, badges: [bStalled]},
      ]);
    });
  });

  describe("parents of stalled tasks are included, but not non-stalled siblings", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 0"),
      addTask("Task 1", 1),
      addTask("Task 2", 1),
      addTask("Task 3", 2, "ready"),
      addTask("Task 4", 1),
      switchToFilter("stalled"),
    ]);

    test("the correct tasks are shown in the example", () => {
      expect(tasks(example, ["title", "indentation", "badges"])).toEqual([
        {title: "Task 0", indentation: 0, badges: []},
        {title: "Task 1", indentation: 1, badges: [bStalled]},
        {title: "Task 4", indentation: 1, badges: [bStalled]},
      ]);
    });
  });
});

describe("the indicator for the ready filter", () => {
  const step1 = updateAll(empty, []);

  test("with no tasks, the counter isn't shown", () => {
    expect(indicatorForFilter(view(step1), "Ready")).toEqual(null);
  });

  const step2 = updateAll(empty, [...switchToFilter("all"), addTask("Task"), dragToTab(0, "Ready")]);

  test("after adding task, the counter is shown", () => {
    expect(indicatorForFilter(view(step2), "Ready")).toEqual({type: "text", text: "1", color: "green"});
  });
});

describe("projects", () => {
  describe("marking a task as a project in the task list updates type", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Project"), openNth(0)]);

    describe("initially", () => {
      test("the task has type task in editor", () => {
        expect(pickerValue(view(step1), "Type")).toEqual("task");
      });

      test("the task is not a project in task list", () => {
        expect(tasks(step1, "project")).toEqual([false]);
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Type", "project")]);

    describe("after changing the type to project", () => {
      test("the task has type project in editor", () => {
        expect(pickerValue(view(step2), "Type")).toEqual("project");
      });

      test("the task is a project in task list", () => {
        expect(tasks(step2, "project")).toEqual([true]);
      });
    });
  });

  describe("projects cannot be marked as actionable", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Project"),
      openNth(0),
      setComponentValue("Actionable", "yes"),
    ]);

    describe("before marking an action as a project", () => {
      test("there is a component in the editor called 'Actionable'", () => {
        expect(componentTitled(step1, "Actionable")).not.toBeNull();
      });

      test("the task has the ready badge", () => {
        expect(tasks(step1, "badges")).toEqual([[bReady]]);
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Type", "project")]);

    describe("after marking a task as a project", () => {
      test("there is no component in the editor called 'Actionable'", () => {
        expect(componentTitled(step2, "Actionable")).toBeNull();
      });

      test("the project has the stalled badge", () => {
        expect(tasks(step2, "badges")).toEqual([[bProject, bStalled]]);
      });
    });
  });

  describe("a project is stalled if it has only non-actionable tasks", () => {
    test("a project with an actionable subtask is not stalled", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Project", "project"),
        addTask("Task 1", 1),
        addTask("Task 2", 2, "ready"),
        addTask("Task 3", 1),
      ]);

      expect(tasks(example, "badges")).toEqual([[bProject, bReady], [], [bReady], [bStalled]]);
    });

    test("a project with only a stalled subtask is itself also stalled", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Project", "project"),
        addTask("Task 1", 1),
      ]);

      expect(tasks(example, "badges")).toEqual([[bProject, bStalled], [bStalled]]);
    });

    test("however, project isn't stalled if it's paused", () => {
      const example = updateAll(empty, [switchToFilter("all"), addTask("Project", "project", "paused")]);

      expect(tasks(example, "badges")).toEqual([[bProject]]);
    });
  });

  describe("a project is ready if it has a ready subtask", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Project", "project"),
      addTask("Task 1", 1),
      addTask("Task 2", 2, "ready"),
      addTask("Task 3", 1),
    ]);

    test("the project shows up in the ready filter", () => {
      const step2 = updateAll(example, [...switchToFilter("ready")]);

      expect(tasks(step2, ["title", "indentation", "badges"])).toEqual([
        {
          title: "Project",
          indentation: 0,
          badges: [bProject, bReady],
        },
        {title: "Task 1", indentation: 1, badges: []},
        {title: "Task 2", indentation: 2, badges: [bReady]},
      ]);
    });
  });

  describe("list of projects in the sidebar", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Project"), openNth(0)]);

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
        expect(tasks(step3a, "project")).toEqual([true]);
      });
    });

    const step3b = updateAll(step2, [setComponentValue("Status", "done")]);

    describe("after marking the project as done", () => {
      test("the sidebar becomes empty again", () => {
        expect(sideBarActiveProjects(view(step3b))).toEqual([]);
      });

      test("but the item is still shown as a project in the task list", () => {
        expect(tasks(step3b, "project")).toEqual([true]);
      });
    });
  });

  describe("stalled projects have indicators in sidebar", () => {
    const step1 = updateAll(empty, [switchToFilter("all"), addTask("Project", "project")]);

    test("stalled project has indicator in sidebar", () => {
      expect(sideBarActiveProjects(view(step1))[0]).toMatchObject({
        label: "Project",
        indicator: {type: "dot"},
      });
    });

    const step2 = updateAll(step1, [
      addTask("Action"),
      openNth(1),
      setComponentValue("Actionable", "yes"),
      dragAndDropNth(1, 0, {side: "below", indentation: 1}),
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
      switchToFilter("all"),
      addTask("Example project", "project"),
      addTask("Inside project", 1),
      addTask("Outside project"),
    ]);

    describe("in the 'all' filter", () => {
      test("there are three tasks", () => {
        expect(tasks(step1, []).length).toEqual(3);
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

    const projectFilter = sideBarActiveProjects(view(step1))[0]?.filter!;
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
        expect(tasks(step2, []).length).toEqual(1);
      });
    });
  });
});

describe("active projects section in sidebar", () => {
  describe("nested projects are hidden until parent is selected", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Project 0", "project"),
      addTask("Project 1", "project", 1),
      addTask("Project 2", "project", 2),
      addTask("Task 3", 3, "ready"),
      addTask("Project 4", "project"),
      addTask("Project 5", "project", 1),
      addTask("Task 6", 2, "ready"),
    ]);

    describe("initially", () => {
      test("the active projects section contains the two top-level projects", () => {
        expect(sideBarActiveProjects(view(example)).map((p) => p.label)).toEqual(["Project 0", "Project 4"]);
      });

      test("the project with nested subprojects has a counter", () => {
        expect(sideBarActiveProjects(view(example)).map((p) => p.indicator)).toEqual([
          {type: "text", color: "project", text: "2"},
          {type: "text", color: "project", text: "1"},
        ]);
      });
    });

    const step1 = updateAll(example, [switchToFilterCalled("Project 0")]);

    describe("after switching to top-level project", () => {
      test("the active projects section remains the same", () => {
        expect(sideBarActiveProjects(view(step1)).map((p) => p.label)).toEqual(["Project 0", "Project 4"]);
      });

      const section = view(step1).sideBar.find((section) => section.title === "Project 0");

      test("the superproject is marked as selected", () => {
        expect(
          view(step1)
            .sideBar.flatMap((section) => section.filters)
            .find((filter) => filter.label === "Project 0")?.selected,
        ).toBe(true);
      });

      test("but a new section is added, with the same title as the superproject", () => {
        expect(section).not.toBeUndefined();
      });

      test("the subprojects are shown in the new section", () => {
        expect(section?.filters?.map((filter) => filter.label)).toEqual(["Project 1", "Project 2"]);
      });
    });

    const step2 = updateAll(step1, [switchToFilterCalled("Project 1")]);

    describe("after switching to subproject", () => {
      test("the same subprojects are included in the sidebar", () => {
        expect(sideBarActiveProjects(view(step2)).map((p) => p.label)).toEqual(["Project 0", "Project 4"]);
      });

      const section = view(step2).sideBar.find((section) => section.title === "Project 0");

      test("the section still lists the subprojects", () => {
        expect(section?.filters?.map((filter) => filter.label)).toEqual(["Project 1", "Project 2"]);
      });

      test("the superproject is no longer marked selected", () => {
        expect(
          view(step2)
            .sideBar.flatMap((section) => section.filters)
            .find((filter) => filter.label === "Project 0")?.selected,
        ).toBe(false);
      });

      test("the subproject is now selected", () => {
        expect(
          view(step2)
            .sideBar.flatMap((section) => section.filters)
            .find((filter) => filter.label === "Project 1")?.selected,
        ).toBe(true);
      });
    });
  });

  describe("when selecting project without non-archived subprojects, no section is shown", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Project 0", "project"),
      addTask("Project 1", "project", 1, "archive"),
      addTask("Task 2", 1, "ready"),
    ]);

    const step1 = updateAll(example, [switchToFilterCalled("Project 0")]);

    test("the project is selected in the active projects section", () => {
      expect(sideBarActiveProjects(view(step1)).map((p) => ({label: p.label, selected: p.selected}))).toEqual([
        {label: "Project 0", selected: true},
      ]);
    });

    test("the project has no indicators in the active projects section", () => {
      expect(sideBarActiveProjects(view(step1)).map((p) => p.indicator)).toEqual([null]);
    });

    test("there is no section with the same title as the project", () => {
      expect(view(step1).sideBar.find((section) => section.title === "Project 0")).toBeUndefined();
    });
  });

  describe("selecting the project section again doesn't do anything", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Project 0", "project"),
      addTask("Project 1", "project", 1),
      addTask("Task 2", 1, "ready"),
      switchToFilterCalled("Project 0"),
    ]);

    const step2 = updateAll(step1, [
      switchToFilter(view(step1).sideBar.find((section) => section.title === "Project 0")?.filter!),
    ]);

    test("after selecting project, the correct tasks are shown", () => {
      expect(tasks(step1, "title")).toEqual(["Project 1", "Task 2"]);
    });

    test("after selecting project header again, the same tasks are shown", () => {
      expect(tasks(step2, "title")).toEqual(["Project 1", "Task 2"]);
    });
  });
});

describe("archiving tasks", () => {
  function archive(n: number) {
    return dragToFilter(n, "archive");
  }

  describe("when the archived task is a subtask", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 1"),
      addTask("Task 2", 1),
      addTask("Task 3", 1),
    ]);

    test("initially all tasks are shown in the view", () => {
      expect(tasks(step1, ["title", "indentation"])).toEqual([
        {title: "Task 1", indentation: 0},
        {title: "Task 2", indentation: 1},
        {title: "Task 3", indentation: 1},
      ]);
    });

    const step2 = updateAll(step1, [archive(1)]);

    test("after archiving, the subtask is removed from the main view", () => {
      expect(tasks(step2, ["title", "indentation"])).toEqual([
        {title: "Task 1", indentation: 0},
        {title: "Task 3", indentation: 1},
      ]);
    });

    const step3 = updateAll(step2, [...switchToFilter("archive")]);

    test("switching to the archive view shows the archived task and its parent", () => {
      expect(tasks(step3, ["title", "indentation", "archived"])).toEqual([
        {title: "Task 1", indentation: 0, archived: false},
        {title: "Task 2", indentation: 1, archived: true},
      ]);
    });

    const step4 = updateAll(step3, [dragToFilter(1, "all"), ...switchToFilter("all")]);

    test("after unarchiving the task, it is restored to the original location in the main view", () => {
      expect(tasks(step4, ["title", "indentation"])).toEqual([
        {title: "Task 1", indentation: 0},
        {title: "Task 2", indentation: 1},
        {title: "Task 3", indentation: 1},
      ]);
    });
  });

  describe("archiving project removes it from active projects list", () => {
    const step1 = updateAll(empty, [switchToFilter("all"), addTask("Project", "project")]);

    test("initially the project is shown in the sidebar", () => {
      expect(sideBarActiveProjects(view(step1)).map(({label}) => ({label}))).toEqual([{label: "Project"}]);
    });

    const step2 = updateAll(step1, [archive(0)]);

    test("after archiving, the project is removed from the sidebar", () => {
      expect(sideBarActiveProjects(view(step2))).toEqual([]);
    });
  });

  describe("children of archived tasks are also archived", () => {
    const step1 = updateAll(empty, [switchToFilter("all"), addTask("Task 1"), addTask("Task 2", 1)]);

    describe("before archiving tasks", () => {
      test("the tasks are shown in the all view", () => {
        expect(tasks(step1, ["title", "indentation", "archived"])).toEqual([
          {title: "Task 1", indentation: 0, archived: false},
          {title: "Task 2", indentation: 1, archived: false},
        ]);
      });

      const step1Archive = updateAll(step1, [...switchToFilter("archive")]);

      test("the tasks are not shown in the archive view", () => {
        expect(tasks(step1Archive, ["title", "indentation"])).toEqual([]);
      });
    });

    const step2 = updateAll(step1, [archive(0)]);

    describe("after archiving tasks", () => {
      test("the tasks are not shown in the all view", () => {
        expect(tasks(step2, ["title", "indentation"])).toEqual([]);
      });

      const step2Archive = updateAll(step2, [...switchToFilter("archive")]);

      test("the tasks are shown in the archive view, paused", () => {
        expect(tasks(step2Archive, ["title", "indentation", "archived"])).toEqual([
          {title: "Task 1", indentation: 0, archived: true},
          {title: "Task 2", indentation: 1, archived: true},
        ]);
      });
    });
  });

  describe("when child task is archived, the parent becomes stalled again", () => {
    const step1 = updateAll(empty, [switchToFilter("all"), addTask("Task 1"), addTask("Task 2", 1)]);

    test("initially, the child task is stalled, and the parent is not", () => {
      expect(tasks(step1, "badges")).toEqual([[], [bStalled]]);
    });

    const step2 = updateAll(step1, [archive(1)]);

    test("after archiving the child task, the parent becomes stalled", () => {
      expect(tasks(step2, "badges")).toEqual([[bStalled]]);
    });
  });
});

describe("saving and loading files", () => {
  describe("the controls for managing files", () => {
    test("in the default view, there are separate 'Save' and 'Load' buttons", () => {
      const example = updateAll(empty, []);
      expect(view(example).fileControls).toEqual("saveLoad");
    });
  });

  describe("loading a file from an empty state replaces the current state", () => {
    const [step1, step1e] = stateAndEffectsAfter(empty, [{tag: "storage", type: "clickLoadButton"}]);

    test("clicking load button triggers a file upload effect", () => {
      expect(step1e).toEqual([{type: "fileUpload"}]);
    });

    const step2 = updateAll(step1, [
      {
        tag: "storage",
        type: "loadFile",
        name: "tasks.json",
        contents: `[{"id":"0","title":"Task 1","done":false,"action":true},{"id":"1","title":"Task 2","done":true,"action":false}]`,
      },
      switchToFilter("all"),
    ]);

    test("two tasks are loaded", () => {
      expect(tasks(step2, []).length).toEqual(2);
    });

    test("their statuses are loaded correctly", () => {
      expect(tasks(step2, "done")).toEqual([false, true]);
    });

    test("the tasks have the correct badges", () => {
      expect(tasks(step2, "badges")).toEqual([[bReady], []]);
    });
  });

  describe("saving and then loading a file gives the same result", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 1"),
      addTask("Task 2", 1),
      addTask("Task 3", 1),
    ]);

    const [step2, step2Effects] = stateAndEffectsAfter(step1, [{tag: "storage", type: "clickSaveButton"}]);

    test("clicking save button triggers a file download effect", () => {
      expect(step2Effects[0]).toMatchObject({type: "fileDownload", name: "tasks.json"});
    });

    const fileContents = (step2Effects[0] as Effect & {type: "fileDownload"}).contents;

    const [step3, step3Effects] = stateAndEffectsAfter(step2, [{tag: "storage", type: "clickLoadButton"}]);

    test("clicking load button triggers a file upload effect", () => {
      expect(step3Effects[0]).toMatchObject({type: "fileUpload"});
    });

    const step4 = updateAll(step3, [
      {tag: "storage", type: "loadFile", name: "tasks.json", contents: fileContents},
      switchToFilter("all"),
    ]);

    test("after uploading the original file, the view is the same", () => {
      expect(view(step4)).toEqual(view(step1));
    });
  });

  describe("loading file with three levels of children", () => {
    const [step1, step1e] = stateAndEffectsAfter(empty, [{tag: "storage", type: "clickLoadButton"}]);

    test("clicking load button triggers a file upload effect", () => {
      expect(step1e).toEqual([{type: "fileUpload"}]);
    });

    const step2 = updateAll(step1, [
      {
        tag: "storage",
        type: "loadFile",
        name: "tasks.json",
        contents: `[{"id":"0","title":"Task 1","status":"active","action":false,"children":[{"id":"1","title":"Task 2","status":"done","action":true,"children":[{"id":"2","title":"Task 3","status":"done","action":true}]}]}]`,
      },
      switchToFilter("all"),
    ]);

    test("the correct tasks are shown", () => {
      expect(tasks(step2, ["title", "indentation"])).toEqual([
        {title: "Task 1", indentation: 0},
        {title: "Task 2", indentation: 1},
        {title: "Task 3", indentation: 2},
      ]);
    });
  });

  describe("automatically saving to local storage", () => {
    describe("after moving a task, the file is saved to local storage", () => {
      const step1 = updateAll(empty, [addTask("Task 0"), addTask("Task 1"), addTask("Task 2")]);

      const [step2, step2e] = stateAndEffectsAfter(step1, [dragAndDropNth(2, 1, {side: "below", indentation: 1})]);

      const saveEffect = step2e.reverse().find((e) => e.type === "saveLocalStorage");

      describe("there is an effect of saving to local storage", () => {
        expect(saveEffect).toBeTruthy();
      });

      const step3 = updateAll(step2, [
        {
          tag: "storage",
          type: "loadFile",
          name: "tasks.json",
          contents: (saveEffect as typeof saveEffect & {type: "saveLocalStorage"}).value,
        },
        switchToFilter("all"),
      ]);

      describe("loading the contents of the locally stored file loads the correct tasks", () => {
        expect(tasks(step3, ["title", "indentation"])).toEqual([
          {title: "Task 0", indentation: 0},
          {title: "Task 1", indentation: 0},
          {title: "Task 2", indentation: 1},
        ]);
      });
    });
  });
});

describe("planning", () => {
  describe("planned date is saved", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Task 1"), openNth(0)]);

    describe("initially", () => {
      test("the planned date is not set", () => {
        expect(componentTitled(step1, "Planned")).toMatchObject({type: "date", value: ""});
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Planned", "2020-01-01")]);

    describe("after setting planned date", () => {
      test("the planned date is set in the editor", () => {
        expect(componentTitled(step2, "Planned")).toMatchObject({type: "date", value: "2020-01-01"});
      });
    });

    const [_, savedEffects] = stateAndEffectsAfter(step2, [{tag: "storage", type: "clickSaveButton"}]);
    const savedContents = (savedEffects[0] as Effect & {type: "fileDownload"}).contents;

    const loaded = updateAll(empty, [
      {tag: "storage", type: "loadFile", name: "tasks.json", contents: savedContents},
      switchToFilter("all"),
      openNth(0),
    ]);

    describe("after loading the file", () => {
      test("the planned date is still set in the editor", () => {
        expect(componentTitled(loaded, "Planned")).toMatchObject({type: "date", value: "2020-01-01"});
      });
    });
  });

  describe("attempting to set invalid planned date", () => {
    ["", "invalid", "2020"].forEach((value) => {
      describe(`trying to set date to '${value}'`, () => {
        const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Task 1"), openNth(0)]);

        const step2 = updateAll(step1, [setComponentValue("Planned", value)]);

        describe("after setting planned date", () => {
          test("the planned date is not set in the editor", () => {
            expect(componentTitled(step2, "Planned")).toMatchObject({type: "date", value: ""});
          });
        });
      });
    });
  });

  describe("tasks planned today have today badge", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 1"),
      openNth(0),
      setComponentValue("Planned", "2020-03-15"),
    ]);

    test("the task has the today badge", () => {
      expect(tasks(step1, "badges")).toEqual([[bToday, bStalled]]);
    });

    test("the task has the 'today' property set in the task list", () => {
      expect(tasks(step1, "today")).toEqual([true]);
    });

    const step2 = updateAll(step1, [setComponentValue("Planned", "")]);

    test("clearing the date removes the today badge", () => {
      expect(tasks(step2, "badges")).toEqual([[bStalled]]);
    });
  });

  describe("tasks planned before today also have badge", () => {
    const step1 = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 1"),
      openNth(0),
      setComponentValue("Planned", "2020-03-10"),
    ]);

    test("the task has the today badge", () => {
      expect(tasks(step1, "badges")).toEqual([[bToday, bStalled]]);
    });

    test("the task has the 'today' property set in the task list", () => {
      expect(tasks(step1, "today")).toEqual([true]);
    });

    const step2 = updateAll(step1, [...switchToFilter("today")]);

    test("the task is shown in the today tab", () => {
      expect(tasks(step2, "title")).toEqual(["Task 1"]);
    });

    test("the today tab has an indicator", () => {
      expect(indicatorForFilter(step2, "Today")).toEqual({type: "text", text: "1", color: "red"});
    });
  });

  describe("today tab", () => {
    describe("dragging task to the today tab", () => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 1"),
        addTask("Task 2"),
        openNth(0),
        dragToFilter(0, "today"),
      ]);

      test("adds the today badge to the task", () => {
        expect(tasks(step1, "badges")).toEqual([[bToday, bStalled], [bStalled]]);
      });

      test("updates the planned date", () => {
        expect(componentTitled(step1, "Planned")).toMatchObject({type: "date", value: "2020-03-15"});
      });

      test("adds the task to the filter", () => {
        const step2 = updateAll(step1, [...switchToFilter("today")]);
        expect(tasks(step2, "title")).toEqual(["Task 1"]);
      });
    });

    describe("inicator", () => {
      const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Task 1")]);

      describe("when there are no tasks planned today", () => {
        test("the indicator is not visible", () => {
          expect(indicatorForFilter(step1, "Today")).toBeNull();
        });
      });

      const step2 = updateAll(step1, [dragToFilter(0, "today")]);

      describe("after planning a task today", () => {
        test("the indicator shows the number of tasks", () => {
          expect(indicatorForFilter(step2, "Today")).toMatchObject({type: "text", text: "1", color: "red"});
        });
      });
    });

    describe("tasks completed before today are not included", () => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 1"),
        addTask("Task 2", "today"),
        openNth(0),
        setComponentValue("Planned", "2020-03-10"),
        switchToFilter("today"),
      ]);

      describe("before marking either task as completed", () => {
        test("both tasks are shown in the today tab", () => {
          expect(tasks(step1, "title")).toEqual(["Task 1", "Task 2"]);
        });

        test("the counter shows that there are two tasks", () => {
          expect(indicatorForFilter(step1, "Today")).toMatchObject({type: "text", text: "2", color: "red"});
        });
      });

      const step2 = updateAll(step1, [dragToFilter(1, "done"), dragToFilter(0, "done")]);
      const step3 = updateAll(step2, [switchToFilter("all")]);

      describe("after marking both tasks as completed", () => {
        test("only the first task is shown in the today tab", () => {
          expect(tasks(step2, "title")).toEqual(["Task 2"]);
        });

        test("the counter shows that there are no more tasks", () => {
          expect(indicatorForFilter(step2, "Today")).toBeNull();
        });

        test("only the second task still has the 'today' badge", () => {
          expect(tasks(step3, "badges")).toEqual([[], [bToday]]);
        });
      });
    });
  });
});

describe("wait date", () => {
  describe("wait date is saved", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Task 1"), openNth(0)]);

    describe("initially", () => {
      test("the wait date is not set", () => {
        expect(componentTitled(step1, "Wait")).toMatchObject({type: "date", value: ""});
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Wait", "2020-01-01")]);

    describe("after setting wait date", () => {
      test("the wait date is set in the editor", () => {
        expect(componentTitled(step2, "Wait")).toMatchObject({type: "date", value: "2020-01-01"});
      });
    });

    const [_, savedEffects] = stateAndEffectsAfter(step2, [{tag: "storage", type: "clickSaveButton"}]);
    const savedContents = (savedEffects[0] as Effect & {type: "fileDownload"}).contents;

    const loaded = updateAll(empty, [
      {tag: "storage", type: "loadFile", name: "tasks.json", contents: savedContents},
      switchToFilter("all"),
      openNth(0),
    ]);

    describe("after loading the file", () => {
      test("the wait date is still set in the editor", () => {
        expect(componentTitled(loaded, "Wait")).toMatchObject({type: "date", value: "2020-01-01"});
      });
    });
  });

  describe("waiting tasks have badge and special appearance in list", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 1"),
      addTask("Task 2"),
      openNth(0),
      setComponentValue("Wait", "2020-04-10"),
      openNth(1),
      setComponentValue("Wait", "2020-03-15"),
    ]);

    test("the tasks have correct values", () => {
      expect(componentTitled(updateAll(example, [openNth(0)]), "Wait")).toMatchObject({
        type: "date",
        value: "2020-04-10",
      });

      expect(componentTitled(updateAll(example, [openNth(1)]), "Wait")).toMatchObject({
        type: "date",
        value: "2020-03-15",
      });
    });

    test("the waiting task has waiting badge", () => {
      expect(tasks(example, "badges")[0]).toEqual([{label: "Waiting | 26d", icon: "waiting", color: "grey"}]);
    });

    test("task with wait date in the past has stalled badge", () => {
      expect(tasks(example, "badges")[1]).toEqual([bStalled]);
    });

    test("waiting task has 'paused' appearance in task list", () => {
      expect(tasks(example, "paused")).toEqual([true, false]);
    });
  });

  describe("waiting tasks cannot also be ready", () => {
    const example = updateAll(empty, [
      switchToFilter("all"),
      addTask("Task 1", "ready"),
      openNth(0),
      setComponentValue("Wait", "2020-04-10"),
    ]);

    test("the ready task has only the waiting badge", () => {
      expect(tasks(example, "badges")).toEqual([[{label: "Waiting | 26d", icon: "waiting", color: "grey"}]]);
    });

    test("the counter for the ready tab is zero", () => {
      expect(indicatorForFilter(example, "Ready")).toEqual(null);
    });
  });

  describe("children of waiting tasks are treated as waiting themselves", () => {
    describe("children of waiting tasks have 'paused' appearance", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 1"),
        addTask("Task 2", 1),
        addTask("Task 3", 1),
        openNth(0),
        setComponentValue("Wait", "2020-04-10"),
      ]);

      test("the tasks have correct dates set", () => {
        expect(componentTitled(updateAll(example, [openNth(0)]), "Wait")).toMatchObject({
          type: "date",
          value: "2020-04-10",
        });

        expect(componentTitled(updateAll(example, [openNth(1)]), "Wait")).toMatchObject({
          type: "date",
          value: "",
        });

        expect(componentTitled(updateAll(example, [openNth(2)]), "Wait")).toMatchObject({
          type: "date",
          value: "",
        });
      });

      test("the tasks all paused appearance in task list", () => {
        expect(tasks(example, "paused")).toEqual([true, true, true]);
      });
    });

    describe("children of waiting tasks can't be ready or stalled", () => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 1"),
        addTask("Task 2", 1, "ready"),
        addTask("Task 3", 1),
      ]);

      const step2 = updateAll(step1, [openNth(0), setComponentValue("Wait", "2020-04-10")]);

      describe("before marking parent task as waiting", () => {
        test("the children has the correct badges", () => {
          expect(tasks(step1, "badges")).toEqual([[], [bReady], [bStalled]]);
        });

        test("the counter for the ready tab is 1", () => {
          expect(indicatorForFilter(step1, "Ready")).toEqual({type: "text", color: "green", text: "1"});
        });

        test("the counter for the stalled tab is 1", () => {
          expect(indicatorForFilter(step1, "Stalled")).toEqual({type: "text", color: "orange", text: "1"});
        });
      });

      describe("after marking the parent task as waiting", () => {
        test("the children no longer have stalled or ready badges", () => {
          expect(tasks(step2, "badges")).toEqual([
            [{label: "Waiting | 26d", icon: "waiting", color: "grey"}],
            [],
            [],
          ]);
        });

        test("the counter for the ready tab is zero", () => {
          expect(indicatorForFilter(step2, "Ready")).toEqual(null);
        });

        test("the counter for the stalled tab is zero", () => {
          expect(indicatorForFilter(step2, "Stalled")).toEqual(null);
        });
      });
    });
  });

  describe("waiting tab", () => {
    describe("setting wait date for task adds it to waiting tab", () => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 1"),
        addTask("Task 2", 1),
        addTask("Task 3"),
        openNth(0),
        setComponentValue("Wait", "2020-04-10"),
        switchToFilterCalled("Waiting"),
      ]);

      test("the waiting tab shows the correct tasks", () => {
        expect(tasks(step1, "title")).toEqual(["Task 1", "Task 2"]);
      });
    });

    describe("dragging task to waiting tab sets wait date to tomorrow", () => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 1"),
        dragToTab(0, "Waiting"),
        openNth(0),
      ]);

      test("the wait date has been updated to tomorrow's date", () => {
        expect(componentTitled(step1, "Wait")).toMatchObject({
          type: "date",
          value: "2020-03-16",
        });
      });
    });

    describe("waiting tab has indicator when there are waiting tasks", () => {
      const step1 = updateAll(empty, [switchToFilter("all"), addTask("Task 1")]);

      const step2 = updateAll(step1, [dragToTab(0, "Waiting")]);

      test("initially, the filter has no indicator", () => {
        expect(indicatorForFilter(step1, "Waiting")).toEqual(null);
      });

      test("after dragging to waiting tab, the filter has an indicator", () => {
        expect(indicatorForFilter(step2, "Waiting")).toEqual({type: "text", color: "grey", text: "1"});
      });
    });
  });
});

describe("due date", () => {
  describe("due date is saved", () => {
    const step1 = updateAll(empty, [...switchToFilter("all"), addTask("Task 1"), openNth(0)]);

    describe("initially", () => {
      test("the due date is not set", () => {
        expect(componentTitled(step1, "Due")).toMatchObject({type: "date", value: ""});
      });
    });

    const step2 = updateAll(step1, [setComponentValue("Due", "2020-01-01")]);

    describe("after setting due date", () => {
      test("the due date is set in the editor", () => {
        expect(componentTitled(step2, "Due")).toMatchObject({type: "date", value: "2020-01-01"});
      });
    });

    const [_, savedEffects] = stateAndEffectsAfter(step2, [{tag: "storage", type: "clickSaveButton"}]);
    const savedContents = (savedEffects[0] as Effect & {type: "fileDownload"}).contents;

    const loaded = updateAll(empty, [
      {tag: "storage", type: "loadFile", name: "tasks.json", contents: savedContents},
      switchToFilter("all"),
      openNth(0),
    ]);

    describe("after loading the file", () => {
      test("the due date is still set in the editor", () => {
        expect(componentTitled(loaded, "Due")).toMatchObject({type: "date", value: "2020-01-01"});
      });
    });
  });

  function setDue(n: number, date: string) {
    return [openNth(n), setComponentValue("Due", date)];
  }

  describe("badges for due dates", () => {
    describe("marking a single stalled task as due", () => {
      const step1 = updateAll(empty, [switchToFilter("all"), addTask("Task 1")]);

      const step2 = updateAll(step1, [setDue(0, "2020-03-20")]);

      test("before setting due date, task only has stalled badge", () => {
        expect(tasks(step1, "badges")).toEqual([[bStalled]]);
      });

      test("after setting due date, task also has due badge", () => {
        expect(tasks(step2, "badges")).toEqual([[bStalled, {color: "red", label: "Due | 5d", icon: "due"}]]);
      });
    });
  });

  describe("tasks due today", () => {
    const step1 = updateAll(empty, [switchToFilter("all"), addTask("Task 1", "ready"), setDue(0, "2020-03-15")]);

    test("have badge", () => {
      expect(tasks(step1, "badges")).toEqual([[bReady, {color: "red", label: "Due | Today", icon: "due"}]]);
    });

    test("have 'today' highlight in task list", () => {
      expect(tasks(step1, "today")).toEqual([true]);
    });

    test("are included in the 'today' tab", () => {
      const step2 = updateAll(step1, [switchToFilter("today")]);
      expect(tasks(step2, "title")).toEqual(["Task 1"]);
    });

    test("are included in the 'today' count", () => {
      expect(indicatorForFilter(step1, "Today")).toEqual({type: "text", color: "red", text: "1"});
    });
  });

  describe("tasks due before today", () => {
    const step1 = updateAll(empty, [switchToFilter("all"), addTask("Task 1", "ready"), setDue(0, "2020-03-10")]);

    test("have badge", () => {
      expect(tasks(step1, "badges")).toEqual([[bReady, {color: "red", label: "Overdue | 5d", icon: "due"}]]);
    });

    test("have 'today' highlight in task list", () => {
      expect(tasks(step1, "today")).toEqual([true]);
    });

    test("are included in the 'today' tab", () => {
      const step2 = updateAll(step1, [switchToFilter("today")]);
      expect(tasks(step2, "title")).toEqual(["Task 1"]);
    });

    test("are included in the 'today' count", () => {
      expect(indicatorForFilter(step1, "Today")).toEqual({type: "text", color: "red", text: "1"});
    });
  });
});

describe("performance", () => {
  function measureSeconds(callback: () => void) {
    const t1 = process.hrtime.bigint();
    callback();
    const t2 = process.hrtime.bigint();
    return Number((t2 - t1) / BigInt(1e3)) / 1e6;
  }

  function exampleWithNTasks(n: number) {
    return updateAll(
      empty,
      [...Array(n)].flatMap((_, i) => addTask(`Task ${i + 1}`)),
    );
  }

  function exampleWithNArchivedTasks(n: number) {
    return updateAll(
      empty,
      [...Array(n)].flatMap((_, i) => [addTask(`Task ${i + 1}`), dragToFilter(0, "archive")]),
    );
  }

  test.skip("the `view` function is not much worse than linear with respect to tasks shown", () => {
    const e1 = exampleWithNTasks(500);
    const t1 = measureSeconds(() => view(e1));

    const e2 = exampleWithNTasks(1000);
    const t2 = measureSeconds(() => view(e2));

    expect(t2 / t1).toBeLessThan(2.2);
  });

  test.skip("the `view` function is not much worse than constant with respect to archived tasks", () => {
    const e1 = exampleWithNArchivedTasks(500);
    const t1 = measureSeconds(() => view(e1));

    const e2 = exampleWithNArchivedTasks(1000);
    const t2 = measureSeconds(() => view(e2));

    expect(t2 / t1).toBeLessThan(1.2);
  });
});

describe("filter bar", () => {
  function filterState(view: View, label: string) {
    const filter = view.filterBar.filters.find((f) => f.label === label);
    if (!filter) {
      console.error("no such filter", view.filterBar);
      throw "no such filter in filter bar";
    }
    return filter.state;
  }

  function setFilter(label: string, state: "include" | "exclude") {
    return (view: View) => {
      return [
        {
          tag: "filterBar" as const,
          type: "set" as const,
          id: view.filterBar.filters.find((f) => f.label === label)!.id,
          state,
        },
      ];
    };
  }

  function filterBarHas(view: View, label: string) {
    return view.filterBar.filters.map((f) => f.label).includes(label);
  }

  describe("paused filter", () => {
    describe("is shown if and only if there are both paused and non-paused items", () => {
      const step1 = updateAll(empty, [switchToFilter("not-done"), addTask("Task 0", "paused"), addTask("Task 1")]);

      test("no paused items", () => {
        const step2 = updateAll(step1, [dragToFilter(0, "done")]);
        expect(filterBarHas(view(step2), "Paused")).toBe(false);
      });

      test("only paused items", () => {
        const step2 = updateAll(step1, [dragToFilter(1, "done")]);
        expect(filterBarHas(view(step2), "Paused")).toBe(false);
      });

      test("paused and non-paused items", () => {
        expect(filterBarHas(view(step1), "Paused")).toBe(true);
      });
    });

    describe("can be toggled on or off", () => {
      const step1 = updateAll(empty, [switchToFilter("not-done"), addTask("Task 0", "paused"), addTask("Task 1")]);

      const step2 = updateAll(step1, [setFilter("Paused", "include")]);

      const step3 = updateAll(step2, [setFilter("Paused", "exclude")]);

      const step4 = updateAll(step3, [setFilter("Paused", "exclude")]);

      test("the filter is neutral by default", () => {
        expect(filterState(view(step1), "Paused")).toBe("neutral");
      });

      test("the filter can be toggled on", () => {
        expect(filterState(view(step2), "Paused")).toBe("include");
      });

      test("the filter can be toggled off", () => {
        expect(filterState(view(step3), "Paused")).toBe("exclude");
      });

      test("the filter can be disabled again", () => {
        expect(filterState(view(step4), "Paused")).toBe("neutral");
      });
    });

    describe("hides or shows paused tasks, depending on state", () => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Non-paused parent"),
        addTask("Paused parent", 1, "paused"),
        addTask("Paused task", 2, "paused"),
        addTask("Non-paused task", 2),
        addTask("Paused top-level task", "paused"),
        addTask("Non-paused top-level task"),
      ]);

      const step2 = updateAll(step1, [setFilter("Paused", "include")]);

      const step3 = updateAll(step2, [setFilter("Paused", "exclude")]);

      const step4 = updateAll(step3, [setFilter("Paused", "exclude")]);

      test("when set to 'include', only paused subtrees are shown", () => {
        expect(tasks(step2, ["title", "indentation"])).toEqual([
          {title: "Non-paused parent", indentation: 0},
          {title: "Paused parent", indentation: 1},
          {title: "Paused task", indentation: 2},
          {title: "Non-paused task", indentation: 2},
          {title: "Paused top-level task", indentation: 0},
        ]);
      });

      test("when set to 'exclude', only non-paused subtrees are shown", () => {
        expect(tasks(step3, ["title", "indentation"])).toEqual([
          {title: "Non-paused parent", indentation: 0},
          {title: "Non-paused top-level task", indentation: 0},
        ]);
      });

      test("when set to 'neutral', all tasks are shown", () => {
        expect(tasks(step4, ["title", "indentation"])).toEqual([
          {title: "Non-paused parent", indentation: 0},
          {title: "Paused parent", indentation: 1},
          {title: "Paused task", indentation: 2},
          {title: "Non-paused task", indentation: 2},
          {title: "Paused top-level task", indentation: 0},
          {title: "Non-paused top-level task", indentation: 0},
        ]);
      });
    });
  });

  describe("completed filter", () => {
    describe("is shown if and only if there are both completed and non-completed items", () => {
      const step1 = updateAll(empty, [switchToFilter("all"), addTask("Task 0", "done"), addTask("Task 1")]);

      test("no completed items", () => {
        const step2 = updateAll(step1, [dragToFilter(0, "not-done")]);
        expect(filterBarHas(view(step2), "Completed")).toBe(false);
      });

      test("only completed items", () => {
        const step2 = updateAll(step1, [dragToFilter(1, "done")]);
        expect(filterBarHas(view(step2), "Completed")).toBe(false);
      });

      test("completed and non-completed items", () => {
        expect(filterBarHas(view(step1), "Completed")).toBe(true);
      });
    });

    describe("can be toggled on or off", () => {
      const step1 = updateAll(empty, [switchToFilter("all"), addTask("Task 0", "done"), addTask("Task 1")]);

      const step2 = updateAll(step1, [setFilter("Completed", "include")]);

      const step3 = updateAll(step2, [setFilter("Completed", "exclude")]);

      const step4 = updateAll(step3, [setFilter("Completed", "exclude")]);

      test("the filter is neutral by default", () => {
        expect(filterState(view(step1), "Completed")).toBe("neutral");
      });

      test("the filter can be toggled on", () => {
        expect(filterState(view(step2), "Completed")).toBe("include");
      });

      test("the filter can be toggled off", () => {
        expect(filterState(view(step3), "Completed")).toBe("exclude");
      });

      test("the filter can be disabled again", () => {
        expect(filterState(view(step4), "Completed")).toBe("neutral");
      });
    });

    describe("hides or shows completed tasks, depending on state", () => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Non-completed parent"),
        addTask("Completed parent", 1, "done"),
        addTask("Completed task", 2, "done"),
        addTask("Non-completed task", 2),
        addTask("Completed top-level task", "done"),
        addTask("Non-completed top-level task"),
      ]);

      const step2 = updateAll(step1, [setFilter("Completed", "include")]);

      const step3 = updateAll(step2, [setFilter("Completed", "exclude")]);

      const step4 = updateAll(step3, [setFilter("Completed", "exclude")]);

      test("when set to 'include', only completed subtasks and their parents are shown", () => {
        expect(tasks(step2, ["title", "indentation"])).toEqual([
          {title: "Non-completed parent", indentation: 0},
          {title: "Completed parent", indentation: 1},
          {title: "Completed task", indentation: 2},
          {title: "Completed top-level task", indentation: 0},
        ]);
      });

      test("when set to 'exclude', only non-completed subtasks and their parents are shown", () => {
        expect(tasks(step3, ["title", "indentation"])).toEqual([
          {title: "Non-completed parent", indentation: 0},
          {title: "Completed parent", indentation: 1},
          {title: "Non-completed task", indentation: 2},
          {title: "Non-completed top-level task", indentation: 0},
        ]);
      });

      test("when set to 'neutral', all tasks are shown", () => {
        expect(tasks(step4, ["title", "indentation"])).toEqual([
          {title: "Non-completed parent", indentation: 0},
          {title: "Completed parent", indentation: 1},
          {title: "Completed task", indentation: 2},
          {title: "Non-completed task", indentation: 2},
          {title: "Completed top-level task", indentation: 0},
          {title: "Non-completed top-level task", indentation: 0},
        ]);
      });
    });

    describe("ignores children that aren't shown because they are archived", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 0"),
        addTask("Task 1", 1),
        addTask("Task 2", 2, "done"),
        addTask("Task 3", "done"),
        addTask("Task 4", 1),
      ]);

      describe("when set to include", () => {
        const step1 = updateAll(example, [setFilter("Completed", "include")]);

        test("before archiving, all subtrees with completed tasks are shown", () => {
          expect(tasks(step1, ["title", "indentation"])).toEqual([
            {title: "Task 0", indentation: 0},
            {title: "Task 1", indentation: 1},
            {title: "Task 2", indentation: 2},
            {title: "Task 3", indentation: 0},
          ]);
        });

        const step2 = updateAll(step1, [dragToFilter(2, "archive")]);

        test("after archiving completed task, that subtree is hidden", () => {
          expect(tasks(step2, ["title", "indentation"])).toEqual([{title: "Task 3", indentation: 0}]);
        });
      });

      describe("when set to exclude", () => {
        const step1 = updateAll(example, [setFilter("Completed", "exclude")]);

        test("before archiving, all subtrees with non-completed tasks are shown", () => {
          expect(tasks(step1, ["title", "indentation"])).toEqual([
            {title: "Task 0", indentation: 0},
            {title: "Task 1", indentation: 1},
            {title: "Task 3", indentation: 0},
            {title: "Task 4", indentation: 1},
          ]);
        });

        const step2 = updateAll(step1, [dragToFilter(3, "archive")]);

        test("after archiving non-completed task, that subtree is hidden", () => {
          expect(tasks(step2, ["title", "indentation"])).toEqual([
            {title: "Task 0", indentation: 0},
            {title: "Task 1", indentation: 1},
          ]);
        });
      });
    });
  });

  describe("ready filter", () => {
    describe("is shown if and only if there are both ready and non-ready items", () => {
      const step1 = updateAll(empty, [switchToFilter("all"), addTask("Task 0", "ready"), addTask("Task 1")]);

      test("no ready items", () => {
        const step2 = updateAll(step1, [dragToFilter(0, "stalled")]);
        expect(filterBarHas(view(step2), "Ready")).toBe(false);
      });

      test("only ready items", () => {
        const step2 = updateAll(step1, [dragToFilter(1, "ready")]);
        expect(filterBarHas(view(step2), "Ready")).toBe(false);
      });

      test("ready and non-ready items", () => {
        expect(filterBarHas(view(step1), "Ready")).toBe(true);
      });
    });

    describe("tasks that don't have the ready badge, but which contain tasks that do, don't influence whether it's shown or not", () => {
      const step1 = updateAll(empty, [switchToFilter("all"), addTask("Task 0"), addTask("Task 1", 1, "ready")]);

      test("in this example, it isn't shown", () => {
        expect(filterBarHas(view(step1), "Ready")).toBe(false);
      });
    });

    describe("filters tasks that are ready", () => {
      const step1 = updateAll(empty, [
        switchToFilter("all"),
        addTask("Project", "project"),
        addTask("Task 1", 1),
        addTask("Task 2", 2, "ready"),
        addTask("Task 3", 1),
        switchToFilterCalled("Project"),
      ]);

      const step2 = updateAll(step1, [setFilter("Ready", "include")]);

      const step3 = updateAll(step2, [setFilter("Ready", "exclude")]);

      test("the intial state is correct", () => {
        expect(tasks(step1, ["title", "indentation", "badges"])).toEqual([
          {title: "Task 1", indentation: 0, badges: []},
          {title: "Task 2", indentation: 1, badges: [bReady]},
          {title: "Task 3", indentation: 0, badges: [bStalled]},
        ]);
      });

      test("after setting filter to include, only subtrees with ready tasks are shown", () => {
        expect(tasks(step2, ["title", "indentation", "badges"])).toEqual([
          {title: "Task 1", indentation: 0, badges: []},
          {title: "Task 2", indentation: 1, badges: [bReady]},
        ]);
      });

      test("after setting filter to exclude, only subtrees without ready tasks are shown", () => {
        expect(tasks(step3, ["title", "indentation", "badges"])).toEqual([
          {title: "Task 3", indentation: 0, badges: [bStalled]},
        ]);
      });
    });
  });

  describe("ready filter is never shown in stalled tab", () => {
    describe("in example with ready project and stalled subtask", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Project", "project"),
        addTask("Task 1", 1),
        addTask("Task 2", 1, "ready"),
        switchToFilter("stalled"),
      ]);

      test("the correct tasks are shown in the stalled view", () => {
        expect(tasks(example, ["title", "indentation", "badges"])).toEqual([
          {
            title: "Project",
            indentation: 0,
            badges: [bProject, bReady],
          },
          {title: "Task 1", indentation: 1, badges: [bStalled]},
        ]);
      });

      test("the ready filter is not available in the filter bar", () => {
        expect(filterBarHas(view(example), "Ready")).toBe(false);
      });
    });

    describe("in example with non-project parent task that has both stalled and ready subtask", () => {
      const example = updateAll(empty, [
        switchToFilter("all"),
        addTask("Task 1", 0),
        addTask("Task 2", 1, "ready"),
        addTask("Task 3", 1),
        switchToFilter("stalled"),
      ]);

      test("the correct tasks are shown in the stalled view", () => {
        expect(tasks(example, ["title", "indentation", "badges"])).toEqual([
          {title: "Task 1", indentation: 0, badges: []},
          {title: "Task 3", indentation: 1, badges: [bStalled]},
        ]);
      });

      test("the ready filter is not available in the filter bar", () => {
        expect(filterBarHas(view(example), "Ready")).toBe(false);
      });
    });
  });

  describe("examples of when subtask filter is shown", () => {
    test("when completed parent task has non-completed subtask, completed filter is shown", () => {
      const example = updateAll(empty, [switchToFilter("all"), addTask("Task 1", "done"), addTask("Task 2", 1)]);
      expect(filterBarHas(view(example), "Completed")).toBe(true);
    });

    test("when non-completed parent task has completed subtask, completed filter is shown", () => {
      const example = updateAll(empty, [switchToFilter("all"), addTask("Task 1"), addTask("Task 2", 1, "done")]);
      expect(filterBarHas(view(example), "Completed")).toBe(true);
    });
  });
});
