package com.example.rag;

import com.example.vector.VectorStoreService;
import dev.langchain4j.model.chat.ChatModel;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class RagService {

    private static final Logger LOG = Logger.getLogger(RagService.class);

    @Inject
    VectorStoreService vectorStore;

    @Inject
    ChatModel chatModel;

    /**
     * RAG: retrieve top chunks for the query, build a prompt with context, call the LLM, return the answer and the full prompt sent to the model.
     */
    public RagResult ask(String query) {
        if (query == null || query.isBlank()) {
            return new RagResult("Please provide a non-empty question.", null);
        }
        List<VectorStoreService.ChunkMatch> chunks = vectorStore.similaritySearch(query.trim());
        if (chunks == null || chunks.isEmpty()) {
            long total = vectorStore.getChunkCount();
            if (total == 0) {
                return new RagResult("No documents in the vector database yet. Upload a document, parse it with Docling, then click \"Store in vector database\" before asking questions.", null);
            }
            return new RagResult("No relevant passages found for this question. Try rephrasing or a different query.", null);
        }
        String context = chunks.stream()
                .map(c -> "---\nDocument: " + (c.documentName != null ? c.documentName : "unknown") + "\n\n" + (c.chunkText != null ? c.chunkText : ""))
                .collect(Collectors.joining("\n\n"));
        String prompt = "Answer the question based only on the following context from uploaded documents. "
                + "If the context does not contain enough information to answer, say so. "
                + "Do not invent information.\n\nContext:\n" + context + "\n\nQuestion: " + query.trim() + "\n\nAnswer:";
        try {
            String answer = chatModel.chat(prompt);
            return new RagResult(answer != null ? answer.trim() : "No response from the model.", prompt);
        } catch (Exception e) {
            LOG.error("RAG LLM call failed", e);
            throw new RuntimeException("Failed to get answer from the model: " + e.getMessage());
        }
    }

    public static class RagResult {
        public final String answer;
        public final String fullPrompt;

        public RagResult(String answer, String fullPrompt) {
            this.answer = answer;
            this.fullPrompt = fullPrompt;
        }
    }
}
