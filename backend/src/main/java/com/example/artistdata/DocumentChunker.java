package com.example.artistdata;

import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Splits document text into overlapping chunks for extraction.
 * Order: page boundaries → section boundaries → paragraph groups → fixed-size fallback.
 */
@ApplicationScoped
public class DocumentChunker {

    private static final Logger LOG = Logger.getLogger(DocumentChunker.class);

    private static final int OVERLAP_CHARS = 80;
    private static final int MIN_CHUNK_SIZE = 200;
    private static final int MAX_CHUNK_SIZE = 2500;
    /** Cap total chunks (limit to 2 for now). */
    private static final int MAX_CHUNKS = 2;
    private static final Pattern PAGE_BREAK = Pattern.compile("\\f|(?i)\\bpage\\s+\\d+\\b");
    private static final Pattern SECTION_HEADER = Pattern.compile("(?m)^#{1,3}\\s+.+$|^[A-Z][a-zA-Z\\s]{5,50}:\\s*$");

    public List<ArtistDataDto.ChunkDto> chunk(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            LOG.info("DocumentChunker: empty text, returning empty chunks");
            return List.of();
        }
        String text = rawText.trim();
        List<int[]> ranges = splitIntoRanges(text);
        List<ArtistDataDto.ChunkDto> chunks = new ArrayList<>();
        for (int i = 0; i < ranges.size(); i++) {
            int[] r = ranges.get(i);
            String chunkText = text.substring(r[0], r[1]);
            ArtistDataDto.ChunkDto dto = new ArtistDataDto.ChunkDto();
            dto.chunkId = "chunk-" + i;
            dto.startOffset = r[0];
            dto.endOffset = r[1];
            dto.text = chunkText;
            chunks.add(dto);
        }
        if (chunks.isEmpty()) {
            ArtistDataDto.ChunkDto single = new ArtistDataDto.ChunkDto();
            single.chunkId = "chunk-0";
            single.startOffset = 0;
            single.endOffset = text.length();
            single.text = text;
            chunks.add(single);
        }
        LOG.infof("DocumentChunker: created %d chunks", chunks.size());
        return chunks;
    }

    private List<int[]> splitIntoRanges(String text) {
        List<int[]> ranges = new ArrayList<>();
        int len = text.length();
        if (len <= MAX_CHUNK_SIZE) {
            ranges.add(new int[]{0, len});
            return ranges;
        }

        List<Integer> splitPoints = new ArrayList<>();
        splitPoints.add(0);

        var pageMatcher = PAGE_BREAK.matcher(text);
        while (pageMatcher.find()) {
            int pos = pageMatcher.start();
            if (pos > 0 && pos < len) splitPoints.add(pos);
        }

        if (splitPoints.size() <= 1) {
            var sectionMatcher = SECTION_HEADER.matcher(text);
            while (sectionMatcher.find()) {
                int pos = sectionMatcher.start();
                if (pos > 0 && pos < len) splitPoints.add(pos);
            }
        }

        splitPoints.add(len);
        splitPoints.sort(Integer::compareTo);

        List<int[]> segmentRanges = new ArrayList<>();
        int remainderStart = -1;
        for (int i = 0; i < splitPoints.size() - 1; i++) {
            if (segmentRanges.size() >= MAX_CHUNKS) {
                remainderStart = splitPoints.get(i);
                break;
            }
            int start = splitPoints.get(i);
            int end = splitPoints.get(i + 1);
            if (end - start > MAX_CHUNK_SIZE) {
                splitByParagraphs(text, start, end, segmentRanges);
            } else {
                segmentRanges.add(new int[]{start, end});
            }
        }
        if (remainderStart >= 0 && remainderStart < len && segmentRanges.size() < MAX_CHUNKS) {
            segmentRanges.add(new int[]{remainderStart, len});
            LOG.warnf("DocumentChunker: added remainder chunk [%d, %d] after cap", remainderStart, len);
        }

        if (segmentRanges.isEmpty()) {
            segmentRanges.add(new int[]{0, text.length()});
        }

        if (segmentRanges.size() > MAX_CHUNKS) {
            segmentRanges = coalesceRanges(segmentRanges, text.length(), MAX_CHUNKS);
            LOG.warnf("DocumentChunker: coalesced to %d chunks (max %d)", segmentRanges.size(), MAX_CHUNKS);
        }

        ranges = addOverlap(text, segmentRanges);
        return ranges;
    }

    private void splitByParagraphs(String text, int start, int end, List<int[]> out) {
        String segment = text.substring(start, end);
        int pos = 0;
        int segLen = segment.length();
        while (pos < segLen) {
            if (out.size() >= MAX_CHUNKS - 1) {
                out.add(new int[]{start + pos, end});
                LOG.warnf("DocumentChunker: capped at %d chunks; remainder %d chars in one chunk", MAX_CHUNKS, end - (start + pos));
                return;
            }
            int chunkEnd = Math.min(pos + MAX_CHUNK_SIZE, segLen);
            if (chunkEnd < segLen) {
                int para = segment.lastIndexOf("\n\n", chunkEnd);
                if (para > pos) chunkEnd = para + 2;
            }
            out.add(new int[]{start + pos, start + chunkEnd});
            pos = chunkEnd - (pos + chunkEnd > OVERLAP_CHARS ? OVERLAP_CHARS : 0);
        }
    }

    /** Merge consecutive ranges so the list has at most maxChunks entries. */
    private List<int[]> coalesceRanges(List<int[]> segmentRanges, int totalLen, int maxChunks) {
        if (segmentRanges.size() <= maxChunks) return segmentRanges;
        List<int[]> out = new ArrayList<>();
        int targetSize = maxChunks;
        int n = segmentRanges.size();
        int chunkSize = (n + targetSize - 1) / targetSize;
        for (int i = 0; i < n; i += chunkSize) {
            int start = segmentRanges.get(i)[0];
            int endIdx = Math.min(i + chunkSize, n);
            int end = segmentRanges.get(endIdx - 1)[1];
            out.add(new int[]{start, end});
        }
        return out;
    }

    private List<int[]> addOverlap(String text, List<int[]> segmentRanges) {
        List<int[]> result = new ArrayList<>();
        for (int i = 0; i < segmentRanges.size(); i++) {
            int[] r = segmentRanges.get(i);
            int s = r[0];
            int e = r[1];
            if (i > 0) {
                int overlapStart = Math.max(s, s - OVERLAP_CHARS);
                s = overlapStart;
            }
            if (i < segmentRanges.size() - 1 && (e - s) < (r[1] - r[0] + OVERLAP_CHARS)) {
                int overlapEnd = Math.min(text.length(), e + OVERLAP_CHARS);
                e = overlapEnd;
            }
            result.add(new int[]{s, e});
        }
        return result;
    }
}
