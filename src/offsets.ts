import { END_LINE } from "./marker";

class LineOffsets {
  private offsets: number[];

  constructor(text: string) {
    this.offsets = [0];
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;
      const lineWidth = line.length;
      const previousOffset = this.offsets[i] as number;
      const lineEndingOffset = previousOffset + lineWidth;
      const lineEndingWidth = getLineEnding(text, lineEndingOffset).length;

      this.offsets[i + 1] = previousOffset + lineWidth + lineEndingWidth;
    }
  }

  getOffset(line: number) {
    return this.offsets[line] ?? 0;
  }

  totalLines() {
    return this.offsets.length - 1;
  }
}

function getLineEnding(text: string, charOffset: number): string {
  const nextTwoChars = text.slice(charOffset, charOffset + 2);

  if (nextTwoChars.startsWith("\r\n")) {
    return "\r\n";
  }

  return END_LINE;
}

export { LineOffsets };
