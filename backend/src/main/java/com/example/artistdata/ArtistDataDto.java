package com.example.artistdata;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * DTOs for artist data extraction API.
 */
public final class ArtistDataDto {

    /** Request: raw document text to process. */
    public static class ExtractRequest {
        public String rawText;
    }

    /** A single chunk with metadata. */
    public static class ChunkDto {
        public String chunkId;
        public int startOffset;
        public int endOffset;
        public String text;
    }

    /** Per-chunk extracted artist entry (LLM output shape). */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PerChunkArtistDto {
        public String name;
        public Double price;
        /** Optional unit, e.g. "per hour", "per day", "per performance", "flat". */
        public String unit;
        public String currency;
        public String rawPriceText;
        public String evidence;
        public String confidence; // high | medium | low
    }

    /** Per-chunk extraction result (LLM output shape). */
    public static class PerChunkResultDto {
        public String chunkId;
        public List<PerChunkArtistDto> artists;
    }

    /** Merged final artist entry. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MergedArtistDto {
        public String artist;
        public Double price;
        /** Optional unit, e.g. "per hour", "per performance", "flat". */
        public String unit;
        public String currency;
        public List<String> sourceChunks;
        public List<String> evidence;
    }

    /** Merged result. */
    public static class MergedResultDto {
        public List<MergedArtistDto> artists;
    }

    /** Simplified row for downstream consumption. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SimplifiedArtistDto {
        public String artist;
        public Double price;
        /** Optional unit, e.g. "per hour", "per performance", "flat". */
        public String unit;
        public String currency;
    }

    /** Full API response. */
    public static class ExtractResponse {
        public List<ChunkDto> chunks;
        public List<PerChunkResultDto> perChunkResults;
        public MergedResultDto merged;
        public List<SimplifiedArtistDto> simplified;
    }

    private ArtistDataDto() {}
}
