export type Handle = {id: string};

export type TreeNode<D> = D & Handle & {children: TreeNode<D>[]};
export type Tree<D> = {
  roots: Handle[];
  data: {[id: string]: D};
  children: {[id: string]: Handle[]};
  parents: {[id: string]: Handle | null};
};

export type IndentedListItem<D> = TreeNode<D> & {indentation: number};
export type IndentedList<D> = IndentedListItem<D>[];

type TreeLocation = {parent: Handle | null; index: number};
export type IndentedListInsertLocation = {previousSibling: Handle | null; indentation: number};

export function empty<D>(): Tree<D> {
  return {roots: [], data: {}, children: {}, parents: {}};
}

function registerNode<D>(tree: Tree<D>, node: TreeNode<D>, {parent}: {parent: Handle | null}): Tree<D> {
  function register_(tree: Tree<D>, node: TreeNode<D>, {parent}: {parent: Handle | null}): Tree<D> {
    let result = {...tree, data: {...tree.data, [node.id]: {...node}}};
    result = {...result, parents: {...tree.parents, [node.id]: parent}};
    result = {...result, children: {...tree.children, [node.id]: node.children.map((x) => ({id: x.id}))}};
    for (const child of node.children) {
      result = register_(result, child, {parent: {id: node.id}});
    }
    return result;
  }
  return register_(tree, node, {parent});
}

export function insert<D>(tree: Tree<D>, node: TreeNode<D>): Tree<D> {
  let result = registerNode(tree, node, {parent: null});
  return {...result, roots: [...result.roots, {id: node.id}]};
}

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

export function pickIntoList<D>(tree: Tree<D>, pick: (node: TreeNode<D>) => boolean): IndentedList<D> {
  function search(nodes: TreeNode<D>[]): TreeNode<D>[] {
    return nodes.flatMap((node) => {
      if (pick(node)) return [{...node, children: node.children}];
      else return search(node.children);
    });
  }

  return toList(search(roots(tree)));
}

export function zoomIntoList<D>(tree: Tree<D>, root: null | {id: string}): IndentedList<D> {
  function isChildOf<D>(tree: Tree<D>, child: {id: string}, parent: {id: string}): boolean {
    return tree.parents[child.id]?.id === parent.id;
  }

  return pickIntoList(tree, (node) => (root ? isChildOf(tree, node, root) : true));
}

export function filterList<D>(
  list: IndentedList<D>,
  include: (node: IndentedListItem<D>) => boolean,
): IndentedList<D> {
  let result: IndentedListItem<D>[] = [];
  let index = 0;

  function skipSubtree() {
    const indentation = list[index]!.indentation;
    index++;
    while (index < list.length && list[index]!.indentation > indentation) index++;
  }

  while (index < list.length) {
    const node = list[index]!;
    if (!include(node)) {
      skipSubtree();
    } else {
      result.push(node);
      index++;
    }
  }

  return result;
}

export function anyDescendantInList<D>(
  list: IndentedList<D>,
  item: Handle,
  predicate: (descendant: IndentedListItem<D>) => boolean,
) {
  let index = list.findIndex((i) => i.id === item.id);
  if (index === -1) return false;

  const rootIndendation = list[index]!.indentation;

  const rootNode = list[index]!;
  if (predicate(rootNode)) return true;

  for (let i = index + 1; i < list.length; i++) {
    const node = list[i]!;
    if (node.indentation <= rootIndendation) break;
    if (predicate(node)) return true;
  }

  return false;
}

export function filterNodes<D>(tree: Tree<D>, pred: (node: TreeNode<D>) => boolean): TreeNode<D>[] {
  let result: TreeNode<D>[] = [];
  function filter(handle: Handle): void {
    const node = findNode(tree, handle)!;
    if (pred(node)) result.push(node);
    node.children.forEach(filter);
  }
  tree.roots.forEach(filter);
  return result;
}

export function findNode<D>(tree: Tree<D>, query: Handle): TreeNode<D> | null {
  function find(handle: Handle): TreeNode<D> | null {
    const data = tree.data[handle.id];
    if (!data) return null;
    const children = (tree.children[handle.id] ?? []).map((child) => find(child)!);
    return {...data, id: handle.id, children};
  }
  return find(query);
}

export function updateNode<D>(tree: Tree<D>, query: Handle, update: (x: TreeNode<D>) => TreeNode<D>): Tree<D> {
  const oldNode = findNode(tree, query)!;
  const newNode = update(oldNode);

  // Performance optimization: when not updating children, there is no need to
  // register or deregister any nodes.
  if (newNode.children === oldNode.children) {
    return {...tree, data: {...tree.data, [query.id]: newNode}};
  } else {
    // [TODO] Deregister old children
    return registerNode(tree, update(findNode(tree, query)!), {parent: tree.parents[query.id] ?? null});
  }
}

export function roots<D>(tree: Tree<D>): TreeNode<D>[] {
  return tree.roots.map((handle) => findNode(tree, handle)!);
}

function updateChildren<D>(
  tree: Tree<D>,
  parent: Handle | null,
  update: (x: TreeNode<D>[]) => TreeNode<D>[],
): Tree<D> {
  if (parent === null) {
    // [TODO] Deregister old roots
    let result = tree;
    const newRoots = update(roots(tree));
    for (const root of newRoots) {
      result = registerNode(result, root, {parent: null});
    }
    return {...result, roots: newRoots.map((x) => ({id: x.id}))};
  } else {
    return updateNode(tree, parent, (node) => ({...node, children: update(node.children)}));
  }
}

function findNodeLocation<D>(tree: Tree<D>, query: Handle): TreeLocation | null {
  function findLocation_(nodes: TreeNode<D>[], parent: Handle | null): TreeLocation | null {
    for (const [index, node] of nodes.entries()) {
      if (node.id === query.id) return {parent, index};
      const result = findLocation_(node.children, node);
      if (result) return result;
    }
    return null;
  }

  return findLocation_(roots(tree), null);
}

export function findParent<D>(tree: Tree<D>, query: Handle): TreeNode<D> | null {
  const parent = tree.parents[query.id];
  if (!parent) return null;
  return findNode(tree, parent);
}

function listInsertLocationToTreeLocation<D>(
  tree: Tree<D>,
  location: IndentedListInsertLocation,
): TreeLocation | null {
  if (location.previousSibling === null) return {parent: null, index: 0};

  const list = toList(roots(tree));

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
      (previousSiblingParent && findNode(tree, previousSiblingParent))?.children ?? roots(tree)
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

  const fromNode =
    from.parent === null ? roots(tree)[from.index] : findNode(tree, from.parent)!.children[from.index];
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
  const from = findNodeLocation(tree, node);
  const to = {parent, index: tree.children[parent.id]?.length ?? 0};
  if (!from) throw {error: "Unable to move node, because it does not exist."};
  return moveNodeInTree(tree, from, to);
}

function indexInList<D>(tree: Tree<D>, query: Handle): number {
  const list = toList(roots(tree));
  return list.findIndex((x) => x.id === query.id);
}

export function moveItemInTree<D>(tree: Tree<D>, source: Handle, location: IndentedListInsertLocation): Tree<D> {
  if (source.id === location.previousSibling?.id) {
    return moveItemInTree(tree, source, {
      ...location,
      previousSibling: toList(roots(tree))[indexInList(tree, source) - 1] ?? null,
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
  {sublistRoot}: {sublistRoot: Handle | null},
): Tree<D> {
  if (location.previousSibling === null) {
    const realRootIndentation = toList(roots(tree)).find((item) => item.id === sublistRoot?.id)?.indentation ?? 0;
    const indentation = realRootIndentation + 1;
    return moveItemInTree(tree, source, {previousSibling: sublistRoot, indentation});
  }

  const realIndentation =
    toList(roots(tree)).find((item) => item.id === location.previousSibling?.id)?.indentation ?? 0;
  const sublistIndentation = list.find((item) => item.id === location.previousSibling?.id)?.indentation ?? 0;
  const indentation = realIndentation - sublistIndentation + location.indentation;

  return moveItemInTree(tree, source, {...location, indentation});
}

export function merge<D>(tree: Tree<D>, patches: (Handle & Partial<D>)[]): Tree<D> {
  return patches.reduce((result, patch) => updateNode(result, patch, (node) => ({...node, ...patch})), tree);
}

export function toList<D>(roots: TreeNode<D>[], indentation?: number): IndentedList<D> {
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
  {tree, list}: {tree: Tree<D>; list: (Handle & {indentation: number})[]},
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

  const sourceItem = list.find((item) => item.id === source.id);

  const preceedingItem = list[targetIndex - 1];
  const preceedingItemIndentation = preceedingItem?.indentation ?? -1;

  const followingItems = list.slice(targetIndex + 1);
  const followingNonChild = followingItems.find((item) => !isDescendantInList(list, item, source));
  const followingNonChildIndentation = followingNonChild?.indentation ?? 0;

  const isSource = targetItem.id === source.id;

  const minIndentation = followingNonChildIndentation;
  const maxIndentation = isDescendant(tree, targetItem, source)
    ? sourceItem?.indentation ?? 0
    : isSource
    ? Math.max(preceedingItemIndentation + 1, targetItem.indentation)
    : targetItem.indentation + 1;

  return range(minIndentation, maxIndentation).map((indentation) => ({
    indentation,
    previousSibling: {id: targetItem.id},
  }));
}

export function isDescendant<D>(tree: Tree<D>, query: Handle, ancestor: Handle): boolean {
  const ancestorChildren = tree.children[ancestor.id] ?? [];
  return ancestorChildren.some((child) => child.id === query.id || isDescendant(tree, query, child));
}

export function isDescendantInList<D>(
  list: (Handle & {indentation: number})[],
  query: Handle,
  ancestor: Handle,
): boolean {
  let i = 0;

  while (i < list.length) {
    if (list[i]!.id === query.id) return false;
    if (list[i]!.id === ancestor.id) break;
    i++;
  }

  if (i === list.length) return false;

  const ancestorIndentation = list[i]!.indentation;
  i++;

  while (i < list.length) {
    if (list[i]!.indentation <= ancestorIndentation) return false;
    if (list[i]!.id === query.id) return true;
    i++;
  }

  return false;
}

export function anyAncestor<D>(tree: Tree<D>, query: Handle, predicate: (ancestor: D) => boolean): boolean {
  const node = tree.data[query.id];
  if (!node) return false;
  if (predicate(node)) return true;
  const parent = tree.parents[query.id];
  if (!parent) return false;
  return anyAncestor(tree, parent, predicate);
}

export function anyDescendant<D>(
  tree: Tree<D>,
  node: Handle,
  predicate: (descendant: Handle & D) => boolean,
): boolean {
  function anyDescendant_({id}: Handle) {
    const node = tree.data[id];
    if (!node) return false;
    if (predicate({...node, id})) return true;
    const children = tree.children[id];
    if (!children) return false;
    return children.some(anyDescendant_);
  }

  const children = tree.children[node.id];
  if (!children) return false;
  return children.some(anyDescendant_);
}
