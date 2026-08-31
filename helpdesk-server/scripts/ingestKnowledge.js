// scripts/ingestKnowledge.js — load docs from ./knowledge into the KnowledgeChunk
// collection with Gemini embeddings, so the RAG assistant has something to cite.
// Run: npm run ingest    (needs a real GEMINI_API_KEY)
//
// Supports .txt / .md (read directly) and .pdf (via pdf-parse). Each file is
// split into ~500-word chunks; each chunk is embedded and stored.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const KnowledgeChunk = require('../models/KnowledgeChunk');
const { embed, isConfigured } = require('../services/gemini');

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const WORDS_PER_CHUNK = 500;

async function readFileText(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.pdf') {
    const pdf = require('pdf-parse');
    const data = await pdf(fs.readFileSync(file));
    return data.text;
  }
  return fs.readFileSync(file, 'utf8'); // .txt, .md
}

// Split on blank lines first (keeps FAQ sections together), then pack into
// word-bounded chunks so no single chunk is too big to embed.
function chunkText(text) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = [];
  let count = 0;
  for (const p of paras) {
    const words = p.split(/\s+/).length;
    if (count + words > WORDS_PER_CHUNK && buf.length) {
      chunks.push(buf.join('\n\n'));
      buf = [];
      count = 0;
    }
    buf.push(p);
    count += words;
  }
  if (buf.length) chunks.push(buf.join('\n\n'));
  return chunks;
}

async function ingest() {
  if (!isConfigured()) {
    console.error(
      '❌ GEMINI_API_KEY is missing or still the placeholder.\n' +
        '   Get a key at https://aistudio.google.com/apikey and put it in helpdesk-server/.env,\n' +
        '   then run "npm run ingest" again.'
    );
    process.exit(1);
  }
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.error(`❌ No knowledge folder at ${KNOWLEDGE_DIR}. Create it and add .md/.txt/.pdf files.`);
    process.exit(1);
  }

  await connectDB();

  const files = fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((f) => ['.txt', '.md', '.pdf'].includes(path.extname(f).toLowerCase()));
  if (files.length === 0) {
    console.error('❌ knowledge/ has no .txt, .md or .pdf files to ingest.');
    process.exit(1);
  }

  // Rebuild from scratch so re-running doesn't create duplicates.
  const removed = await KnowledgeChunk.deleteMany({});
  console.log(`🧹 Cleared ${removed.deletedCount} existing chunks.`);

  let total = 0;
  for (const file of files) {
    const full = path.join(KNOWLEDGE_DIR, file);
    const text = await readFileText(full);
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      const embedding = await embed(chunk);
      await KnowledgeChunk.create({ source: file, text: chunk, embedding });
      total++;
      process.stdout.write('.');
    }
    console.log(`\n  ✓ ${file}: ${chunks.length} chunks`);
  }

  console.log(`\n✅ Ingested ${total} chunks from ${files.length} file(s). The AI assistant can now cite them.`);
  process.exit(0);
}

ingest().catch((err) => {
  console.error('\n❌ Ingest failed:', err.message);
  process.exit(1);
});
