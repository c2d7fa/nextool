export type TreeNode<T> = T & {children: TreeNode<T>[]};
export type Tree<T> = TreeNode<T>[];

export type IndentedListItem<T> = T & {indentation: number};
export type IndentedList<T> = IndentedListItem<T>[];

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
