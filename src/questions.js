let cache = null;

export async function loadQuestions() {
  if (cache) return cache;
  const response = await fetch('/data/questions.json');
  if (!response.ok) throw new Error('Não foi possível carregar o banco de questões.');
  const data = await response.json();
  cache = data.questions.filter(question => question.audit?.verified === true);
  return cache;
}

export function filterQuestions(questions, filters = {}) {
  return questions.filter(question => {
    if (filters.track && question.track !== filters.track) return false;
    if (filters.subject && question.subject !== filters.subject) return false;
    if (filters.exam && question.exam !== filters.exam) return false;
    return true;
  });
}

export function pickQuestions(questions, count = 5) {
  return [...questions].sort(() => Math.random() - 0.5).slice(0, count);
}
