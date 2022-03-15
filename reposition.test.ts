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
});
