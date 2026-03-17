package com.example.artistdata;

import io.quarkus.runtime.StartupEvent;
import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

/**
 * Ensures the artist_prices table exists on startup (e.g. when DB was created before the table was added to init.sql).
 */
@ApplicationScoped
public class ArtistPriceTableInit {

    private static final Logger LOG = Logger.getLogger(ArtistPriceTableInit.class);

    @Inject
    DataSource dataSource;

    void onStart(@Observes StartupEvent event) {
        String ddl = "CREATE TABLE IF NOT EXISTS artist_prices ("
            + "id BIGSERIAL PRIMARY KEY, artist TEXT NOT NULL, price DOUBLE PRECISION, unit TEXT, currency TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())";
        try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement()) {
            st.execute(ddl);
            LOG.info("ArtistPriceTableInit: artist_prices table ready");
        } catch (Exception e) {
            LOG.warnf("ArtistPriceTableInit: could not ensure artist_prices table: %s", e.getMessage());
        }
    }
}
