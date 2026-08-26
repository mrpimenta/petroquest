import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'service-worker.js',
  'data/questions.json',
  'data/exams.json',
  'data/syllabus.json',
  'src/main.js',
  'src/ui.js',
  'src/questions.js',
  'src/quiz.js'
];

async function readJson(relativePath) {
  const text = await readFile(resolve(root, relativePath), 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${relativePath}: JSON inválido (${error.message})`);
  }
}

for (const file of requiredFiles) {
  await access(resolve(root, file));
}

const manifest = await readJson('data/questions.json');
const examCatalog = await readJson('data/exams.json');

if (!Array.isArray(examCatalog.exams) || examCatalog.exams.length === 0) {
  throw new Error('data/exams.json: catálogo de provas vazio.');
}

let questions = [];
if (Array.isArray(manifest.files) && manifest.files.length > 0) {
  for (const publicPath of manifest.files) {
    const relativePath = publicPath.replace(/^\//, '');
    await access(resolve(root, relativePath));
    const part = await readJson(relativePath);
    if (!Array.isArray(part.questions)) {
      throw new Error(`${relativePath}: campo questions ausente ou inválido.`);
    }
    questions.push(...part.questions);
  }
} else if (Array.isArray(manifest.questions)) {
  questions = manifest.questions;
} else {
  throw new Error('data/questions.json: informe files[] ou questions[].');
}

const ids = new Set();
for (const q of questions) {
  if (!q?.id || ids.has(q.id)) throw new Error(`ID de questão ausente ou duplicado: ${q?.id ?? '(vazio)'}`);
  ids.add(q.id);
  if (!q.examId) throw new Error(`${q.id}: examId ausente.`);
  if (!Number.isInteger(q.number)) throw new Error(`${q.id}: number deve ser inteiro.`);
  if (!q.prompt) throw new Error(`${q.id}: enunciado ausente.`);
  if (!Array.isArray(q.options) || q.options.length !== 5) throw new Error(`${q.id}: a questão deve ter 5 alternativas.`);
  if (q.status !== 'annulled' && (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 4)) {
    throw new Error(`${q.id}: correctIndex inválido.`);
  }
  if (q.audit?.verified !== true) throw new Error(`${q.id}: questão não auditada.`);
}

const exam2023 = questions.filter(q => q.examId === 'transpetro-2023-eletrica');
if (exam2023.length !== 70) {
  throw new Error(`Transpetro 2023: esperadas 70 questões, encontradas ${exam2023.length}.`);
}

const expectedNumbers = new Set(Array.from({ length: 70 }, (_, i) => i + 1));
for (const q of exam2023) expectedNumbers.delete(q.number);
if (expectedNumbers.size) {
  throw new Error(`Transpetro 2023: faltam questões ${[...expectedNumbers].join(', ')}.`);
}

console.log(`Petro Quest OK: ${questions.length} questão(ões), ${examCatalog.exams.length} prova(s) catalogada(s).`);
