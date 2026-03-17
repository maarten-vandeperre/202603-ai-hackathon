package com.example;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api")
public class HealthResource {

    @GET
    @Path("/health")
    @Produces(MediaType.APPLICATION_JSON)
    public Response health() {
        try {
            // Docling serve has /v1/health or similar - skip dependency check for simplicity
            return Response.ok().entity(new java.util.HashMap<String, String>() {{
                put("status", "up");
                put("service", "document-service");
            }}).build();
        } catch (Exception e) {
            return Response.serverError().entity(new java.util.HashMap<String, String>() {{
                put("status", "error");
                put("message", e.getMessage());
            }}).build();
        }
    }
}
