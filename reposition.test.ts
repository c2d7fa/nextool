import {reposition} from "./reposition";

describe("reposition", () => {
  test("in an empty list, repositioning doesn't change anything", () => {
    expect(reposition([], 0, {index: 0, side: "above"})).toEqual([]);
  });

  describe("repositioning to below another item", () => {
    describe("moving item up", () => {
      const example = [0, 1, 2, 3, 4, 5];

      test("moving 4 below 1", () => {
        expect(reposition(example, 4, {index: 1, side: "below"})).toEqual([0, 1, 4, 2, 3, 5]);
      });
    });

    describe("moving item down", () => {
      const example = [0, 1, 2, 3, 4, 5];

      test("moving 1 below 4", () => {
        expect(reposition(example, 1, {index: 4, side: "below"})).toEqual([0, 2, 3, 4, 1, 5]);
      });
    });
  });

  describe("repositioning to above another item", () => {
    describe("moving item down", () => {
      const example = [0, 1, 2, 3, 4, 5];

      test("moving 1 above 4", () => {
        expect(reposition(example, 1, {index: 4, side: "above"})).toEqual([0, 2, 3, 1, 4, 5]);
      });
    });

    describe("moving item up", () => {
      const example = [0, 1, 2, 3, 4, 5];

      test("moving 4 above 1", () => {
        expect(reposition(example, 4, {index: 1, side: "above"})).toEqual([0, 4, 1, 2, 3, 5]);
      });
    });
  });

  describe("when repositioning doesn't change anything", () => {
    describe("repositioning an item near itself", () => {
      test("repositioning an item above itself", () => {
        expect(reposition([0, 1, 2], 1, {index: 1, side: "above"})).toEqual([0, 1, 2]);
      });

      test("repositioning an item below itself", () => {
        expect(reposition([0, 1, 2], 1, {index: 1, side: "below"})).toEqual([0, 1, 2]);
      });

      describe("edge cases", () => {
        test("repositioning the first item above itself", () => {
          expect(reposition([0, 1, 2], 0, {index: 0, side: "above"})).toEqual([0, 1, 2]);
        });

        test("repositioning the last item below itself", () => {
          expect(reposition([0, 1, 2], 2, {index: 2, side: "below"})).toEqual([0, 1, 2]);
        });
      });
    });

    describe("repositioning an item near its neighbors", () => {
      test("repositioning an item below the previous item", () => {
        expect(reposition([0, 1, 2], 1, {index: 0, side: "below"})).toEqual([0, 1, 2]);
      });

      test("repositioning an item above the next item", () => {
        expect(reposition([0, 1, 2], 1, {index: 2, side: "above"})).toEqual([0, 1, 2]);
      });
    });
  });
});
