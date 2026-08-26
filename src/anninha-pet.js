import { askAnninha, resetAnninhaConversation } from './anninha-ai-client.js';

const ANNINHA_IMAGE = 'https://farma-santos-quest.netlify.app/assets/anninha/idle.webp';
const QUICK_PROMPTS = {
  hint: 'Me dê uma pista sobre esta questão sem entregar a resposta.',
  explain: 'Explique esta questão desde o conceito necessário.',
  why_wrong: 'Explique por que a alternativa que escolhi está errada e qual regra eu deveria lembrar.',
  summarize: 'Resuma o que eu preciso aprender com esta questão.'
};

let root;
let panel;
let textarea;
let answer;
let status;
let send;
let bubble;
let activeMode = 'explain';
let observer;
let bubbleTimer;

function currentContext() {
  const card = document.querySelector('.question-card');
  if (!card) return { currentScreen: 'home', questionId: null, selectedOption: null };

  let questionId = card.dataset.questionId || null;
  if (!questionId) {
    const numberText = card.querySelector('.question-kicker span')?.textContent || '';
    const number = Number(numberText.match(/\d+/)?.[0]);
    const examLabel = document.querySelector('.study-sidebar h3')?.textContent?.trim() || '';
    if (Number.isInteger(number) && number > 0) {
      if (/Prova\s*1/i.test(examLabel)) questionId = `tp2023-q${number}`;
      else if (/Prova\s*2/i.test(examLabel)) questionId = `tp2018-q${number}`;
    }
  }

  let selectedOption = null;
  const feedbackText = card.querySelector('.feedback')?.textContent || '';
  const wrong = card.querySelector('.answer.wrong');
  if (wrong) selectedOption = Number(wrong.dataset.answer);
  else if (feedbackText.includes('Correto.')) {
    const correct = card.querySelector('.answer.correct');
    if (correct) selectedOption = Number(correct.dataset.answer);
  }

  return {
    currentScreen: 'question',
    questionId,
    selectedOption: Number.isInteger(selectedOption) && selectedOption >= 0 ? selectedOption : null
  };
}

function showBubble(message, duration = 4300) {
  if (!bubble) return;
  clearTimeout(bubbleTimer);
  bubble.textContent = message;
  root.classList.add('is-reacting');
  bubbleTimer = window.setTimeout(() => root?.classList.remove('is-reacting'), duration);
}

function setMode(mode) {
  activeMode = QUICK_PROMPTS[mode] ? mode : 'explain';
  root.querySelectorAll('[data-anninha-mode]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.anninhaMode === activeMode);
  });
}

function setBusy(value) {
  textarea.disabled = value;
  send.disabled = value;
  root.querySelectorAll('[data-anninha-mode]').forEach(button => { button.disabled = value; });
}

function openPanel() {
  panel.hidden = false;
  requestAnimationFrame(() => {
    root.classList.add('is-open');
    textarea.focus({ preventScroll: true });
  });
}

function closePanel() {
  root.classList.remove('is-open');
  window.setTimeout(() => {
    if (!root.classList.contains('is-open')) panel.hidden = true;
  }, 170);
}

async function submit({ mode = activeMode, fallback = '' } = {}) {
  const context = currentContext();
  const message = textarea.value.trim() || fallback;
  if (!message) {
    status.textContent = 'Escreva uma dúvida primeiro.';
    return;
  }
  if (mode === 'why_wrong' && context.currentScreen === 'question' && context.selectedOption == null) {
    status.textContent = 'Responda uma alternativa primeiro para eu explicar o erro.';
    showBubble('Marca uma alternativa primeiro e eu te explico o raciocínio ⚡');
    return;
  }

  setMode(mode);
  setBusy(true);
  status.textContent = 'Anninha está pensando…';
  answer.hidden = true;
  showBubble('Deixa eu olhar a questão e montar a explicação… 💭', 30000);

  try {
    const response = await askAnninha({ message, mode: activeMode, ...context });
    answer.textContent = response.answer;
    answer.hidden = false;
    textarea.value = '';
    status.textContent = response.grounded ? 'Resposta baseada na questão atual.' : 'Abra uma questão para respostas técnicas mais precisas.';
    showBubble(response.grounded ? 'Pronto! Agora tenta enxergar a lógica antes da fórmula ⚡' : 'Abre uma questão e eu estudo junto com você 📚');
  } catch (error) {
    answer.textContent = error?.message || 'Não consegui responder agora.';
    answer.hidden = false;
    status.textContent = 'Tente novamente em instantes.';
    showBubble('Tive um problema para acessar a IA agora. Tenta de novo daqui a pouco.');
  } finally {
    setBusy(false);
  }
}

function ensureUi() {
  if (root?.isConnected) return;
  root = document.createElement('aside');
  root.className = 'anninha-pet';
  root.setAttribute('aria-label', 'Professora Anninha');
  root.innerHTML = `
    <div class="anninha-pet__bubble" role="status" aria-live="polite"></div>
    <img class="anninha-pet__image" src="${ANNINHA_IMAGE}" alt="" draggable="false">
    <button class="anninha-pet__hitbox" type="button" aria-label="Perguntar para a Professora Anninha" aria-expanded="false"></button>
    <section class="anninha-pet__panel" role="dialog" aria-label="Pergunte para a Anninha" hidden>
      <div class="anninha-pet__panel-header">
        <div><strong>Professora Anninha</strong><span>Engenharia Elétrica · Petro Quest</span></div>
        <button class="anninha-pet__panel-close" type="button" aria-label="Fechar">×</button>
      </div>
      <div class="anninha-pet__quick-actions">
        <button type="button" data-anninha-mode="hint">Dê uma pista</button>
        <button type="button" data-anninha-mode="explain" class="is-active">Explique</button>
        <button type="button" data-anninha-mode="why_wrong">Por que errei?</button>
        <button type="button" data-anninha-mode="summarize">Resuma</button>
      </div>
      <label for="anninha-question-input">Sua dúvida</label>
      <textarea id="anninha-question-input" rows="3" maxlength="1500" placeholder="Ex.: por que nesta questão usamos escorregamento?"></textarea>
      <p class="anninha-pet__answer" hidden></p>
      <div class="anninha-pet__panel-footer"><span class="anninha-pet__status">A resposta usa o conteúdo da questão atual.</span><button class="anninha-pet__send" type="button">Enviar</button></div>
      <button class="anninha-pet__reset" type="button">Nova conversa</button>
    </section>`;
  document.body.appendChild(root);

  panel = root.querySelector('.anninha-pet__panel');
  textarea = root.querySelector('textarea');
  answer = root.querySelector('.anninha-pet__answer');
  status = root.querySelector('.anninha-pet__status');
  send = root.querySelector('.anninha-pet__send');
  bubble = root.querySelector('.anninha-pet__bubble');

  root.querySelector('.anninha-pet__hitbox').addEventListener('click', () => {
    const opening = !root.classList.contains('is-open');
    if (opening) {
      openPanel();
      showBubble(currentContext().questionId ? 'Quer uma pista ou uma explicação dessa questão? ⚡' : 'Abra uma questão e eu estudo junto com você 📚');
    } else closePanel();
  });
  root.querySelector('.anninha-pet__panel-close').addEventListener('click', closePanel);
  send.addEventListener('click', () => submit());
  textarea.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    }
  });
  root.querySelectorAll('[data-anninha-mode]').forEach(button => {
    button.addEventListener('click', () => {
      const mode = button.dataset.anninhaMode;
      setMode(mode);
      if (!textarea.value.trim()) submit({ mode, fallback: QUICK_PROMPTS[mode] });
    });
  });
  root.querySelector('.anninha-pet__reset').addEventListener('click', () => {
    resetAnninhaConversation();
    answer.hidden = true;
    answer.textContent = '';
    status.textContent = 'Conversa reiniciada.';
    showBubble('Caderno novo. Pode perguntar! ✨');
  });
}

function observeAnswers() {
  observer?.disconnect();
  observer = new MutationObserver(() => {
    const feedback = document.querySelector('.question-card .feedback');
    if (!feedback || feedback.dataset.anninhaObserved) return;
    feedback.dataset.anninhaObserved = '1';
    const text = feedback.textContent || '';
    if (text.includes('Correto.')) showBubble('Acertou! Agora fixa o porquê, não só a letra 🎯');
    else if (text.includes('Resposta incorreta.')) showBubble('Boa. Esse erro agora vira revisão — quer que eu explique? 💡');
  });
  observer.observe(document.querySelector('#view'), { childList: true, subtree: true });
}

export function initAnninha() {
  ensureUi();
  observeAnswers();
  window.PETRO_ANNINHA = { open: openPanel, close: closePanel, ask: submit };
}
