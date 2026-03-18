package com.example.artistdata;

import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * Persists and loads the artist–price table (simplified extraction result).
 */
@ApplicationScoped
public class ArtistPriceService {

    private static final Logger LOG = Logger.getLogger(ArtistPriceService.class);

    @Inject
    DataSource dataSource;

    public List<ArtistDataDto.SimplifiedArtistDto> list() {
        List<ArtistDataDto.SimplifiedArtistDto> out = new ArrayList<>();
        String sql = "SELECT artist, price, unit, currency FROM artist_prices ORDER BY id";
        try (Connection conn = dataSource.getConnection();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                ArtistDataDto.SimplifiedArtistDto dto = new ArtistDataDto.SimplifiedArtistDto();
                dto.artist = rs.getString("artist");
                dto.price = rs.getObject("price", Double.class);
                dto.unit = rs.getString("unit");
                dto.currency = rs.getString("currency");
                out.add(dto);
            }
        } catch (SQLException e) {
            LOG.error("Failed to list artist_prices", e);
            throw new RuntimeException("Database error: " + e.getMessage());
        }
        return out;
    }

    /**
     * Append the given rows to the stored artist–price table. Existing rows are kept.
     */
    public void persist(List<ArtistDataDto.SimplifiedArtistDto> rows) {
        if (rows == null || rows.isEmpty()) return;
        String insert = "INSERT INTO artist_prices (artist, price, unit, currency) VALUES (?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection(); PreparedStatement ps = conn.prepareStatement(insert)) {
            for (ArtistDataDto.SimplifiedArtistDto row : rows) {
                ps.setString(1, row.artist != null ? row.artist : "");
                ps.setObject(2, row.price);
                ps.setString(3, row.unit);
                ps.setString(4, row.currency);
                ps.addBatch();
            }
            ps.executeBatch();
            LOG.infof("ArtistPriceService: appended %d rows (previous data unchanged)", rows.size());
        } catch (SQLException e) {
            LOG.error("Failed to persist artist_prices", e);
            throw new RuntimeException("Database error: " + e.getMessage());
        }
    }

    public void clear() {
        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement()) {
            int n = st.executeUpdate("DELETE FROM artist_prices");
            LOG.infof("ArtistPriceService: cleared %d rows", n);
        } catch (SQLException e) {
            LOG.error("Failed to clear artist_prices", e);
            throw new RuntimeException("Database error: " + e.getMessage());
        }
    }
}
