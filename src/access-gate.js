const ACCESS_HASH = '6fb459147f28760065564942e33c37c237b5fa28c1819357ac7a7a9fc44d94bd';
const SESSION_KEY = 'petroquest_access_granted';

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

function buildGate() {
  const style = document.createElement('style');
  style.textContent = `
    .access-gate {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #f4f7f6;
      font-family: inherit;
    }
    .access-gate__card {
      width: min(100%, 420px);
      background: #fff;
      border: 1px solid #dfe8e4;
      border-radius: 18px;
      box-shadow: 0 18px 60px rgba(20, 45, 35, .12);
      padding: 28px;
    }
    .access-gate__card h1 {
      margin: 0 0 8px;
      font-size: 1.55rem;
      color: #173f32;
    }
    .access-gate__card p {
      margin: 0 0 20px;
      color: #5c6d66;
      line-height: 1.5;
    }
    .access-gate__card label {
      display: block;
      margin-bottom: 8px;
      font-weight: 700;
      color: #263f36;
    }
    .access-gate__row {
      display: flex;
      gap: 10px;
    }
    .access-gate__row input {
      flex: 1;
      min-width: 0;
      height: 48px;
      padding: 0 14px;
      border: 1px solid #becdc7;
      border-radius: 11px;
      font: inherit;
      outline: none;
    }
    .access-gate__row input:focus {
      border-color: #197a56;
      box-shadow: 0 0 0 3px rgba(25, 122, 86, .12);
    }
    .access-gate__row button {
      height: 48px;
      padding: 0 18px;
      border: 0;
      border-radius: 11px;
      background: #176b4c;
      color: #fff;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    .access-gate__error {
      min-height: 22px;
      margin: 10px 0 0 !important;
      color: #a12e2e !important;
      font-size: .92rem;
    }
    @media (max-width: 520px) {
      .access-gate__card { padding: 22px; }
      .access-gate__row { flex-direction: column; }
      .access-gate__row button { width: 100%; }
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'access-gate';
  root.innerHTML = `
    <form class="access-gate__card" autocomplete="off">
      <h1>Petro Quest</h1>
      <p>Área privada de estudos. Digite a senha para continuar.</p>
      <label for="petroquest-password">Senha de acesso</label>
      <div class="access-gate__row">
        <input id="petroquest-password" type="password" inputmode="text" autocomplete="current-password" required autofocus>
        <button type="submit">Entrar</button>
      </div>
      <p class="access-gate__error" role="alert" aria-live="polite"></p>
    </form>
  `;
  document.body.appendChild(root);
  return root;
}

export async function requireAccess() {
  if (sessionStorage.getItem(SESSION_KEY) === '1') return;

  const gate = buildGate();
  const form = gate.querySelector('form');
  const input = gate.querySelector('input');
  const error = gate.querySelector('.access-gate__error');
  const button = gate.querySelector('button');

  await new Promise(resolve => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      error.textContent = '';
      button.disabled = true;
      try {
        const hash = await sha256(input.value);
        if (hash !== ACCESS_HASH) {
          error.textContent = 'Senha incorreta.';
          input.select();
          return;
        }
        sessionStorage.setItem(SESSION_KEY, '1');
        gate.remove();
        resolve();
      } catch {
        error.textContent = 'Não foi possível validar a senha neste navegador.';
      } finally {
        button.disabled = false;
      }
    });
  });
}
