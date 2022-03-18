export type TreeNode<T> = T & {children: TreeNode<T>[]};
export type Tree<T> = TreeNode<T>[];

export type IndentedListItem<T> = T & {indentation: number};
export type IndentedList<T> = IndentedListItem<T>[];

type TreeLocation = {parent: string | null; index: number};
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

function findNodeLocation<T extends {id: string}>(tree: Tree<T>, query: {id: string}): TreeLocation | null {
  const index = tree.findIndex((node) => node.id === query.id);
  if (index !== -1) return {parent: null, index};

  for (const parent of tree) {
    const location = findNodeLocation(parent.children, query);
    if (location) return {parent: location.parent ?? parent.id, index: location.index};
  }

  return null;
}

export function listInsertLocationtoTreeLocation<T extends {id: string}>(
  tree: Tree<T>,
  location: IndentedListInsertLocation,
): TreeLocation | null {
  const list = toList(tree);
  const targetItemIndex = list.findIndex((x) => x.id === location.target);
  const targetItem = list[targetItemIndex];
  const previousItem = list[targetItemIndex - 1];

  if (location.side === "above") {
    if (!previousItem) return {parent: null, index: 0};
    return listInsertLocationtoTreeLocation(tree, {
      target: previousItem.id,
      side: "below",
      indentation: location.indentation,
    });
  }

  if (location.indentation === targetItem.indentation) {
    const targetLocation = findNodeLocation(tree, {id: location.target});
    if (!targetLocation) return null;
    return {parent: targetLocation.parent, index: targetLocation.index + 1};
  }

  if (location.indentation === targetItem.indentation + 1) {
    return {parent: targetItem.id, index: 0};
  }

  if (location.indentation < targetItem.indentation) {
    return null; // [TODO]
  }

  return null;
}

function moveNodeInTree<T extends {id: string}>(tree: Tree<T>, from: TreeLocation, to: TreeLocation): Tree<T> {
  return tree;
}

export function moveItemInTree<T extends {id: string}>(
  tree: Tree<T>,
  source: {id: string},
  location: IndentedListInsertLocation,
): Tree<T> {
  const from = findNodeLocation(tree, source);
  if (!from) return tree;

  const to = listInsertLocationtoTreeLocation(tree, location);
  if (!to) return tree;

  return moveNodeInTree(tree, from, to);
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
