import { LineOffsets } from "./offsets";

describe("LineOffsets", () => {
  it("calculates offsets for unix newlines", () => {
    const offsets = new LineOffsets("a\nb\nc\n");
    expect(offsets.getOffset(0)).toBe(0);
    expect(offsets.getOffset(1)).toBe(2); // 'a' + '\n'
    expect(offsets.getOffset(2)).toBe(4); // 'a\nb' + '\n'
    expect(offsets.getOffset(3)).toBe(6); // 'a\nb\nc' + '\n'
    expect(offsets.totalLines()).toBe(4);
  });

  it("calculates offsets for windows newlines", () => {
    const offsets = new LineOffsets("a\r\nb\r\nc\r\n");
    expect(offsets.getOffset(0)).toBe(0);
    expect(offsets.getOffset(1)).toBe(3); // 'a' + '\r\n'
    expect(offsets.getOffset(2)).toBe(6); // 'a\r\nb' + '\r\n'
    expect(offsets.getOffset(3)).toBe(9); // 'a\r\nb\r\nc' + '\r\n'
    expect(offsets.totalLines()).toBe(4);
  });

  it("handles empty lines and trailing newlines", () => {
    const offsets = new LineOffsets("a\n\n\n");
    expect(offsets.getOffset(0)).toBe(0);
    expect(offsets.getOffset(1)).toBe(2); // 'a' + '\n'
    expect(offsets.getOffset(2)).toBe(3); // 'a\n' + '\n'
    expect(offsets.getOffset(3)).toBe(4); // 'a\n\n' + '\n'
    expect(offsets.totalLines()).toBe(4);
  });

  it("returns 0 for out-of-bounds getOffset", () => {
    const offsets = new LineOffsets("a\nb\n");
    expect(offsets.getOffset(-1)).toBe(0);
    expect(offsets.getOffset(100)).toBe(0);
  });

  it("handles no trailing newline", () => {
    const offsets = new LineOffsets("a\nb");
    expect(offsets.getOffset(0)).toBe(0);
    expect(offsets.getOffset(1)).toBe(2); // 'a' + '\n' (implicit)
    expect(offsets.getOffset(2)).toBe(4); // 'a\nb' (no newline)
    expect(offsets.totalLines()).toBe(2);
  });
});
