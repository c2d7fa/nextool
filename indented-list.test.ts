import {listInsertLocationtoTreeLocation, moveItemInTree, Tree} from "./indented-list";

describe.skip("moving item in tree", () => {
  describe("in flat list", () => {
    function flatTree(elements: number): Tree<{id: string}> {
      return [...Array(elements)].map((_, index) => ({id: `${index}`, children: []}));
    }

    function expectFlatMove(
      tree: Tree<{id: string}>,
      source: number,
      location: {target: number; side: "above" | "below"},
      expected: number[],
    ) {
      expect(
        moveItemInTree(
          tree,
          {id: `${source}`},
          {target: `${location.target}`, side: location.side, indentation: 0},
        ).map((x) => +x.id),
      ).toEqual(expected);
    }

    test("in an empty list, repositioning doesn't change anything", () => {
      expect(moveItemInTree([], {id: "0"}, {target: "0", side: "above", indentation: 0})).toEqual([]);
    });

    describe("repositioning to below another item", () => {
      describe("moving item up", () => {
        const example = flatTree(6);

        test("moving 4 below 1", () => {
          expectFlatMove(example, 4, {target: 1, side: "below"}, [0, 1, 4, 2, 3, 5]);
        });
      });

      describe("moving item down", () => {
        const example = flatTree(6);

        test("moving 1 below 4", () => {
          expectFlatMove(example, 1, {target: 4, side: "below"}, [0, 2, 3, 4, 1, 5]);
        });
      });
    });

    describe("repositioning to above another item", () => {
      describe("moving item down", () => {
        const example = flatTree(6);

        test("moving 1 above 4", () => {
          expectFlatMove(example, 1, {target: 4, side: "above"}, [0, 2, 3, 1, 4, 5]);
        });
      });

      describe("moving item up", () => {
        const example = flatTree(6);

        test("moving 4 above 1", () => {
          expectFlatMove(example, 4, {target: 1, side: "above"}, [0, 4, 1, 2, 3, 5]);
        });
      });
    });

    describe("when repositioning doesn't change anything", () => {
      describe("repositioning an item near itself", () => {
        test("repositioning an item above itself", () => {
          expectFlatMove(flatTree(3), 1, {target: 1, side: "above"}, [0, 1, 2]);
        });

        test("repositioning an item below itself", () => {
          expectFlatMove(flatTree(3), 1, {target: 1, side: "below"}, [0, 1, 2]);
        });

        describe("edge cases", () => {
          test("repositioning the first item above itself", () => {
            expectFlatMove(flatTree(3), 0, {target: 0, side: "above"}, [0, 1, 2]);
          });

          test("repositioning the last item below itself", () => {
            expectFlatMove(flatTree(3), 2, {target: 2, side: "below"}, [0, 1, 2]);
          });
        });
      });

      describe("repositioning an item near its neighbors", () => {
        test("repositioning an item below the previous item", () => {
          expectFlatMove(flatTree(3), 1, {target: 0, side: "below"}, [0, 1, 2]);
        });

        test("repositioning an item above the next item", () => {
          expectFlatMove(flatTree(3), 1, {target: 2, side: "above"}, [0, 1, 2]);
        });
      });
    });
  });

  describe.skip("moving subtrees", () => {
    describe("after indenting a subtree below the previous top-level item", () => {
      const before = [
        {id: "0", children: []},
        {id: "1", children: [{id: "2", children: []}]},
      ];

      const after = moveItemInTree(before, {id: "1"}, {target: "0", side: "below", indentation: 1});

      test("there is only one top-level item", () => {
        expect(after.length).toBe(1);
      });

      test("the top-level item remains the same", () => {
        expect(before[0].id).toEqual("0");
      });

      test("the root of the subtree is added as a child of the top-level item", () => {
        expect(after[0].children[0].id).toEqual("1");
      });

      test.skip("the root of the subtree still has its children", () => {
        expect(after[0].children[0].children).toEqual(before[1].children);
      });
    });
  });
});

describe("converting indented list insertion location to tree coordinates", () => {
  describe("in a flat list", () => {
    const example = [
      {id: "0", children: []},
      {id: "1", children: []},
    ];

    test("above the first item", () => {
      expect(listInsertLocationtoTreeLocation(example, {target: "0", side: "above", indentation: 0})).toEqual({
        parent: null,
        index: 0,
      });
    });

    test("below the first item", () => {
      expect(listInsertLocationtoTreeLocation(example, {target: "0", side: "below", indentation: 0})).toEqual({
        parent: null,
        index: 1,
      });
    });

    test("above the second item", () => {
      expect(listInsertLocationtoTreeLocation(example, {target: "1", side: "above", indentation: 0})).toEqual({
        parent: null,
        index: 1,
      });
    });

    test("below the second item", () => {
      expect(listInsertLocationtoTreeLocation(example, {target: "1", side: "below", indentation: 0})).toEqual({
        parent: null,
        index: 2,
      });
    });
  });

  describe("inserting into an existing subtree", () => {
    const example = [{id: "0", children: [{id: "1", children: []}]}];

    test("above the item inside the subtree", () => {
      expect(listInsertLocationtoTreeLocation(example, {target: "1", side: "above", indentation: 1})).toEqual({
        parent: "0",
        index: 0,
      });
    });

    test("below the item inside the subtree", () => {
      expect(listInsertLocationtoTreeLocation(example, {target: "1", side: "below", indentation: 1})).toEqual({
        parent: "0",
        index: 1,
      });
    });
  });

  describe("inserting a new child of a leaf node", () => {
    test("by inserting below parent node", () => {
      const example = [{id: "0", children: []}];
      expect(listInsertLocationtoTreeLocation(example, {target: "0", side: "below", indentation: 1})).toEqual({
        parent: "0",
        index: 0,
      });
    });

    test("by inserting above following node at same indentation", () => {
      const example = [
        {id: "0", children: []},
        {id: "1", children: []},
      ];
      expect(listInsertLocationtoTreeLocation(example, {target: "1", side: "above", indentation: 1})).toEqual({
        parent: "0",
        index: 0,
      });
    });

    test("by inserting above following node at higher indentation", () => {
      const example = [
        {id: "0", children: [{id: "1", children: []}]},
        {id: "2", children: []},
      ];
      expect(listInsertLocationtoTreeLocation(example, {target: "2", side: "above", indentation: 2})).toEqual({
        parent: "1",
        index: 0,
      });
    });
  });

  test("inserting at the end of an existing subtree by inserting above the following item", () => {
    const example = [
      {id: "0", children: [{id: "1", children: []}]},
      {id: "2", children: []},
    ];
    expect(listInsertLocationtoTreeLocation(example, {target: "2", side: "above", indentation: 1})).toEqual({
      parent: "0",
      index: 1,
    });
  });

  describe("inserting an item below another item but at a lower level of indentation", () => {
    test("at the end of the list at the top level", () => {
      const example = [{id: "0", children: [{id: "1", children: []}]}];
      expect(listInsertLocationtoTreeLocation(example, {target: "1", side: "below", indentation: 0})).toEqual({
        parent: null,
        index: 1,
      });
    });

    test("in the middle of the list at the top level", () => {
      const example = [
        {
          id: "0",
          children: [{id: "1", children: []}],
        },
        {id: "3", children: []},
      ];
      expect(listInsertLocationtoTreeLocation(example, {target: "1", side: "below", indentation: 0})).toEqual({
        parent: null,
        index: 1,
      });
    });

    test("in the middle of a subtree", () => {
      const example = [
        {
          id: "0",
          children: [
            {id: "1", children: [{id: "2", children: []}]},
            {id: "3", children: []},
          ],
        },
      ];
      expect(listInsertLocationtoTreeLocation(example, {target: "2", side: "below", indentation: 1})).toEqual({
        parent: "0",
        index: 1,
      });
    });
  });
});
