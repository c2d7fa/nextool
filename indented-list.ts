export type Handle = {id: string};

export type TreeNode<D> = D & Handle & {id: string; children: TreeNode<D>[]};
export type Tree<D> = TreeNode<D>[];

export type IndentedListItem<D> = D & Handle & {indentation: number};
export type IndentedList<D> = IndentedListItem<D>[];

type TreeLocation = {parent: Handle | null; index: number};
export type IndentedListInsertLocation = {side: "above" | "below"; target: Handle | null; indentation: number};

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

export function filterNodes<D>(tree: Tree<D>, pred: (node: TreeNode<D>) => boolean): TreeNode<D>[] {
  let result: TreeNode<D>[] = [];
  function filter(node: TreeNode<D>): void {
    if (pred(node)) result.push(node);
    node.children.forEach(filter);
  }
  tree.forEach(filter);
  return result;
}

export function findNode<D>(tree: Tree<D>, query: Handle): TreeNode<D> | null {
  const matching = filterNodes(tree, (node) => node.id === query.id);
  return matching.length === 0 ? null : matching[0];
}

export function updateNode<D>(tree: Tree<D>, query: Handle, update: (x: TreeNode<D>) => TreeNode<D>): Tree<D> {
  return tree.map((node) => {
    if (node.id === query.id) {
      return {...node, ...update(node)};
    }
    return {...node, children: updateNode(node.children, query, update)};
  });
}

function updateChildren<D>(
  tree: Tree<D>,
  parent: Handle | null,
  update: (x: TreeNode<D>[]) => TreeNode<D>[],
): Tree<D> {
  if (parent === null) return update(tree);
  return updateNode(tree, parent, (node) => ({...node, children: updateChildren(node.children, null, update)}));
}

function findNodeLocation<D>(tree: Tree<D>, query: Handle): TreeLocation | null {
  const index = tree.findIndex((node) => node.id === query.id);
  if (index !== -1) return {parent: null, index};

  for (const parent of tree) {
    const location = findNodeLocation(parent.children, query);
    if (location) return {parent: location.parent ?? parent, index: location.index};
  }

  return null;
}

export function findParent<D>(tree: Tree<D>, query: Handle): TreeNode<D> | null {
  const parent = findNodeLocation(tree, query)?.parent ?? null;
  return parent === null ? null : findNode(tree, parent);
}

function listInsertLocationToTreeLocation<D>(
  tree: Tree<D>,
  location: IndentedListInsertLocation,
): TreeLocation | null {
  if (location.target === null) return {parent: null, index: 0};

  const list = toList(tree);

  if (location.side === "above") {
    const targetItemIndex = list.findIndex((x) => x.id === location.target!.id);
    const previousItem = list[targetItemIndex - 1] ?? null;
    return listInsertLocationToTreeLocation(tree, {
      target: previousItem,
      side: "below",
      indentation: location.indentation,
    });
  }

  const reversedList = list.reverse();
  const listAbove = reversedList.slice(reversedList.findIndex((x) => x.id === location.target!.id));

  const previousSibling =
    takeWhile(listAbove, (item) => item.indentation >= location.indentation).find(
      (item) => item.indentation === location.indentation,
    ) ?? null;

  if (previousSibling) {
    const previousSiblingParent =
      list.find((item) => findNode(tree, item)?.children.find((child) => child.id === previousSibling.id)) ?? null;

    const previousSiblingIndex = (
      (previousSiblingParent && findNode(tree, previousSiblingParent))?.children ?? tree
    ).findIndex((child) => child.id === previousSibling.id);

    return {parent: previousSiblingParent, index: previousSiblingIndex + 1};
  }

  const parent = listAbove.find((item) => item.indentation === location.indentation - 1) ?? null;
  return {parent, index: 0};
}

function moveNodeInTree<D>(tree: Tree<D>, from: TreeLocation, to: TreeLocation): Tree<D> {
  if (from.parent === to.parent) {
    return updateChildren(tree, from.parent ?? null, (children) => {
      const updatedChildren = reposition(children, from.index, {index: to.index, side: "above"});
      return updatedChildren;
    });
  }

  const fromNode = from.parent === null ? tree[from.index] : findNode(tree, from.parent)!.children[from.index];

  const removed = updateChildren(tree, from.parent ?? null, (children) =>
    children.filter((_, index) => index !== from.index),
  );

  const inserted = updateChildren(removed, to.parent ?? null, (children) => [
    ...children.slice(0, to.index),
    fromNode,
    ...children.slice(to.index),
  ]);

  return inserted;
}

export function moveInto<D>(tree: Tree<D>, node: Handle, parent: Handle): Tree<D> {
  const from = {parent: null, index: tree.findIndex((x) => x.id === node.id)};
  const to = {parent, index: findNode(tree, parent)?.children.length ?? 0};
  return moveNodeInTree(tree, from, to);
}

function indexInList<D>(tree: Tree<D>, query: Handle): number {
  const list = toList(tree);
  return list.findIndex((x) => x.id === query.id);
}

export function moveItemInTree<D>(tree: Tree<D>, source: Handle, location: IndentedListInsertLocation): Tree<D> {
  if (
    location.side === "above" &&
    location.target &&
    indexInList(tree, location.target) === indexInList(tree, source) + 1
  ) {
    return moveItemInTree(tree, source, {...location, target: source, side: "below"});
  }

  if (source.id === location.target?.id && location.side === "below") {
    return moveItemInTree(tree, source, {...location, side: "above"});
  }

  const from = findNodeLocation(tree, source);
  if (!from) return tree;

  const to = listInsertLocationToTreeLocation(tree, location);
  if (!to) return tree;

  return moveNodeInTree(tree, from, to);
}

export function moveItemInSublistOfTree<D>(
  {tree, list}: {tree: Tree<D>; list: IndentedList<D>},
  source: Handle,
  location: IndentedListInsertLocation,
): Tree<D> {
  if (location.target === null) return moveItemInTree(tree, source, {...location, indentation: 0});

  const asBelowTarget =
    location.side === "below" ? location.target : toList(tree)[indexInList(tree, location.target) - 1] ?? null;

  const realIndentation = toList(tree).find((item) => item.id === asBelowTarget?.id)?.indentation ?? 0;
  const sublistIndentation = list.find((item) => item.id === asBelowTarget?.id)?.indentation ?? 0;
  const indentation = realIndentation - sublistIndentation + location.indentation;

  return moveItemInTree(tree, source, {...location, indentation});
}

export function merge<D>(tree: Tree<D>, patches: (Handle & Partial<D>)[]): Tree<D> {
  return patches.reduce((result, patch) => updateNode(result, patch, (node) => ({...node, ...patch})), tree);
}

export function toList<D>(roots: Tree<D>, indentation?: number): IndentedList<D> {
  return roots.reduce(
    (result, node) => [
      ...result,
      {...node, indentation: indentation ?? 0},
      ...toList(node.children, (indentation ?? 0) + 1),
    ],
    [] as IndentedList<D>,
  );
}

function takeWhile<T>(array: T[], predicate: (value: T, index: number) => boolean): T[] {
  let i = 0;
  while (i < array.length && predicate(array[i], i)) i++;
  return array.slice(0, i);
}

export function isDescendant<D>(tree: Tree<D>, query: Handle, ancestor: Handle): boolean {
  const ancestorNode = findNode(tree, ancestor);
  if (!ancestorNode) return false;
  if (ancestorNode.children.find((child) => child.id === query.id)) return true;
  return ancestorNode.children.some((child) => isDescendant(tree, query, child));
}

export function anyAncestor<D>(
  tree: Tree<D>,
  query: Handle,
  predicate: (ancestor: TreeNode<D>) => boolean,
): boolean {
  const node = findNode(tree, query);
  if (!node) return false;
  if (predicate(node)) return true;
  const parent = findParent(tree, query);
  if (!parent) return false;
  return anyAncestor(tree, parent, predicate);
}
