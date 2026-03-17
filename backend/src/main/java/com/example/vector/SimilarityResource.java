package com.example.vector;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Path("/api")
public class SimilarityResource {

    private final VectorStoreService vectorStore;

    @jakarta.inject.Inject
    public SimilarityResource(VectorStoreService vectorStore) {
        this.vectorStore = vectorStore;
    }

    @GET
    @Path("/similarity")
    @Produces(MediaType.APPLICATION_JSON)
    public Response similarity(@QueryParam("q") String query) {
        if (query == null || query.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Query parameter 'q' is required"))
                    .build();
        }
        try {
            List<VectorStoreService.ChunkMatch> matches = vectorStore.similaritySearch(query.trim());
            long totalChunks = vectorStore.getChunkCount();
            List<Map<String, Object>> results = matches.stream()
                    .map(m -> Map.<String, Object>of(
                            "documentName", m.documentName,
                            "uploadTime", m.uploadTime != null ? m.uploadTime.toString() : "",
                            "chunkText", m.chunkText,
                            "distance", m.distance
                    ))
                    .collect(Collectors.toList());
            return Response.ok(Map.of("results", results, "totalChunks", totalChunks)).build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", e.getMessage()))
                    .build();
        }
    }
}
