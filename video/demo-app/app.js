import { createBoard, addTask, toggleTask, progress, byStage } from './tasks.js';

const STAGES = [['ideia', 'Ideia'], ['plano', 'Plano'], ['codigo', 'Código'], ['testes', 'Testes']];
let board = createBoard();
const $ = id => document.getElementById(id);

function render() {
  $('cols').innerHTML = STAGES.map(([key, label]) => {
    const items = byStage(board, key);
    return `<section class="col"><h2>${label}<span>${items.length}</span></h2>${items
      .map(t => `<div class="card ${t.done ? 'done' : ''}" data-id="${t.id}"><i></i><span>${t.title}</span></div>`)
      .join('')}</section>`;
  }).join('');
  const p = progress(board);
  $('pct').textContent = p + '%';
  $('bar').style.strokeDashoffset = 326.7 * (1 - p / 100);
}

$('form').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('title').value;
  if (!title.trim()) return;
  board = addTask(board, title, $('stage').value);
  $('title').value = '';
  render();
});

$('cols').addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) { board = toggleTask(board, Number(card.dataset.id)); render(); }
});

render();
