// services/rag.js — retrieval-augmented generation over KnowledgeChunk docs.
// Retrieval strategy: with no Atlas Vector index (USE_ATLAS_VECTOR=false) we
// load every chunk and rank by cosine similarity in memory. That is perfectly
// fine for a small knowledge base (hundreds of chunks). Flip USE_ATLAS_VECTOR
// to "true" once you build an Atlas index to scale past that.
const KnowledgeChunk = require('../models/KnowledgeChunk');
const { embed, generate } = require('./gemini');

const TOP_K = 4;

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

// Retrieve the chunks most relevant to `question`.
async function retrieve(question, k = TOP_K) {
  const queryVec = await embed(question);
  const chunks = await KnowledgeChunk.find().lean();
  return chunks
    .map((c) => ({ ...c, score: cosine(queryVec, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function buildPrompt(question, chunks) {
  const context = chunks
    .map((c, i) => `[${i + 1}] (source: ${c.source})\n${c.text}`)
    .join('\n\n');
  return `You are a helpful customer-support assistant. Answer the customer's question
using ONLY the context below. If the context does not contain the answer, say you
don't have that information and suggest they wait for a human agent. Cite sources
inline like [1], [2].

Context:
${context}

Customer question: ${question}

Answer:`;
}

// answer(question) -> { text, citations:[{source, snippet}] }
async function answer(question) {
  const chunks = await retrieve(question);

  if (chunks.length === 0) {
    // Nothing ingested yet — don't hallucinate, tell the truth.
    return {
      text:
        "I don't have any knowledge-base articles to answer from yet. " +
        'Once support uploads documentation I can help, or a human agent will follow up on your ticket.',
      citations: [],
    };
  }

  const text = await generate(buildPrompt(question, chunks));
  const citations = chunks.map((c) => ({ source: c.source, snippet: c.text.slice(0, 160) }));
  return { text, citations };
}

module.exports = { answer, retrieve, cosine };
