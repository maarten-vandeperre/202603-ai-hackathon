package com.example.artistdata;

import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Validates and normalizes per-chunk extraction results: parse numbers (EU/US),
 * normalize currency, require evidence for non-null values.
 */
@ApplicationScoped
public class ChunkExtractionValidator {

    private static final Logger LOG = Logger.getLogger(ChunkExtractionValidator.class);

    private static final Pattern NUMBER_EU = Pattern.compile("([0-9]+)[,\\.]([0-9]{1,2})\\s*");
    private static final Pattern NUMBER_US = Pattern.compile("([0-9]+)\\.([0-9]{1,2})\\s*");
    private static final Pattern CURRENCY_SYMBOL = Pattern.compile("([€$£]|EUR|USD|GBP)\\s*", Pattern.CASE_INSENSITIVE);

    public ArtistDataDto.PerChunkArtistDto validate(ArtistDataDto.PerChunkArtistDto raw) {
        if (raw == null) return null;
        ArtistDataDto.PerChunkArtistDto out = new ArtistDataDto.PerChunkArtistDto();
        out.name = normalizeBlank(raw.name);
        out.unit = normalizeUnit(raw.unit);
        out.rawPriceText = normalizeBlank(raw.rawPriceText);
        out.evidence = normalizeBlank(raw.evidence);
        out.confidence = normalizeConfidence(raw.confidence);

        if (raw.rawPriceText != null && !raw.rawPriceText.isBlank() && raw.evidence != null && !raw.evidence.isBlank()) {
            Double parsed = parsePrice(raw.rawPriceText);
            if (parsed != null) {
                out.price = parsed;
                out.currency = normalizeCurrency(raw.currency != null ? raw.currency : extractCurrency(raw.rawPriceText));
            } else {
                out.price = null;
                out.currency = raw.currency != null ? normalizeCurrency(raw.currency) : null;
            }
        } else {
            out.price = null;
            out.currency = raw.currency != null && raw.evidence != null && !raw.evidence.isBlank()
                ? normalizeCurrency(raw.currency) : null;
        }

        if (out.name == null && out.price == null && out.currency == null) {
            return null;
        }
        return out;
    }

    private static String normalizeBlank(String s) {
        if (s == null || s.isBlank()) return null;
        return s.trim();
    }

    private static String normalizeUnit(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim().toLowerCase(Locale.ROOT);
        if (t.contains("hour") || "hourly".equals(t)) return "per hour";
        if (t.contains("day") || "daily".equals(t)) return "per day";
        if (t.contains("performance") || t.contains("show")) return "per performance";
        if (t.contains("flat") || t.contains("forfait") || t.contains("lump") || t.contains("project")) return "flat";
        return t.length() <= 40 ? s.trim() : null;
    }

    private static String normalizeConfidence(String s) {
        if (s == null) return "low";
        switch (s.trim().toLowerCase(Locale.ROOT)) {
            case "high": return "high";
            case "medium": return "medium";
            default: return "low";
        }
    }

    private static String normalizeCurrency(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim().toUpperCase(Locale.ROOT);
        if (t.contains("EUR") || "€".equals(t)) return "EUR";
        if (t.contains("USD") || "$".equals(t)) return "USD";
        if (t.contains("GBP") || "£".equals(t)) return "GBP";
        return t.length() <= 6 ? t : null;
    }

    private static String extractCurrency(String rawPriceText) {
        if (rawPriceText == null) return null;
        Matcher m = CURRENCY_SYMBOL.matcher(rawPriceText);
        return m.find() ? normalizeCurrency(m.group(1)) : null;
    }

    Double parsePrice(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String cleaned = raw.replaceAll("[€$£\\s]", "").trim();
        Matcher eu = NUMBER_EU.matcher(cleaned);
        if (eu.find()) {
            try {
                String whole = eu.group(1).replace(".", "");
                String dec = eu.group(2);
                return Double.parseDouble(whole + "." + dec);
            } catch (NumberFormatException e) {
                LOG.debugf("Parse price EU failed for: %s", raw);
            }
        }
        Matcher us = NUMBER_US.matcher(cleaned);
        if (us.find()) {
            try {
                return Double.parseDouble(us.group(0).trim());
            } catch (NumberFormatException e) {
                LOG.debugf("Parse price US failed for: %s", raw);
            }
        }
        try {
            return Double.parseDouble(cleaned.replace(",", "."));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
