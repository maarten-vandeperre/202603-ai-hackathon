package com.example.rag;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/rag")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class RagResource {

    @Inject
    RagService ragService;

    @POST
    @Path("/ask")
    public Response ask(RagRequest request) {
        if (request == null || request.query == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(new RagResponse(null, null, "Missing 'query' in request body."))
                    .build();
        }
        try {
            RagService.RagResult result = ragService.ask(request.query);
            return Response.ok(new RagResponse(result.answer, result.fullPrompt, null)).build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(new RagResponse(null, null, e.getMessage()))
                    .build();
        }
    }

    public static class RagRequest {
        public String query;
    }

    public static class RagResponse {
        public String answer;
        public String fullPrompt;
        public String error;

        public RagResponse(String answer, String fullPrompt, String error) {
            this.answer = answer;
            this.fullPrompt = fullPrompt;
            this.error = error;
        }
    }
}
