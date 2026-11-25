import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, addTask, toggleTask, progress, byStage } from './tasks.js';

test('quadro novo começa vazio', () => {
  assert.equal(createBoard().tasks.length, 0);
});

test('progresso de quadro vazio é 0', () => {
  assert.equal(progress(createBoard()), 0);
});

test('adiciona tarefa com id incremental', () => {
  let b = addTask(createBoard(), 'Planejar');
  b = addTask(b, 'Programar');
  assert.deepEqual(b.tasks.map(t => t.id), [1, 2]);
});

test('rejeita título vazio', () => {
  assert.throws(() => addTask(createBoard(), '   '));
});

test('concluir metade das tarefas = 50%', () => {
  let b = addTask(addTask(createBoard(), 'A'), 'B');
  b = toggleTask(b, 1);
  assert.equal(progress(b), 50);
});

test('filtra por etapa', () => {
  let b = addTask(createBoard(), 'Testar', 'testes');
  b = addTask(b, 'Esboço', 'ideia');
  assert.equal(byStage(b, 'testes').length, 1);
});
