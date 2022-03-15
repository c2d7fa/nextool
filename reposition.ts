function range(start: number, end: number): number[] {
  return Array.from(Array(end - start + 1), (_, i) => i + start);
}

export function reposition<T>(
  list: T[],
  sourceIndex: number,
  target: {index: number; side: "above" | "below"},
): T[] {
  return range(0, list.length - 1).map((i) => {
    const isUpwards = target.index < sourceIndex;

    const adjustedTargetIndex = isUpwards ? target.index + 1 : target.index;
    const adjustedSourceIndex = isUpwards ? sourceIndex + 1 : sourceIndex;

    if (i === adjustedTargetIndex) return list[sourceIndex];

    const isRemoved = i >= adjustedSourceIndex;
    const isInserted = i >= adjustedTargetIndex;

    const adjustment = (isRemoved ? +1 : 0) + (isInserted ? -1 : 0);

    return list[i + adjustment];
  });
}
