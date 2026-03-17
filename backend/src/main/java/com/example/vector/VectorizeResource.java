package com.example.vector;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.Instant;
import java.util.Map;

@Path("/api")
public class VectorizeResource {

    private final VectorStoreService vectorStore;

    @jakarta.inject.Inject
    public VectorizeResource(VectorStoreService vectorStore) {
        this.vectorStore = vectorStore;
    }

    @POST
    @Path("/vectorize")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response vectorize(VectorizeRequest request) {
        if (request == null || request.documentName == null || request.text == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "documentName and text are required"))
                    .build();
        }
        try {
            Instant uploadTime = request.uploadTime != null ? Instant.parse(request.uploadTime) : Instant.now();
            vectorStore.vectorize(request.documentName.trim(), uploadTime, request.text);
            return Response.ok(Map.of("status", "ok", "message", "Document vectorized and stored")).build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", e.getMessage()))
                    .build();
        }
    }

    public static class VectorizeRequest {
        public String documentName;
        public String uploadTime; // ISO-8601
        public String text;
    }
}
