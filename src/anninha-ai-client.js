const ENDPOINT = '/api/anninha';
const HISTORY_KEY = 'petroquest:anninha-history:v1';
const MODES = new Set(['hint', 'explain', 'why_wrong', 'summarize', 'related']);
const MAX_HISTORY = 8;

export class AnninhaAiError extends Error {
  constructor(code, message, status = 0, emotion = 'confused') {
    super(message);
    this.name = 'AnninhaAiError';
    this.code = code;
    this.status = status;
    this.emotion = emotion;
  }
}

function readHistory() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  try {
    window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {
    // O chat continua funcionando mesmo sem sessionStorage.
  }
}

export function resetAnninhaConversation() {
  try {
    window.sessionStorage.removeItem(HISTORY_KEY);
  } catch {
    // Sem estado persistente para remover.
  }
}

function validate(input = {}) {
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!message || message.length > 1500) {
    throw new AnninhaAiError('invalid_message', 'Escreva uma dúvida entre 1 e 1.500 caracteres.');
  }
  const mode = MODES.has(input.mode) ? input.mode : 'explain';
  const selectedOption = Number.isInteger(input.selectedOption) ? input.selectedOption : null;
  return {
    message,
    mode,
    currentScreen: input.currentScreen === 'question' ? 'question' : 'home',
    questionId: input.questionId || null,
    selectedOption,
    history: readHistory()
  };
}

async function parseResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new AnninhaAiError('invalid_response', 'A resposta da Anninha chegou incompleta. Tente novamente.', response.status, 'sleepy');
  }
}

export async function askAnninha(input) {
  const payload = validate(input);
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(35000)
    });
  } catch (error) {
    throw new AnninhaAiError(
      error?.name === 'TimeoutError' ? 'timeout' : 'network_error',
      'Não consegui falar com a Anninha agora. Confira a conexão e tente novamente.',
      0,
      'sleepy'
    );
  }

  const body = await parseResponse(response);
  if (!response.ok) {
    throw new AnninhaAiError(
      body.error || 'anninha_unavailable',
      body.message || 'A Anninha não conseguiu responder agora. Tente novamente em instantes.',
      response.status,
      body.emotion || 'sleepy'
    );
  }
  if (typeof body.answer !== 'string' || !body.answer.trim()) {
    throw new AnninhaAiError('empty_answer', 'A Anninha não conseguiu montar a resposta. Tente novamente.', response.status, 'sleepy');
  }

  const history = readHistory();
  history.push({ role: 'user', content: payload.message });
  history.push({ role: 'assistant', content: body.answer.trim() });
  writeHistory(history);
  return body;
}
