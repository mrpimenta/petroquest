import { getState, updateState } from './store.js';
import { scheduleReview } from './review.js';
import { xpForAnswer } from './gamification.js';
import { enqueueSync } from './cloud.js';

export function registerAnswer(question, selectedIndex, { dontKnow = false } = {}) {
  const correct = selectedIndex === question.correctIndex && !dontKnow;
  const current = getState();
  const previousReview = current.reviews[question.id];
  const review = scheduleReview(previousReview, correct ? 5 : dontKnow ? 0 : 2);

  updateState(state => ({
    ...state,
    xp: state.xp + xpForAnswer({ correct }),
    answered: state.answered + 1,
    correct: state.correct + (correct ? 1 : 0),
    lastStudyDate: new Date().toISOString(),
    reviews: { ...state.reviews, [question.id]: review },
    errors: correct ? state.errors.filter(id => id !== question.id) : [...new Set([...state.errors, question.id])],
    dontKnow: dontKnow ? [...new Set([...state.dontKnow, question.id])] : state.dontKnow.filter(id => id !== question.id)
  }));

  enqueueSync({ type: 'answer', questionId: question.id, selectedIndex, correct, dontKnow });
  return { correct, explanation: question.explanation, source: question.audit.source };
}
