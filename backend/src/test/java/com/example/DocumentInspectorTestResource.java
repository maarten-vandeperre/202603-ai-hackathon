package com.example;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import io.quarkus.test.common.QuarkusTestResourceLifecycleManager;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.MountableFile;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class DocumentInspectorTestResource implements QuarkusTestResourceLifecycleManager {

    private static final int EMBEDDING_DIM = 768;
    private GenericContainer<?> postgres;
    private WireMockServer wireMock;

    @Override
    public Map<String, String> start() {
        // Postgres with pgvector
        postgres = new GenericContainer<>("pgvector/pgvector:pg16")
                .withExposedPorts(5432)
                .withEnv("POSTGRES_USER", "app")
                .withEnv("POSTGRES_PASSWORD", "app")
                .withEnv("POSTGRES_DB", "vectordb")
                .withCopyFileToContainer(
                        MountableFile.forClasspathResource("db/init.sql"),
                        "/docker-entrypoint-initdb.d/01-init.sql");
        postgres.start();
        String jdbcUrl = "jdbc:postgresql://localhost:" + postgres.getMappedPort(5432) + "/vectordb";

        // WireMock for Docling and Ollama
        wireMock = new WireMockServer(WireMockConfiguration.wireMockConfig().dynamicPort());
        wireMock.start();

        String doclingText = "Artist profile: Elias Vermeer.\n\n"
                + "Elias Vermeer is a musician and performer.\n\n"
                + "Rates and pricing.\n\n"
                + "The rate for Elias Vermeer is 135 euro per hour.\n\n"
                + "Contact for bookings.\n";
        String doclingResponse = "{"
                + "\"status\":\"ok\","
                + "\"processing_time\":1.0,"
                + "\"document\":{"
                + "\"filename\":\"artist_profile_rag_test.pdf\","
                + "\"text_content\":" + jsonEscape(doclingText) + ","
                + "\"md_content\":" + jsonEscape("# Artist\n\n" + doclingText)
                + "}}";

        wireMock.stubFor(com.github.tomakehurst.wiremock.client.WireMock
                .post(com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo("/v1/convert/source"))
                .willReturn(com.github.tomakehurst.wiremock.client.WireMock.aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody(doclingResponse)));

        // 768-dim embedding vector (same for every request so similarity returns our chunks)
        String embeddingArray = Stream.generate(() -> "0.01").limit(EMBEDDING_DIM).collect(Collectors.joining(",", "[", "]"));
        String ollamaEmbedResponse = "{\"model\":\"nomic-embed-text\",\"embeddings\":[" + embeddingArray + "]}";

        wireMock.stubFor(com.github.tomakehurst.wiremock.client.WireMock
                .post(com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo("/api/embed"))
                .willReturn(com.github.tomakehurst.wiremock.client.WireMock.aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody(ollamaEmbedResponse)));

        // Ollama generate/chat for RAG (LangChain4j may call /api/generate or /api/chat)
        String ollamaGenerateResponse = "{\"model\":\"tinyllama\",\"response\":\"The cost for Elias Vermeer is 135 euro per hour.\",\"done\":true}";
        wireMock.stubFor(com.github.tomakehurst.wiremock.client.WireMock
                .post(com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching("/api/(generate|chat)"))
                .willReturn(com.github.tomakehurst.wiremock.client.WireMock.aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody(ollamaGenerateResponse)));

        String baseUrl = "http://localhost:" + wireMock.port();
        return Map.of(
                "quarkus.devservices.enabled", "false",
                "quarkus.datasource.jdbc.url", jdbcUrl,
                "quarkus.datasource.username", "app",
                "quarkus.datasource.password", "app",
                "docling.api.url", baseUrl,
                "quarkus.rest-client.docling-api.url", baseUrl,
                "ollama.api.url", baseUrl,
                "quarkus.rest-client.ollama-api.url", baseUrl,
                "quarkus.langchain4j.ollama.base-url", baseUrl
        );
    }

    private static String jsonEscape(String s) {
        if (s == null) return "null";
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }

    @Override
    public void stop() {
        if (wireMock != null) wireMock.stop();
        if (postgres != null) postgres.stop();
    }
}
