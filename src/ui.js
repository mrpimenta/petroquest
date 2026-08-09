import { getState } from './store.js';
import { levelFromXp } from './gamification.js';
import { dueReviews } from './review.js';
import { loadQuestions, pickQuestions } from './questions.js';
import { registerAnswer } from './quiz.js';

const statsEl = document.querySelector('#stats');
const viewEl = document.querySelector('#view');

export function renderStats() {
  const state = getState();
  const accuracy = state.answered ? Math.round((state.correct / state.answered) * 100) : 0;
  const { level } = levelFromXp(state.xp);
  const values = [
    ['XP', state.xp],
    ['Nível', level],
    ['Acerto', `${accuracy}%`],
    ['Revisões', dueReviews(state.reviews).length]
  ];
  statsEl.innerHTML = values.map(([label, value]) => `<article class="stat"><strong>${value}</strong><span>${label}</span></article>`).join('');
}

export async function renderDashboard() {
  const [questions, targetResponse] = await Promise.all([
    loadQuestions(),
    fetch('/data/target.json')
  ]);
  const target = targetResponse.ok ? await targetResponse.json() : null;
  const targetCard = target ? `
      <li class="topic"><header><strong>${target.company} · ${target.process}</strong><span class="badge">alvo principal</span></header><p><strong>${target.emphasis}</strong> · ${target.level}</p><p>${target.targetPole}</p><small>${target.status}</small></li>` : '';
  viewEl.innerHTML = `<div class="toolbar"><div><h2>Painel de estudos</h2><p>${questions.length} questões auditadas disponíveis.</p></div></div>
    <ul class="topic-list">
      ${targetCard}
      <li class="topic"><header><strong>Questões verificadas</strong><span class="badge">fonte obrigatória</span></header><p>O banco inicial está vazio de propósito. PDFs e provas serão importados após auditoria.</p></li>
      <li class="topic"><header><strong>Revisão espaçada</strong><span>1 · 3 · 7 · 14 · 30 dias</span></header><p>Erros e “Ainda não sei” retornam automaticamente.</p></li>
      <li class="topic"><header><strong>Modo offline</strong><span>ativo</span></header><p>O progresso fica no aparelho e entra na fila de sincronização.</p></li>
    </ul>`;
}

export async function renderQuiz() {
  const questions = pickQuestions(await loadQuestions(), 5);
  if (!questions.length) {
    viewEl.innerHTML = '<div class="empty"><div><h2>Banco ainda sem questões auditadas</h2><p>Adicione provas com fonte, gabarito e rastreabilidade em <code>data/questions.json</code>.</p></div></div>';
    return;
  }
  let index = 0;
  const show = () => {
    const q = questions[index];
    viewEl.innerHTML = `<article class="question-card"><p class="eyebrow">${q.exam} · ${q.subject}</p><h2>${q.prompt}</h2><div class="answers">${q.options.map((option, i) => `<button class="answer" data-answer="${i}" type="button">${String.fromCharCode(65 + i)}. ${option}</button>`).join('')}</div><button class="secondary" id="dont-know" type="button">Ainda não sei</button><div id="feedback"></div></article>`;
    viewEl.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => answer(Number(button.dataset.answer), false)));
    viewEl.querySelector('#dont-know').addEventListener('click', () => answer(-1, true));
  };
  const answer = (selectedIndex, dontKnow) => {
    const result = registerAnswer(questions[index], selectedIndex, { dontKnow });
    const feedback = viewEl.querySelector('#feedback');
    feedback.className = 'feedback';
    feedback.innerHTML = `<strong>${result.correct ? 'Correto.' : dontKnow ? 'Marcado para reforço.' : 'Resposta incorreta.'}</strong><p>${result.explanation}</p><small>Fonte: ${result.source}</small><p><button id="next-question" class="primary" type="button">${index + 1 < questions.length ? 'Próxima' : 'Concluir'}</button></p>`;
    viewEl.querySelectorAll('button').forEach(button => { if (button.id !== 'next-question') button.disabled = true; });
    viewEl.querySelector('#next-question').addEventListener('click', () => { index += 1; index < questions.length ? show() : renderDashboard(); });
    renderStats();
  };
  show();
}

export async function renderReview() {
  const state = getState();
  const due = dueReviews(state.reviews);
  viewEl.innerHTML = `<h2>Revisão</h2><p><strong>${due.length}</strong> item(ns) vencido(s) para revisar.</p><p>Erros acumulados: ${state.errors.length}. Marcados como “Ainda não sei”: ${state.dontKnow.length}.</p>`;
}

export async function renderSyllabus() {
  const response = await fetch('/data/syllabus.json');
  const data = await response.json();
  viewEl.innerHTML = `<h2>Mapa de conteúdo</h2><p>${data.notice}</p><ul class="topic-list">${data.tracks.map(track => `<li class="topic"><header><strong>${track.name}</strong><span class="badge">${track.status}</span></header><p>${track.description}</p><small>${track.topics.length} tópico(s) provisório(s)</small></li>`).join('')}</ul>`;
}

export function bindNavigation() {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', async () => {
    document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
    const views = { dashboard: renderDashboard, quiz: renderQuiz, review: renderReview, syllabus: renderSyllabus };
    await views[tab.dataset.view]();
  }));
  document.querySelector('#start-session').addEventListener('click', () => {
    document.querySelector('[data-view="quiz"]').click();
  });
}
