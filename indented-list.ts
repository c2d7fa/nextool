export type TreeNode<T> = T & {children: TreeNode<T>[]};
export type Tree<T> = TreeNode<T>[];

export type IndentedListItem<T> = T & {indentation: number};
export type IndentedList<T> = IndentedListItem<T>[];

export type IndentedListInsertLocation = {side: "above" | "below"; target: string; indentation: number};

function range(start: number, end: number): number[] {
  return Array.from(Array(end - start + 1), (_, i) => i + start);
}

function reposition<T>(list: T[], sourceIndex: number, target: {index: number; side: "above" | "below"}): T[] {
  function repositionBelow(list: T[], sourceIndex: number, targetIndex: number): T[] {
    return range(0, list.length - 1).map((i) => {
      const isUpwards = targetIndex < sourceIndex;

      const adjustedTargetIndex = isUpwards ? targetIndex + 1 : targetIndex;
      const adjustedSourceIndex = isUpwards ? sourceIndex + 1 : sourceIndex;

      if (i === adjustedTargetIndex) return list[sourceIndex];

      const isRemoved = i >= adjustedSourceIndex;
      const isInserted = i >= adjustedTargetIndex;

      const adjustment = (isRemoved ? +1 : 0) + (isInserted ? -1 : 0);

      return list[i + adjustment];
    });
  }

  return target.side === "below"
    ? repositionBelow(list, sourceIndex, target.index)
    : repositionBelow(list, sourceIndex, target.index - 1);
}

export function findNode<T extends {id: string}>(tree: Tree<T>, query: {id: string}): TreeNode<T> | null {
  const topLevel = tree.find((node) => node.id === query.id);
  if (topLevel) return topLevel;
  for (const node of tree) {
    const child = findNode(node.children, query);
    if (child) return child;
  }
  return null;
}

export function updateNode<T extends {id: string}>(
  tree: Tree<T>,
  query: {id: string},
  update: (x: T) => T,
): Tree<T> {
  return tree.map((node) => {
    if (node.id === query.id) {
      return {...node, ...update(node)};
    }
    return {...node, children: updateNode(node.children, query, update)};
  });
}

export function moveItemInTree<T extends {id: string}>(
  tree: Tree<T>,
  source: {id: string},
  location: IndentedListInsertLocation,
): Tree<T> {
  const sourceIndex = toList(tree).findIndex((item) => item.id === source.id);
  if (sourceIndex === -1) return tree;

  const targetIndex = toList(tree).findIndex((item) => item.id === location.target);
  if (targetIndex === -1) return tree;

  return fromList(
    reposition(toList(tree), sourceIndex, {index: targetIndex, side: location.side}).map((item) =>
      item.id === source.id ? {...item, indentation: location.indentation} : item,
    ),
  );
}

export function merge<T extends {id: string}>(tree: Tree<T>, patches: ({id: string} & Partial<T>)[]): Tree<T> {
  return patches.reduce((result, patch) => updateNode(result, patch, (node) => ({...node, ...patch})), tree);
}

export function toList<T>(roots: Tree<T>, indentation?: number): IndentedList<T> {
  return roots.reduce(
    (result, node) => [
      ...result,
      {...node, indentation: indentation ?? 0},
      ...toList(node.children, (indentation ?? 0) + 1),
    ],
    [] as IndentedList<T>,
  );
}

export function fromList<T>(list: IndentedList<T>): Tree<T> {
  function takeWhile<T>(array: T[], predicate: (value: T, index: number) => boolean): T[] {
    let i = 0;
    while (i < array.length && predicate(array[i], i)) i++;
    return array.slice(0, i);
  }

  function directChildren(list: IndentedList<T>, indentation: number): IndentedList<T> {
    return takeWhile(list, (item) => indentation < item.indentation).filter(
      (item) => item.indentation === indentation + 1,
    );
  }

  function subtree(item: IndentedListItem<T>): TreeNode<T> {
    return {
      ...item,
      children: directChildren(list.slice(list.indexOf(item) + 1), item.indentation).map(subtree),
    };
  }

  return list.filter((item) => item.indentation === 0).map(subtree);
}
