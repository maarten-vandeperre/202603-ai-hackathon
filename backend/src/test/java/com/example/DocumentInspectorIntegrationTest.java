package com.example;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.net.URL;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.*;
import static org.hamcrest.Matchers.greaterThan;

/**
 * Integration test for Document Inspector: upload PDF, store in vector DB, similarity search, RAG ask.
 * Uses the Podman Compose environment (application-test.properties): Postgres, Docling, Ollama on localhost.
 * Start compose first: podman-compose up -d  (or ./scripts/compose-up.sh -d)
 * Then: ./gradlew test --tests DocumentInspectorIntegrationTest
 */
@QuarkusTest
class DocumentInspectorIntegrationTest {

    private static final String DOCUMENT_NAME = "artist_profile_rag_test.pdf";
    private static final String QUERY = "how much does elias vermeer cost per hour";

    @Test
    void documentInspector_upload_vectorize_similarity_rag_returns_135_euro_per_hour() {
        // 1. Upload PDF (backend calls Docling stub, returns parsed text)
        File pdf = getTestPdf();
        String text = given()
                .multiPart("file", pdf)
                .when()
                .post("/api/upload")
                .then()
                .statusCode(200)
                .body("filename", is(DOCUMENT_NAME))
                .body("text", notNullValue())
                .extract().path("text");

        // 2. Store in vector database
        given()
                .contentType(ContentType.JSON)
                .body(new VectorizeBody(DOCUMENT_NAME, text))
                .when()
                .post("/api/vectorize")
                .then()
                .statusCode(200)
                .body("status", is("ok"));

        // 3. Similarity search: top result must be from this document and chunk must mention the rate
        given()
                .queryParam("q", QUERY)
                .when()
                .get("/api/similarity")
                .then()
                .statusCode(200)
                .body("results.size()", greaterThan(0))
                .body("results[0].documentName", is(DOCUMENT_NAME))
                .body("results[0].chunkText", anyOf(containsString("135"), containsString("125")));

        // 4. RAG ask: answer must mention the hourly rate in euro (document says 125 or 135 EUR/hour)
        given()
                .contentType(ContentType.JSON)
                .body(new RagAskBody(QUERY))
                .when()
                .post("/api/rag/ask")
                .then()
                .statusCode(200)
                .body("error", nullValue())
                .body("answer", notNullValue())
                .body("answer", anyOf(containsString("135"), containsString("125")))
                .body("answer", anyOf(containsString("euro"), containsString("EUR")));
    }

    private File getTestPdf() {
        URL resource = getClass().getResource("/artist_profile_rag_test.pdf");
        if (resource == null) {
            throw new IllegalStateException("Test PDF not found: src/test/resources/artist_profile_rag_test.pdf");
        }
        return new File(resource.getFile());
    }

    public static class VectorizeBody {
        public String documentName;
        public String text;

        @SuppressWarnings("unused")
        public VectorizeBody() {}

        public VectorizeBody(String documentName, String text) {
            this.documentName = documentName;
            this.text = text;
        }
    }

    public static class RagAskBody {
        public String query;

        @SuppressWarnings("unused")
        public RagAskBody() {}

        public RagAskBody(String query) {
            this.query = query;
        }
    }
}
