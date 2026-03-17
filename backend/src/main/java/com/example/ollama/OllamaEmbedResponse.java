package com.example.ollama;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Response from POST /api/embed.
 * Ollama may return "embeddings" (array) or "embedding" (single array).
 * Use Number so Jackson accepts integers or floats from JSON.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class OllamaEmbedResponse {
    /** Array of vectors (newer API). */
    public List<List<Number>> embeddings;
    /** Single vector (legacy API, when one prompt was sent). */
    public List<Number> embedding;

    /** Extract first embedding as List&lt;Double&gt;, from either field. */
    public List<Double> getFirstEmbedding() {
        if (embedding != null && !embedding.isEmpty()) {
            return embedding.stream().map(Number::doubleValue).collect(Collectors.toList());
        }
        if (embeddings != null && !embeddings.isEmpty()) {
            List<Number> first = embeddings.get(0);
            if (first != null && !first.isEmpty()) {
                return first.stream().map(Number::doubleValue).collect(Collectors.toList());
            }
        }
        return null;
    }
}
