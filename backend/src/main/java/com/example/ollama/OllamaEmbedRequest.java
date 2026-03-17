package com.example.ollama;

/**
 * Request for POST /api/embed.
 * Current Ollama /api/embed expects "input" (string or array); "prompt" returns empty embeddings.
 */
public class OllamaEmbedRequest {
    public String model = "nomic-embed-text";
    /** Text(s) to embed. Use "input" for /api/embed (required; "prompt" yields empty array). */
    public Object input;

    public static OllamaEmbedRequest of(String text) {
        OllamaEmbedRequest r = new OllamaEmbedRequest();
        r.input = text != null ? text : "";
        return r;
    }
}
