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

export function filterNodes<T extends {id: string}>(tree: Tree<T>, pred: (node: T) => boolean): TreeNode<T>[] {
  let result: TreeNode<T>[] = [];
  function filter(node: TreeNode<T>): void {
    if (pred(node)) result.push(node);
    node.children.forEach(filter);
  }
  tree.forEach(filter);
  return result;
}

export function findNode<T extends {id: string}>(tree: Tree<T>, query: {id: string}): TreeNode<T> | null {
  const matching = filterNodes(tree, (node) => node.id === query.id);
  return matching.length === 0 ? null : matching[0];
}

export function updateNode<T extends {id: string}>(
  tree: Tree<T>,
  query: {id: string},
  update: (x: TreeNode<T>) => TreeNode<T>,
): Tree<T> {
  return tree.map((node) => {
    if (node.id === query.id) {
      return {...node, ...update(node)};
    }
    return {...node, children: updateNode(node.children, query, update)};
  });
}

function updateChildren<T extends {id: string}>(
  tree: Tree<T>,
  parent: {id: string} | null,
  update: (x: TreeNode<T>[]) => TreeNode<T>[],
): Tree<T> {
  if (parent === null) return update(tree);
  return updateNode(tree, parent, (node) => ({...node, children: updateChildren(node.children, null, update)}));
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

export function findParent<T extends {id: string}>(tree: Tree<T>, query: {id: string}): TreeNode<T> | null {
  const parent = findNodeLocation(tree, query)?.parent ?? null;
  return parent === null ? null : findNode(tree, {id: parent});
}

function listInsertLocationToTreeLocation<T extends {id: string}>(
  tree: Tree<T>,
  location: IndentedListInsertLocation,
): TreeLocation | null {
  const list = toList(tree);

  if (location.side === "above") {
    const targetItemIndex = list.findIndex((x) => x.id === location.target);
    const previousItem = list[targetItemIndex - 1];
    if (!previousItem) return {parent: null, index: 0};
    return listInsertLocationToTreeLocation(tree, {
      target: previousItem.id,
      side: "below",
      indentation: location.indentation,
    });
  }

  const reversedList = list.reverse();
  const listAbove = reversedList.slice(reversedList.findIndex((x) => x.id === location.target));

  const previousSibling =
    takeWhile(listAbove, (item) => item.indentation >= location.indentation).find(
      (item) => item.indentation === location.indentation,
    ) ?? null;

  if (previousSibling) {
    const previousSiblingParent = list.find((item) =>
      findNode(tree, item)?.children.find((child) => child.id === previousSibling.id),
    );

    const previousSiblingIndex = (
      (previousSiblingParent && findNode(tree, previousSiblingParent!))?.children ?? tree
    ).findIndex((child) => child.id === previousSibling.id);

    return {parent: previousSiblingParent?.id ?? null, index: previousSiblingIndex + 1};
  }

  const parent = listAbove.find((item) => item.indentation === location.indentation - 1) ?? null;
  if (parent === null) return null;

  return {parent: parent?.id ?? null, index: 0};
}

function moveNodeInTree<T extends {id: string}>(tree: Tree<T>, from: TreeLocation, to: TreeLocation): Tree<T> {
  if (from.parent === to.parent) {
    return updateChildren(tree, from.parent ? {id: from.parent} : null, (children) => {
      const updatedChildren = reposition(children, from.index, {index: to.index, side: "above"});
      return updatedChildren;
    });
  }

  const fromNode =
    from.parent === null ? tree[from.index] : findNode(tree, {id: from.parent})!.children[from.index];

  const removed = updateChildren(tree, from.parent ? {id: from.parent} : null, (children) =>
    children.filter((_, index) => index !== from.index),
  );

  const inserted = updateChildren(removed, to.parent ? {id: to.parent} : null, (children) => [
    ...children.slice(0, to.index),
    fromNode,
    ...children.slice(to.index),
  ]);

  return inserted;
}

export function moveInto<T extends {id: string}>(
  tree: Tree<T>,
  node: {id: string},
  parent: {id: string},
): Tree<T> {
  const from = {parent: null, index: tree.findIndex((x) => x.id === node.id)};
  const to = {parent: parent.id, index: findNode(tree, parent)?.children.length ?? 0};
  return moveNodeInTree(tree, from, to);
}

function indexInList<T extends {id: string}>(tree: Tree<T>, query: {id: string}): number {
  const list = toList(tree);
  return list.findIndex((x) => x.id === query.id);
}

export function moveItemInTree<T extends {id: string}>(
  tree: Tree<T>,
  source: {id: string},
  location: IndentedListInsertLocation,
): Tree<T> {
  if (location.side === "above" && indexInList(tree, {id: location.target}) === indexInList(tree, source) + 1) {
    return moveItemInTree(tree, source, {...location, target: source.id, side: "below"});
  }

  if (source.id === location.target && location.side === "below") {
    return moveItemInTree(tree, source, {...location, side: "above"});
  }

  const from = findNodeLocation(tree, source);
  if (!from) return tree;

  const to = listInsertLocationToTreeLocation(tree, location);
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

function takeWhile<T>(array: T[], predicate: (value: T, index: number) => boolean): T[] {
  let i = 0;
  while (i < array.length && predicate(array[i], i)) i++;
  return array.slice(0, i);
}

export function fromList<T>(list: IndentedList<T>): Tree<T> {
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

export function isDescendant<T extends {id: string}>(
  tree: Tree<T>,
  query: {id: string},
  ancestor: {id: string},
): boolean {
  const ancestorNode = findNode(tree, ancestor);
  if (!ancestorNode) return false;
  if (ancestorNode.children.find((child) => child.id === query.id)) return true;
  return ancestorNode.children.some((child) => isDescendant(tree, query, child));
}

export function anyAncestor<T extends {id: string}>(
  tree: Tree<T>,
  query: {id: string},
  predicate: (ancestor: TreeNode<T>) => boolean,
): boolean {
  const node = findNode(tree, query);
  if (!node) return false;
  if (predicate(node)) return true;
  const parent = findParent(tree, query);
  if (!parent) return false;
  return anyAncestor(tree, parent, predicate);
}
