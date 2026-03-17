package com.example.vector;

import com.example.ollama.OllamaApi;
import com.example.ollama.OllamaEmbedRequest;
import com.example.ollama.OllamaEmbedResponse;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.jboss.logging.Logger;

import javax.sql.DataSource;
import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class VectorStoreService {

    private static final Logger LOG = Logger.getLogger(VectorStoreService.class);
    private static final String EMBEDDING_MODEL = "nomic-embed-text";
    private static final int LINES_PER_CHUNK = 5;
    private static final int TOP_K = 5;

    @Inject
    DataSource dataSource;

    @RestClient
    OllamaApi ollamaApi;

    /**
     * Chunk text (by paragraphs, then by size), embed each chunk via Ollama, store in Postgres with metadata.
     */
    public void vectorize(String documentName, Instant uploadTime, String text) {
        if (text == null || text.isBlank()) return;
        List<String> chunks = chunkText(text);
        if (chunks.isEmpty()) return;

        List<List<Double>> embeddings;
        try {
            embeddings = getEmbeddings(chunks);
        } catch (Exception e) {
            LOG.error("Failed to get embeddings from Ollama", e);
            throw new RuntimeException("Embedding service unavailable: " + e.getMessage());
        }
        if (embeddings == null || embeddings.size() != chunks.size()) {
            throw new RuntimeException("Embedding size mismatch");
        }

        String sql = "INSERT INTO document_chunks (document_name, upload_time, chunk_text, embedding) VALUES (?, ?::timestamptz, ?, ?::vector)";
        try (Connection conn = dataSource.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            Timestamp uploadTs = Timestamp.from(uploadTime);
            for (int i = 0; i < chunks.size(); i++) {
                ps.setString(1, documentName);
                ps.setTimestamp(2, uploadTs);
                ps.setString(3, chunks.get(i));
                ps.setString(4, formatVector(embeddings.get(i)));
                ps.addBatch();
            }
            ps.executeBatch();
        } catch (SQLException e) {
            LOG.error("Failed to insert chunks", e);
            throw new RuntimeException("Database error: " + e.getMessage());
        }
    }

    /**
     * Embed query, find top 3 chunks by cosine similarity, return with metadata.
     */
    public List<ChunkMatch> similaritySearch(String query) {
        if (query == null || query.isBlank()) return List.of();
        List<List<Double>> embeddings;
        try {
            embeddings = getEmbeddings(List.of(query));
        } catch (Exception e) {
            LOG.error("Failed to embed query", e);
            throw new RuntimeException("Embedding service unavailable: " + e.getMessage());
        }
        if (embeddings == null || embeddings.isEmpty()) return List.of();
        String vectorStr = formatVector(embeddings.get(0));

        // Cosine distance: embedding <=> query_embedding ORDER BY distance LIMIT 3
        String sql = "SELECT document_name, upload_time, chunk_text, (embedding <=> ?::vector) AS distance " +
                "FROM document_chunks ORDER BY embedding <=> ?::vector LIMIT ?";
        List<ChunkMatch> results = new ArrayList<>();
        try (Connection conn = dataSource.getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, vectorStr);
            ps.setString(2, vectorStr);
            ps.setInt(3, TOP_K);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                Timestamp ts = rs.getTimestamp("upload_time");
                Instant instant = ts != null ? ts.toInstant() : null;
                results.add(new ChunkMatch(
                        rs.getString("document_name"),
                        instant,
                        rs.getString("chunk_text"),
                        rs.getDouble("distance")
                ));
            }
        } catch (SQLException e) {
            LOG.error("Similarity search failed", e);
            throw new RuntimeException("Database error: " + e.getMessage());
        }
        return results;
    }

    /** Returns the total number of chunks in the vector database. */
    public long getChunkCount() {
        String sql = "SELECT COUNT(*) FROM document_chunks";
        try (Connection conn = dataSource.getConnection();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            return rs.next() ? rs.getLong(1) : 0;
        } catch (SQLException e) {
            LOG.error("Failed to get chunk count", e);
            return 0;
        }
    }

    /** Split text into chunks of 5 non-empty lines each (blank lines are skipped for counting). */
    private List<String> chunkText(String text) {
        List<String> chunks = new ArrayList<>();
        String normalized = text.replace("\r\n", "\n").trim();
        if (normalized.isEmpty()) return chunks;
        List<String> nonEmptyLines = new ArrayList<>();
        for (String line : normalized.split("\n")) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) nonEmptyLines.add(line);
        }
        for (int i = 0; i < nonEmptyLines.size(); i += LINES_PER_CHUNK) {
            int end = Math.min(i + LINES_PER_CHUNK, nonEmptyLines.size());
            String chunk = String.join("\n", nonEmptyLines.subList(i, end)).trim();
            if (!chunk.isEmpty()) chunks.add(chunk);
        }
        return chunks;
    }

    private List<List<Double>> getEmbeddings(List<String> texts) {
        if (texts == null || texts.isEmpty()) return List.of();
        List<List<Double>> result = new ArrayList<>(texts.size());
        for (String text : texts) {
            if (text == null) text = "";
            OllamaEmbedRequest request = OllamaEmbedRequest.of(text);
            request.model = EMBEDDING_MODEL;
            OllamaEmbedResponse response = ollamaApi.embed(request);
            if (response == null) {
                throw new RuntimeException("Ollama returned no response for embed request");
            }
            List<Double> vector = response.getFirstEmbedding();
            if (vector == null || vector.isEmpty()) {
                throw new RuntimeException("Ollama embed response contained no embedding vector. " +
                        "Check that the model '" + EMBEDDING_MODEL + "' is loaded (ollama pull " + EMBEDDING_MODEL + ") and supports embeddings.");
            }
            result.add(vector);
        }
        return result;
    }

    private static String formatVector(List<Double> vec) {
        return "[" + vec.stream().map(d -> String.valueOf(d)).collect(Collectors.joining(",")) + "]";
    }

    public static class ChunkMatch {
        public String documentName;
        public Instant uploadTime;
        public String chunkText;
        public double distance;

        public ChunkMatch(String documentName, Instant uploadTime, String chunkText, double distance) {
            this.documentName = documentName;
            this.uploadTime = uploadTime;
            this.chunkText = chunkText;
            this.distance = distance;
        }
    }
}
