import { Range } from "./Range";

describe("Range", () => {
  it("should instantiate with correct parameters", () => {
    const range = new Range(2, 5);
    expect(range).toBeInstanceOf(Range);
  });

  it("should throw TypeError when parameters are flipped or equal", () => {
    expect(() => new Range(5, 2)).toThrowErrorMatchingSnapshot();
    expect(() => new Range(3, 3)).toThrow(TypeError);
  });

  it("rangeStart returns inclusiveLowerBound - 1", () => {
    const range = new Range(2, 5);
    expect(range.rangeStart()).toBe(1);
  });

  it("rangeEnd returns exclusiveUpperBound - 1", () => {
    const range = new Range(2, 5);
    expect(range.rangeEnd()).toBe(4);
  });

  it("isWithinRange returns true for values in range", () => {
    const range = new Range(2, 5);
    expect(range.isWithinRange(2)).toBe(true);
    expect(range.isWithinRange(4)).toBe(true);
  });

  it("isWithinRange returns false for values out of range", () => {
    const range = new Range(2, 5);
    expect(range.isWithinRange(1)).toBe(false);
    expect(range.isWithinRange(5)).toBe(false);
  });
});
