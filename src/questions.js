let questionCache = null;
let examCache = null;

export async function loadQuestions({ verifiedOnly = true } = {}) {
  if (!questionCache) {
    const response = await fetch('/data/questions.json');
    if (!response.ok) throw new Error('Não foi possível carregar o banco de questões.');
    const data = await response.json();
    questionCache = data.questions ?? [];
  }
  return verifiedOnly ? questionCache.filter(question => question.audit?.verified === true) : questionCache;
}

export async function loadExamCatalog() {
  if (examCache) return examCache;
  const response = await fetch('/data/exams.json');
  if (!response.ok) throw new Error('Não foi possível carregar o catálogo de provas.');
  const data = await response.json();
  examCache = [...(data.exams ?? [])].sort((a, b) => a.order - b.order);
  return examCache;
}

export function filterQuestions(questions, filters = {}) {
  return questions.filter(question => {
    if (filters.examId && question.examId !== filters.examId) return false;
    if (filters.subject && question.subject !== filters.subject) return false;
    if (filters.topic && question.topic !== filters.topic) return false;
    return true;
  });
}

export function pickQuestions(questions, count = 5) {
  if (!Number.isFinite(count) || count >= questions.length) return [...questions];
  return [...questions].sort(() => Math.random() - 0.5).slice(0, count);
}

export function groupBySubject(questions) {
  return questions.reduce((groups, question) => {
    const subject = question.subject || 'Sem matéria';
    groups[subject] = groups[subject] || [];
    groups[subject].push(question);
    return groups;
  }, {});
}

export function findQuestion(questions, id) {
  return questions.find(question => question.id === id) ?? null;
}
