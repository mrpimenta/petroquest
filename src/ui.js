import { getState } from './store.js';
import { levelFromXp } from './gamification.js';
import { dueReviews } from './review.js';
import { loadQuestions, loadExamCatalog, filterQuestions, pickQuestions } from './questions.js';
import { registerAnswer } from './quiz.js';

const statsEl = document.querySelector('#stats');
const viewEl = document.querySelector('#view');
let activeExamId = null;
let activeSubject = null;

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setActiveTab(view) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
}

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

function examProgress(examId, questions) {
  const state = getState();
  const examQuestions = questions.filter(question => question.examId === examId);
  if (!examQuestions.length) return { done: 0, total: 0, percent: 0 };
  const done = examQuestions.filter(question => state.reviews[question.id]).length;
  return { done, total: examQuestions.length, percent: Math.round((done / examQuestions.length) * 100) };
}

export async function renderDashboard() {
  setActiveTab('dashboard');
  activeExamId = null;
  activeSubject = null;
  const [exams, questions] = await Promise.all([loadExamCatalog(), loadQuestions()]);

  viewEl.innerHTML = `
    <div class="page-heading">
      <div><h2>Escolha uma prova</h2><p>As duas provas ficam independentes para você enxergar evolução e lacunas em cada uma.</p></div>
    </div>
    <div class="exam-list">
      ${exams.map(exam => {
        const progress = examProgress(exam.id, questions);
        return `<button class="exam-card" type="button" data-exam-id="${escapeHtml(exam.id)}">
          <div class="exam-topline"><span class="exam-label">${escapeHtml(exam.label)}</span><span class="exam-year">${escapeHtml(exam.date)}</span></div>
          <h3>${escapeHtml(exam.title)}</h3>
          <p>${escapeHtml(exam.subtitle)}</p>
          <div class="exam-meta"><span>${escapeHtml(exam.board)}</span><span>${exam.questionCount} questões</span><span>${exam.subjects.length} matérias</span></div>
          <div class="exam-progress"><div class="progress-track"><div class="progress-fill" style="width:${progress.percent}%"></div></div><div class="progress-caption"><span>${progress.done} resolvidas no Petro Quest</span><span>${progress.percent}%</span></div></div>
        </button>`;
      }).join('')}
    </div>`;

  viewEl.querySelectorAll('[data-exam-id]').forEach(button => button.addEventListener('click', () => renderExam(button.dataset.examId)));
}

export async function renderExam(examId) {
  setActiveTab('dashboard');
  activeExamId = examId;
  activeSubject = null;
  const [exams, questions] = await Promise.all([loadExamCatalog(), loadQuestions()]);
  const exam = exams.find(item => item.id === examId);
  if (!exam) return renderDashboard();

  const examQuestions = questions.filter(question => question.examId === exam.id);
  viewEl.innerHTML = `
    <div class="breadcrumb"><button type="button" id="back-to-exams">Provas</button><span>›</span><span>${escapeHtml(exam.label)}</span></div>
    <div class="exam-detail-header">
      <div><h2>${escapeHtml(exam.title)}</h2><p>${escapeHtml(exam.subtitle)} · ${escapeHtml(exam.date)} · ${exam.questionCount} questões</p></div>
      <a class="secondary" href="${escapeHtml(exam.sourceUrl)}" target="_blank" rel="noreferrer">Abrir caderno original</a>
    </div>
    <div class="subject-grid">
      ${exam.subjects.map(subject => {
        const imported = examQuestions.filter(question => question.subject === subject.name).length;
        const expected = subject.count == null ? 'parte das 70 questões' : `${subject.count} na prova`;
        const status = imported ? `<span class="ready">${imported} pronta(s) para estudar</span>` : '<span class="pending">importação em preparação</span>';
        return `<button class="subject-card" type="button" data-subject="${escapeHtml(subject.name)}">
          <strong>${escapeHtml(subject.name)}</strong>
          <span>${expected}</span>
          ${status}
        </button>`;
      }).join('')}
    </div>`;

  viewEl.querySelector('#back-to-exams').addEventListener('click', renderDashboard);
  viewEl.querySelectorAll('[data-subject]').forEach(button => button.addEventListener('click', () => renderQuiz({ examId, subject: button.dataset.subject })));
}

function explanationHtml(explanation) {
  if (!explanation) return '<p>Resolução ainda não cadastrada.</p>';
  if (typeof explanation === 'string') return `<p>${escapeHtml(explanation)}</p>`;
  const summary = explanation.summary ? `<p>${escapeHtml(explanation.summary)}</p>` : '';
  const steps = Array.isArray(explanation.steps) && explanation.steps.length
    ? `<ol>${explanation.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` : '';
  const formula = explanation.formula ? `<div class="formula">${escapeHtml(explanation.formula)}</div>` : '';
  const takeaway = explanation.takeaway ? `<p><strong>Para lembrar:</strong> ${escapeHtml(explanation.takeaway)}</p>` : '';
  return `${summary}${steps}${formula}${takeaway}`;
}

export async function renderQuiz(filters = {}) {
  setActiveTab('quiz');
  const examId = filters.examId || activeExamId;
  const subject = filters.subject || activeSubject;
  activeExamId = examId || null;
  activeSubject = subject || null;

  const [allQuestions, exams] = await Promise.all([loadQuestions(), loadExamCatalog()]);
  const filtered = filterQuestions(allQuestions, { examId, subject });
  const questions = pickQuestions(filtered, filtered.length);
  const exam = exams.find(item => item.id === examId);

  if (!questions.length) {
    const sourceButton = exam ? `<a class="secondary" href="${escapeHtml(exam.sourceUrl)}" target="_blank" rel="noreferrer">Abrir prova original</a>` : '';
    viewEl.innerHTML = `<div class="notice"><div><h2>${subject ? escapeHtml(subject) : 'Banco de questões'}</h2><p>A estrutura do simulado já está pronta, mas as questões desta seleção ainda não foram liberadas no banco auditado.</p><p>Quando a transcrição e a resolução forem cadastradas, elas aparecerão aqui automaticamente, sem mudar o aplicativo.</p><div class="quiz-actions">${sourceButton}<button class="primary" id="back-from-empty" type="button">Voltar às provas</button></div></div></div>`;
    viewEl.querySelector('#back-from-empty').addEventListener('click', () => examId ? renderExam(examId) : renderDashboard());
    return;
  }

  let index = 0;
  const answered = new Set();

  const show = () => {
    const q = questions[index];
    viewEl.innerHTML = `<div class="study-shell">
      <aside class="study-sidebar">
        <h3>${escapeHtml(exam?.label || q.examLabel || 'Simulado')}</h3>
        <p>${escapeHtml(subject || q.subject)} · ${questions.length} questão(ões)</p>
        <div class="question-nav">${questions.map((item, i) => `<button type="button" data-go="${i}" class="${i === index ? 'active' : ''} ${answered.has(item.id) ? 'done' : ''}" aria-label="Ir para a questão ${i + 1}">${i + 1}</button>`).join('')}</div>
      </aside>
      <article class="question-card">
        <div class="question-kicker"><span>Questão ${q.number ?? index + 1}</span><span>${escapeHtml(q.subject)}</span>${q.topic ? `<span>${escapeHtml(q.topic)}</span>` : ''}</div>
        <h2>${escapeHtml(q.prompt)}</h2>
        ${q.context ? `<div class="question-context">${escapeHtml(q.context)}</div>` : ''}
        <div class="answers">${q.options.map((option, i) => `<button class="answer" data-answer="${i}" type="button"><strong>${String.fromCharCode(65 + i)}.</strong> ${escapeHtml(option)}</button>`).join('')}</div>
        <button class="secondary" id="dont-know" type="button">Ainda não sei</button>
        <div id="feedback"></div>
      </article>
    </div>`;

    viewEl.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => { index = Number(button.dataset.go); show(); }));
    viewEl.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => answer(Number(button.dataset.answer), false)));
    viewEl.querySelector('#dont-know').addEventListener('click', () => answer(-1, true));
  };

  const answer = (selectedIndex, dontKnow) => {
    const q = questions[index];
    const result = registerAnswer(q, selectedIndex, { dontKnow });
    answered.add(q.id);
    const buttons = [...viewEl.querySelectorAll('[data-answer]')];
    buttons.forEach((button, i) => {
      button.disabled = true;
      if (i === q.correctIndex) button.classList.add('correct');
      if (!dontKnow && i === selectedIndex && i !== q.correctIndex) button.classList.add('wrong');
    });
    viewEl.querySelector('#dont-know').disabled = true;

    const feedback = viewEl.querySelector('#feedback');
    feedback.className = 'feedback';
    feedback.innerHTML = `<h3>${result.correct ? 'Correto.' : dontKnow ? 'Boa: vamos reforçar esta.' : 'Resposta incorreta.'}</h3>
      ${explanationHtml(q.explanation)}
      <small>Fonte auditada: ${escapeHtml(result.source)}</small>
      <div class="quiz-actions"><button id="next-question" class="primary" type="button">${index + 1 < questions.length ? 'Próxima questão' : 'Concluir bloco'}</button></div>`;
    viewEl.querySelector('#next-question').addEventListener('click', () => {
      if (index + 1 < questions.length) { index += 1; show(); }
      else if (examId) renderExam(examId);
      else renderDashboard();
    });
    renderStats();
  };

  show();
}

export async function renderReview() {
  setActiveTab('review');
  const state = getState();
  const due = dueReviews(state.reviews);
  viewEl.innerHTML = `<div class="page-heading"><div><h2>Revisão</h2><p>O Petro Quest reapresenta erros em 1 · 3 · 7 · 14 · 30 dias.</p></div></div><div class="notice"><div><h2>${due.length} revisão(ões) vencida(s)</h2><p>Erros acumulados: ${state.errors.length}. Marcadas como “Ainda não sei”: ${state.dontKnow.length}.</p></div></div>`;
}

export async function renderSyllabus() {
  setActiveTab('syllabus');
  const exams = await loadExamCatalog();
  viewEl.innerHTML = `<div class="page-heading"><div><h2>Matérias por prova</h2><p>O conteúdo é mantido separado para não misturar o perfil de cobrança de 2018 com o de 2023.</p></div></div>
    ${exams.map(exam => `<section class="topic"><header><strong>${escapeHtml(exam.label)} · ${escapeHtml(exam.title)}</strong><span>${exam.questionCount} questões</span></header><p>${exam.subjects.map(subject => `${escapeHtml(subject.name)}${subject.count == null ? '' : ` (${subject.count})`}`).join(' · ')}</p></section>`).join('')}`;
}

export function bindNavigation() {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', async () => {
    const views = { dashboard: renderDashboard, quiz: () => renderQuiz(), review: renderReview, syllabus: renderSyllabus };
    await views[tab.dataset.view]();
  }));

  document.querySelector('.brand').addEventListener('click', renderDashboard);
  document.querySelector('#start-session').addEventListener('click', async () => {
    if (activeExamId) await renderExam(activeExamId);
    else await renderDashboard();
  });
}
