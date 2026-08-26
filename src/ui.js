import { getState } from './store.js';
import { levelFromXp } from './gamification.js';
import { dueReviews } from './review.js';
import { loadQuestions, loadExamCatalog, loadPassages, filterQuestions, pickQuestions } from './questions.js';
import { registerAnswer } from './quiz.js';

const statsEl = document.querySelector('#stats');
const viewEl = document.querySelector('#view');
let activeExamId = null;
let activeSubject = null;

const studyEnhancements = document.createElement('style');
studyEnhancements.textContent = `
  .source-status { color: var(--success) !important; font-weight: 700; }
  .passage { margin: 0 0 1rem; border: 1px solid var(--line); border-radius: 14px; background: #f9fbfa; overflow: hidden; }
  .passage summary { min-height: 48px; display: flex; align-items: center; padding: .75rem .9rem; cursor: pointer; font-weight: 800; color: var(--brand); }
  .passage-body { max-height: 360px; overflow: auto; padding: .2rem 1rem 1rem; white-space: pre-wrap; line-height: 1.62; font-size: .96rem; color: #35443e; }
  .question-card h2, .question-context, .answer { white-space: pre-line; }
  .question-figure { margin: 1rem 0; padding: .75rem; border: 1px solid var(--line); border-radius: 14px; background: #fff; text-align: center; overflow: auto; }
  .question-figure img { display: block; max-width: 100%; height: auto; margin: 0 auto; }
  .resolution-summary { font-size: 1.02rem; }
  .resolution-block { margin-top: .9rem; }
  .resolution-block h4 { margin: 0 0 .45rem; color: var(--brand); }
  .resolution-block ol, .resolution-block ul { margin: .3rem 0 .5rem; padding-left: 1.3rem; }
  .resolution-block li { margin: .38rem 0; line-height: 1.5; }
  .takeaway { margin-top: .9rem !important; padding: .7rem .8rem; border-radius: 10px; background: #fff; border: 1px solid var(--line); }
  .annulled-badge { color: #7d4b00; background: #fff0cf; border: 1px solid #ead39e; border-radius: 999px; padding: .1rem .48rem; font-weight: 800; }
  .annulled-feedback { border-left-color: var(--warn); background: #fff8e8; }
  .answer:disabled { cursor: default; opacity: .88; }
  @media (min-width: 900px) and (max-width: 1250px) {
    .passage-body { max-height: 310px; }
    .question-card { padding: 1.15rem; }
  }
  @media (max-width: 899px) {
    .passage-body { max-height: 300px; }
  }
`;
document.head.appendChild(studyEnhancements);

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
  const done = examQuestions.filter(question => question.status === 'annulled' || state.reviews[question.id]).length;
  return { done, total: examQuestions.length, percent: Math.round((done / examQuestions.length) * 100) };
}

export async function renderDashboard() {
  setActiveTab('dashboard');
  activeExamId = null;
  activeSubject = null;
  const [exams, questions] = await Promise.all([loadExamCatalog(), loadQuestions()]);

  viewEl.innerHTML = `
    <div class="page-heading">
      <div><h2>Escolha uma prova</h2><p>Cada caderno fica independente para você enxergar evolução e lacunas sem misturar os perfis da Cesgranrio.</p></div>
    </div>
    <div class="exam-list">
      ${exams.map(exam => {
        const progress = examProgress(exam.id, questions);
        return `<button class="exam-card" type="button" data-exam-id="${escapeHtml(exam.id)}">
          <div class="exam-topline"><span class="exam-label">${escapeHtml(exam.label)}</span><span class="exam-year">${escapeHtml(exam.date)}</span></div>
          <h3>${escapeHtml(exam.title)}</h3>
          <p>${escapeHtml(exam.subtitle)}</p>
          <div class="exam-meta"><span>${escapeHtml(exam.board)}</span><span>${exam.questionCount} questões</span><span>${exam.subjects.length} matérias</span></div>
          <div class="exam-progress"><div class="progress-track"><div class="progress-fill" style="width:${progress.percent}%"></div></div><div class="progress-caption"><span>${progress.done} de ${progress.total || exam.questionCount} disponíveis/concluídas</span><span>${progress.percent}%</span></div></div>
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
      <div><h2>${escapeHtml(exam.title)}</h2><p>${escapeHtml(exam.subtitle)} · ${escapeHtml(exam.date)} · ${exam.questionCount} questões</p>${exam.sourceStatus ? `<p class="source-status">${escapeHtml(exam.sourceStatus)}</p>` : ''}</div>
      <a class="secondary" href="${escapeHtml(exam.sourceUrl)}" target="_blank" rel="noreferrer">Abrir referência externa</a>
    </div>
    <div class="subject-grid">
      ${exam.subjects.map(subject => {
        const imported = examQuestions.filter(question => question.subject === subject.name).length;
        const expected = subject.count == null ? 'parte das 70 questões' : `${subject.count} na prova`;
        const status = imported === subject.count
          ? `<span class="ready">${imported} pronta(s) para estudar</span>`
          : imported
            ? `<span class="ready">${imported} importada(s)</span>`
            : '<span class="pending">aguardando importação</span>';
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
  const summary = explanation.summary ? `<p class="resolution-summary">${escapeHtml(explanation.summary)}</p>` : '';
  const steps = Array.isArray(explanation.steps) && explanation.steps.length
    ? `<div class="resolution-block"><h4>Passo a passo</h4><ol>${explanation.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></div>` : '';
  const formula = explanation.formula ? `<div class="formula">${escapeHtml(explanation.formula)}</div>` : '';
  const alternativeNotes = Array.isArray(explanation.alternatives) && explanation.alternatives.length
    ? `<div class="resolution-block alternative-notes"><h4>Por que as outras não servem</h4><ul>${explanation.alternatives.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul></div>` : '';
  const takeaway = explanation.takeaway ? `<p class="takeaway"><strong>Para lembrar:</strong> ${escapeHtml(explanation.takeaway)}</p>` : '';
  return `${summary}${steps}${formula}${alternativeNotes}${takeaway}`;
}

function passageHtml(passage) {
  if (!passage) return '';
  return `<details class="passage" open>
    <summary>Texto-base · ${escapeHtml(passage.title)}</summary>
    <div class="passage-body">${escapeHtml(passage.text)}</div>
  </details>`;
}

function figureHtml(figure) {
  if (!figure?.src) return '';
  return `<figure class="question-figure"><img src="${escapeHtml(figure.src)}" alt="${escapeHtml(figure.alt || 'Figura da questão')}"></figure>`;
}

export async function renderQuiz(filters = {}) {
  setActiveTab('quiz');
  const examId = filters.examId || activeExamId;
  const subject = filters.subject || activeSubject;
  activeExamId = examId || null;
  activeSubject = subject || null;

  const [allQuestions, exams, passages] = await Promise.all([loadQuestions(), loadExamCatalog(), loadPassages()]);
  const filtered = filterQuestions(allQuestions, { examId, subject });
  const questions = pickQuestions(filtered, filtered.length);
  const exam = exams.find(item => item.id === examId);

  if (!questions.length) {
    const sourceButton = exam ? `<a class="secondary" href="${escapeHtml(exam.sourceUrl)}" target="_blank" rel="noreferrer">Abrir referência da prova</a>` : '';
    viewEl.innerHTML = `<div class="notice"><div><h2>${subject ? escapeHtml(subject) : 'Banco de questões'}</h2><p>A estrutura do simulado já está pronta, mas as questões desta seleção ainda não foram liberadas no banco auditado.</p><p>Quando o caderno for fornecido e conferido, elas aparecerão aqui automaticamente.</p><div class="quiz-actions">${sourceButton}<button class="primary" id="back-from-empty" type="button">Voltar às provas</button></div></div></div>`;
    viewEl.querySelector('#back-from-empty').addEventListener('click', () => examId ? renderExam(examId) : renderDashboard());
    return;
  }

  let index = 0;
  const answered = new Set();

  const show = () => {
    const q = questions[index];
    const passage = q.passageId ? passages.find(item => item.id === q.passageId) : null;
    const annulled = q.status === 'annulled';
    viewEl.innerHTML = `<div class="study-shell">
      <aside class="study-sidebar">
        <h3>${escapeHtml(exam?.label || q.examLabel || 'Simulado')}</h3>
        <p>${escapeHtml(subject || q.subject)} · ${questions.length} questão(ões)</p>
        <div class="question-nav">${questions.map((item, i) => `<button type="button" data-go="${i}" class="${i === index ? 'active' : ''} ${answered.has(item.id) || item.status === 'annulled' ? 'done' : ''}" aria-label="Ir para a questão ${item.number ?? i + 1}">${item.number ?? i + 1}</button>`).join('')}</div>
      </aside>
      <article class="question-card">
        <div class="question-kicker"><span>Questão ${q.number ?? index + 1}</span><span>${escapeHtml(q.subject)}</span>${q.topic ? `<span>${escapeHtml(q.topic)}</span>` : ''}${annulled ? '<span class="annulled-badge">Anulada</span>' : ''}</div>
        ${passageHtml(passage)}
        <h2>${escapeHtml(q.prompt)}</h2>
        ${q.context ? `<div class="question-context">${escapeHtml(q.context)}</div>` : ''}
        ${figureHtml(q.figure)}
        <div class="answers">${q.options.map((option, i) => `<button class="answer" data-answer="${i}" type="button" ${annulled ? 'disabled' : ''}><strong>${String.fromCharCode(65 + i)}.</strong> ${escapeHtml(option)}</button>`).join('')}</div>
        ${annulled
          ? '<button class="primary" id="show-annulled" type="button">Entender a anulação</button>'
          : '<button class="secondary" id="dont-know" type="button">Ainda não sei</button>'}
        <div id="feedback"></div>
      </article>
    </div>`;

    viewEl.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => { index = Number(button.dataset.go); show(); }));
    if (annulled) {
      viewEl.querySelector('#show-annulled').addEventListener('click', () => showAnnulled(q));
      return;
    }
    viewEl.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => answer(Number(button.dataset.answer), false)));
    viewEl.querySelector('#dont-know').addEventListener('click', () => answer(-1, true));
  };

  const nextAction = () => {
    if (index + 1 < questions.length) { index += 1; show(); }
    else if (examId) renderExam(examId);
    else renderDashboard();
  };

  const showAnnulled = q => {
    answered.add(q.id);
    const feedback = viewEl.querySelector('#feedback');
    feedback.className = 'feedback annulled-feedback';
    feedback.innerHTML = `<h3>Questão anulada no gabarito final.</h3>
      ${explanationHtml(q.explanation)}
      <small>Fonte auditada: ${escapeHtml(q.audit.source)}</small>
      <div class="quiz-actions"><button id="next-question" class="primary" type="button">${index + 1 < questions.length ? 'Próxima questão' : 'Concluir bloco'}</button></div>`;
    viewEl.querySelector('#show-annulled').disabled = true;
    viewEl.querySelector('#next-question').addEventListener('click', nextAction);
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
    viewEl.querySelector('#next-question').addEventListener('click', nextAction);
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
