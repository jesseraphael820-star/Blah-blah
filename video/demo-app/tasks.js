// Orbit — lógica do planejador de tarefas (módulo puro, testável)
export function createBoard() {
  return { tasks: [], nextId: 1 };
}

export function addTask(board, title, stage = 'ideia') {
  const clean = String(title).trim();
  if (!clean) throw new Error('Título vazio');
  const task = { id: board.nextId, title: clean, stage, done: false };
  return { tasks: [...board.tasks, task], nextId: board.nextId + 1 };
}

export function toggleTask(board, id) {
  return {
    ...board,
    tasks: board.tasks.map(t => (t.id === id ? { ...t, done: !t.done } : t)),
  };
}

export function progress(board) {
  if (board.tasks.length === 0) return 0;
  const done = board.tasks.filter(t => t.done).length;
  return Math.round((done / board.tasks.length) * 100);
}

export function byStage(board, stage) {
  return board.tasks.filter(t => t.stage === stage);
}
