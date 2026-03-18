package com.example.artistdata;

import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Merges per-chunk extraction results: keep all distinct (artist, price, unit, currency).
 * For each artist we output one row per distinct price/unit combination (best evidence chosen).
 * Table is cleared before persist so all rows in the editable table replace stored data.
 */
@ApplicationScoped
public class ChunkResultMerger {

    private static final Logger LOG = Logger.getLogger(ChunkResultMerger.class);

    private static final Comparator<ArtistDataDto.PerChunkArtistDto> PREFER_UNIT_THEN_CONFIDENCE = (a, b) -> {
        boolean aHourly = "per hour".equalsIgnoreCase(a.unit);
        boolean bHourly = "per hour".equalsIgnoreCase(b.unit);
        if (aHourly != bHourly) return aHourly ? -1 : 1;
        int conf = confidenceOrder(b.confidence) - confidenceOrder(a.confidence);
        if (conf != 0) return conf;
        int evLen = Integer.compare(
            (b.evidence != null ? b.evidence.length() : 0),
            (a.evidence != null ? a.evidence.length() : 0)
        );
        return evLen;
    };

    private static int confidenceOrder(String c) {
        if (c == null) return 0;
        switch (c.toLowerCase()) {
            case "high": return 3;
            case "medium": return 2;
            case "low": return 1;
            default: return 0;
        }
    }

    public ArtistDataDto.MergedResultDto merge(List<ArtistDataDto.PerChunkResultDto> perChunkResults) {
        ArtistDataDto.MergedResultDto merged = new ArtistDataDto.MergedResultDto();
        merged.artists = new ArrayList<>();

        record Entry(ArtistDataDto.PerChunkArtistDto dto, String chunkId) {}
        Map<String, List<Entry>> byNormalizedName = new LinkedHashMap<>();
        for (ArtistDataDto.PerChunkResultDto chunkResult : perChunkResults) {
            if (chunkResult == null || chunkResult.artists == null) continue;
            String cid = chunkResult.chunkId != null ? chunkResult.chunkId : "unknown";
            for (ArtistDataDto.PerChunkArtistDto a : chunkResult.artists) {
                if (a == null || (a.name == null && a.price == null)) continue;
                String name = normalizeName(a.name != null ? a.name : "Unknown");
                byNormalizedName.computeIfAbsent(name, k -> new ArrayList<>()).add(new Entry(a, cid));
            }
        }

        for (Map.Entry<String, List<Entry>> e : byNormalizedName.entrySet()) {
            List<Entry> list = e.getValue();
            list.sort((x, y) -> PREFER_UNIT_THEN_CONFIDENCE.compare(x.dto(), y.dto()));
            // Group by (price, unit, currency) and keep best entry per group so we output all distinct prices per artist
            Map<String, Entry> bestByPriceUnit = new LinkedHashMap<>();
            for (Entry entry : list) {
                ArtistDataDto.PerChunkArtistDto d = entry.dto();
                String key = keyForPriceUnit(d.price, d.unit, d.currency);
                bestByPriceUnit.putIfAbsent(key, entry);
            }
            for (Entry entry : bestByPriceUnit.values()) {
                ArtistDataDto.PerChunkArtistDto d = entry.dto();
                ArtistDataDto.MergedArtistDto m = new ArtistDataDto.MergedArtistDto();
                m.artist = d.name != null ? d.name.trim() : e.getKey();
                m.price = d.price;
                m.unit = d.unit;
                m.currency = d.currency;
                m.sourceChunks = list.stream().map(Entry::chunkId).distinct().collect(Collectors.toList());
                m.evidence = list.stream()
                    .map(Entry::dto)
                    .map(x -> x.evidence)
                    .filter(Objects::nonNull)
                    .filter(s -> !s.isBlank())
                    .distinct()
                    .limit(5)
                    .collect(Collectors.toList());
                merged.artists.add(m);
                LOG.debugf("Merge: artist=%s price=%s unit=%s sourceChunks=%s", m.artist, m.price, m.unit, m.sourceChunks);
            }
        }

        return merged;
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) return "Unknown";
        return name.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private static String keyForPriceUnit(Double price, String unit, String currency) {
        return (price != null ? price.toString() : "null") + "|" + (unit != null ? unit : "") + "|" + (currency != null ? currency : "");
    }

    public List<ArtistDataDto.SimplifiedArtistDto> toSimplified(ArtistDataDto.MergedResultDto merged) {
        if (merged == null || merged.artists == null) return List.of();
        return merged.artists.stream()
            .map(a -> {
                ArtistDataDto.SimplifiedArtistDto s = new ArtistDataDto.SimplifiedArtistDto();
                s.artist = a.artist;
                s.price = a.price;
                s.unit = a.unit;
                s.currency = a.currency;
                return s;
            })
            .collect(Collectors.toList());
    }
}
