// models/KnowledgeChunk.js — a chunk of a knowledge-base doc + its embedding (RAG)
const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema(
  {
    source: { type: String, required: true }, // e.g. "refund-policy.pdf"
    text: { type: String, required: true },   // one chunk of the document
    embedding: { type: [Number], required: true }, // Gemini embedding vector (gemini-embedding-001 → 3072 dims)
  },
  { timestamps: true }
);

module.exports = mongoose.model('KnowledgeChunk', chunkSchema);
