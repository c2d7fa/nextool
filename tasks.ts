export type Task = {
  id: string;
  title: string;
  done?: boolean;
  action?: boolean;
};

export type Tasks = Task[];

export function merge(tasks: Tasks, updates: Partial<Task>[]): Tasks {
  return tasks.map((task) => {
    const update = updates.find((u) => u.id === task.id);
    return update ? {...task, ...update} : task;
  });
}
