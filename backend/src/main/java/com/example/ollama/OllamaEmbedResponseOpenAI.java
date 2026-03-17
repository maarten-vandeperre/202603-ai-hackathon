package com.example.ollama;

import java.util.List;

/** OpenAI-compatible response: { "data": [ { "embedding": [...] }, ... ] } */
public class OllamaEmbedResponseOpenAI {
    public List<EmbeddingEntry> data;

    public static class EmbeddingEntry {
        public List<Double> embedding;
    }
}
