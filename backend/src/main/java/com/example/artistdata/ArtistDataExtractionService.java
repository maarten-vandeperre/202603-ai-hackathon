package com.example.artistdata;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.model.chat.ChatModel;
import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Orchestrates artist data extraction: chunk → extract per chunk (LLM) → validate → merge.
 * Reuses the existing LangChain4j ChatModel.
 */
@ApplicationScoped
public class ArtistDataExtractionService {

    private static final Logger LOG = Logger.getLogger(ArtistDataExtractionService.class);

    private static final String EXTRACTION_PROMPT = """
You are extracting artist pricing information from a document chunk.

Return JSON only.

Schema:
{
  "chunkId": "string",
  "artists": [
    {
      "name": "string | null",
      "price": "number | null",
      "unit": "string | null",
      "currency": "string | null",
      "rawPriceText": "string | null",
      "evidence": "string | null",
      "confidence": "high | medium | low"
    }
  ]
}

Units: use a short label for how the price is expressed, e.g. "per hour", "per day", "per performance", "per show", "flat", "forfait", "lump sum", "per project". Use null if no price or unit is found.

Rules:
- Extract only from the provided text.
- Do not guess.
- Set "price" to the numeric value when a price is clearly stated; set "unit" to the way it is expressed (per hour, per day, flat, etc.).
- Do not convert between units (e.g. do not turn a daily rate into an hourly rate).
- Include supporting evidence from the text.
- If nothing relevant is found, return an empty artists array.

Chunk metadata:
{{chunk_metadata}}

Chunk text:
{{chunk_text}}
""";

    /** Remove image/binary content before chunking to reduce size and avoid useless LLM tokens. */
    /** Base64 may be line-wrapped; allow whitespace so we strip the entire blob. */
    private static final Pattern DATA_URI_BASE64 = Pattern.compile(
        "data:image/[^;]+;base64,[A-Za-z0-9+/=\\s]{1,500000}",
        Pattern.CASE_INSENSITIVE);
    /** Markdown image: ![alt](url) — matches data URIs even when URL spans multiple lines. */
    private static final Pattern MARKDOWN_IMAGE = Pattern.compile("!\\[[^]]*\\]\\([^)]+\\)", Pattern.DOTALL);
    /** Markdown image with data:image URL (often line-wrapped); remove in one shot. */
    private static final Pattern MARKDOWN_DATA_IMAGE = Pattern.compile(
        "!\\[[^]]*\\]\\s*\\(\\s*data:image[^)]*\\)",
        Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    /** Lines that look like raw base64 (e.g. from pasted content) - strip if longer than this. */
    private static final int BASE64_LINE_MIN_LENGTH = 200;
    private static final Pattern BASE64_LINE = Pattern.compile("(?m)^[A-Za-z0-9+/=\\s]{" + BASE64_LINE_MIN_LENGTH + ",}$");

    @Inject
    ChatModel chatModel;

    @Inject
    DocumentChunker documentChunker;

    @Inject
    ChunkExtractionValidator validator;

    @Inject
    ChunkResultMerger merger;

    @Inject
    ObjectMapper objectMapper;

    private static final int LOG_TEXT_MAX_LENGTH = 3000;
    private static final String CHUNK_LOG_FILE = "chunk-log.txt";

    public ArtistDataDto.ExtractResponse extract(String rawText) {
        ArtistDataDto.ExtractResponse response = new ArtistDataDto.ExtractResponse();
        response.chunks = List.of();
        response.perChunkResults = new ArrayList<>();
        response.merged = new ArtistDataDto.MergedResultDto();
        response.merged.artists = List.of();
        response.simplified = List.of();

        if (rawText == null || rawText.isBlank()) {
            LOG.warn("ArtistDataExtractionService: empty rawText");
            return response;
        }

        appendToChunkLog("parsed text (length=" + rawText.length() + ")", truncateForLog(rawText, LOG_TEXT_MAX_LENGTH));

        String textForChunking = stripImageAndBinaryContent(rawText.trim());
        int removed = rawText.length() - textForChunking.length();
        if (removed > 0) {
            LOG.infof("ArtistDataExtraction: stripped %d chars of image/binary content before chunking", removed);
        }
        appendToChunkLog("text without binary (length=" + textForChunking.length() + ")", truncateForLog(textForChunking, LOG_TEXT_MAX_LENGTH));

        List<ArtistDataDto.ChunkDto> chunks = documentChunker.chunk(textForChunking);
        response.chunks = chunks;

        int total = chunks.size();
        LOG.infof("ArtistDataExtraction: processing %d chunks", total);
        for (int i = 0; i < chunks.size(); i++) {
            ArtistDataDto.ChunkDto chunk = chunks.get(i);
            int len = chunk.text != null ? chunk.text.length() : 0;
            appendToChunkLog("chunk " + chunk.chunkId + " (" + (i + 1) + "/" + total + ") content (length=" + len + ")", truncateForLog(chunk.text, LOG_TEXT_MAX_LENGTH));
            ArtistDataDto.PerChunkResultDto chunkResult = extractChunk(chunk);
            response.perChunkResults.add(chunkResult);
        }

        List<ArtistDataDto.PerChunkResultDto> validated = new ArrayList<>();
        for (ArtistDataDto.PerChunkResultDto r : response.perChunkResults) {
            if (r == null) continue;
            ArtistDataDto.PerChunkResultDto v = new ArtistDataDto.PerChunkResultDto();
            v.chunkId = r.chunkId;
            v.artists = new ArrayList<>();
            if (r.artists != null) {
                for (ArtistDataDto.PerChunkArtistDto a : r.artists) {
                    ArtistDataDto.PerChunkArtistDto va = validator.validate(a);
                    if (va != null) v.artists.add(va);
                }
            }
            validated.add(v);
        }

        response.merged = merger.merge(validated);
        if (response.merged == null) {
            response.merged = new ArtistDataDto.MergedResultDto();
            response.merged.artists = List.of();
        }
        response.simplified = merger.toSimplified(response.merged);

        LOG.infof("ArtistDataExtraction: %d chunks, %d merged artists", chunks.size(), response.merged.artists.size());
        return response;
    }

    private ArtistDataDto.PerChunkResultDto extractChunk(ArtistDataDto.ChunkDto chunk) {
        String chunkMetadata = "chunkId: " + chunk.chunkId + ", startOffset: " + chunk.startOffset + ", endOffset: " + chunk.endOffset;
        String prompt = EXTRACTION_PROMPT
            .replace("{{chunk_metadata}}", chunkMetadata)
            .replace("{{chunk_text}}", chunk.text);

        try {
            String llmResponse = chatModel.chat(prompt);
            LOG.debugf("Chunk %s LLM response length: %d", chunk.chunkId, llmResponse != null ? llmResponse.length() : 0);

            String json = stripJsonFromResponse(llmResponse);
            if (json == null || json.isBlank()) {
                LOG.warnf("Chunk %s: no JSON in response", chunk.chunkId);
                return emptyChunkResult(chunk.chunkId);
            }

            ArtistDataDto.PerChunkResultDto parsed = objectMapper.readValue(json, ArtistDataDto.PerChunkResultDto.class);
            if (parsed != null) {
                parsed.chunkId = chunk.chunkId;
                if (parsed.artists == null) parsed.artists = List.of();
            }
            return parsed != null ? parsed : emptyChunkResult(chunk.chunkId);
        } catch (Exception e) {
            LOG.errorf(e, "Chunk %s: extraction failed", chunk.chunkId);
            return emptyChunkResult(chunk.chunkId);
        }
    }

    private static String stripJsonFromResponse(String s) {
        if (s == null || s.isBlank()) return null;
        s = s.trim();
        if (s.startsWith("```json")) {
            s = s.substring(7);
        } else if (s.startsWith("```")) {
            s = s.substring(3);
        }
        if (s.endsWith("```")) {
            s = s.substring(0, s.length() - 3);
        }
        return s.trim();
    }

    private static String truncateForLog(String text, int maxLen) {
        if (text == null) return "(null)";
        if (text.length() <= maxLen) return text;
        return text.substring(0, maxLen) + "\n... [truncated, total " + text.length() + " chars]";
    }

    private void appendToChunkLog(String sectionLabel, String content) {
        try {
            Path path = Paths.get(CHUNK_LOG_FILE);
            String block = "\n========== " + Instant.now() + " " + sectionLabel + " ==========\n"
                + (content != null ? content : "(null)")
                + "\n";
            Files.write(path, block.getBytes(StandardCharsets.UTF_8),
                StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (Exception e) {
            LOG.warnf("Could not write to %s: %s", CHUNK_LOG_FILE, e.getMessage());
        }
    }

    /**
     * Removes image and binary content from document text before chunking:
     * - data:image/...;base64,... (inline base64 images)
     * - Markdown image syntax ![alt](url)
     * - Long lines that look like raw base64 (e.g. 200+ chars of A–Z, a–z, 0–9, +, /, =)
     */
    private String stripImageAndBinaryContent(String text) {
        if (text == null || text.isEmpty()) return text;
        String s = text;
        // Remove markdown images with data:image URL first (handles line-wrapped base64)
        s = MARKDOWN_DATA_IMAGE.matcher(s).replaceAll(" ");
        s = DATA_URI_BASE64.matcher(s).replaceAll(" ");
        s = MARKDOWN_IMAGE.matcher(s).replaceAll(" ");
        s = BASE64_LINE.matcher(s).replaceAll("");
        return s.replaceAll("(?m)\\n{3,}", "\n\n").trim();
    }

    private static ArtistDataDto.PerChunkResultDto emptyChunkResult(String chunkId) {
        ArtistDataDto.PerChunkResultDto r = new ArtistDataDto.PerChunkResultDto();
        r.chunkId = chunkId;
        r.artists = List.of();
        return r;
    }
}
