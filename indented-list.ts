export type Handle = {id: string};

export type TreeNode<D> = D & Handle & {id: string; children: TreeNode<D>[]};
export type Tree<D> = TreeNode<D>[];

export type IndentedListItem<D> = D & Handle & {indentation: number};
export type IndentedList<D> = IndentedListItem<D>[];

type TreeLocation = {parent: Handle | null; index: number};
export type IndentedListInsertLocation = {previousSibling: Handle | null; indentation: number};

function range(start: number, end: number): number[] {
  return Array.from(Array(end - start + 1), (_, i) => i + start);
}

function reposition<T>(list: T[], sourceIndex: number, targetIndex: number): T[] {
  return range(0, list.length - 1).map((i) => {
    const isUpwards = targetIndex <= sourceIndex;

    const adjustedTargetIndex = isUpwards ? targetIndex : targetIndex - 1;
    const adjustedSourceIndex = isUpwards ? sourceIndex + 1 : sourceIndex;

    if (i === adjustedTargetIndex) return list[sourceIndex]!;

    const isRemoved = i >= adjustedSourceIndex;
    const isInserted = i >= adjustedTargetIndex;

    const adjustment = (isRemoved ? +1 : 0) + (isInserted ? -1 : 0);

    return list[i + adjustment]!;
  });
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
  return matching[0] ?? null;
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
  if (location.previousSibling === null) return {parent: null, index: 0};

  const list = toList(tree);

  const reversedList = list.reverse();
  const listAbove = reversedList.slice(reversedList.findIndex((x) => x.id === location.previousSibling!.id));

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
    return updateChildren(tree, from.parent ?? null, (children) => reposition(children, from.index, to.index));
  }

  const fromNode = from.parent === null ? tree[from.index] : findNode(tree, from.parent)!.children[from.index];
  if (!fromNode) throw "error";

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
  if (source.id === location.previousSibling?.id) {
    return moveItemInTree(tree, source, {
      ...location,
      previousSibling: toList(tree)[indexInList(tree, source) - 1] ?? null,
    });
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
  if (location.previousSibling === null) return moveItemInTree(tree, source, {...location, indentation: 0});

  const realIndentation = toList(tree).find((item) => item.id === location.previousSibling?.id)?.indentation ?? 0;
  const sublistIndentation = list.find((item) => item.id === location.previousSibling?.id)?.indentation ?? 0;
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
  while (i < array.length && predicate(array[i]!, i)) i++;
  return array.slice(0, i);
}

export function validInsertLocationsBelow<D>(
  {tree, list}: {tree: Tree<D>; list: IndentedList<D>},
  source: Handle,
  targetIndex: number,
): IndentedListInsertLocation[] {
  if (targetIndex === -1) return [{indentation: 0, previousSibling: null}];

  const targetItem = list[targetIndex];
  if (!targetItem) throw "error";

  const isTargetDirectlyAboveSource = list[targetIndex + 1]?.id === source.id;
  if (isTargetDirectlyAboveSource)
    return validInsertLocationsBelow({tree, list}, source, targetIndex + 1).map((location) => ({
      ...location,
      previousSibling: {id: targetItem.id},
    }));

  const sourceItem = list.find((item) => item.id === source.id)!;

  const preceedingItem = list[targetIndex - 1];
  const preceedingItemIndentation = preceedingItem?.indentation ?? -1;

  const followingItems = list.slice(targetIndex + 1);
  const followingNonChildren = followingItems.filter((item) => !isDescendant(tree, item, source));
  const followingNonChild = followingNonChildren[0];
  const followingNonChildIndentation = followingNonChild?.indentation ?? 0;

  const isSource = targetItem.id === source.id;

  const minIndentation = followingNonChildIndentation;
  const maxIndentation = isDescendant(tree, targetItem, source)
    ? sourceItem.indentation
    : isSource
    ? Math.max(preceedingItemIndentation + 1, targetItem.indentation)
    : targetItem.indentation + 1;

  return range(minIndentation, maxIndentation).map((indentation) => ({
    indentation,
    previousSibling: {id: targetItem.id},
  }));
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

export function anyDescendant<D>(
  tree: Tree<D>,
  query: Handle,
  predicate: (descendant: TreeNode<D>) => boolean,
): boolean {
  const node = findNode(tree, query);
  if (!node) return false;
  if (predicate(node)) return true;
  return node.children.some((child) => anyDescendant(tree, child, predicate));
}
