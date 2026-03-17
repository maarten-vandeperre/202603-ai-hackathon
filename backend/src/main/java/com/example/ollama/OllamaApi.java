package com.example.ollama;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

@RegisterRestClient(configKey = "ollama-api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface OllamaApi {

    /** Native Ollama embeddings: POST /api/embed, response { "embeddings": [ [...], ... ] }. */
    @POST
    @Path("/api/embed")
    OllamaEmbedResponse embed(OllamaEmbedRequest request);
}
