package com.example.artistdata;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;

@Path("/api/artist-data")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ArtistDataResource {

    @Inject
    ArtistDataExtractionService extractionService;

    @Inject
    ArtistPriceService artistPriceService;

    @POST
    @Path("/extract")
    public Response extract(ArtistDataDto.ExtractRequest request) {
        if (request == null || request.rawText == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(new ErrorMessage("Missing 'rawText' in request body."))
                .build();
        }
        try {
            ArtistDataDto.ExtractResponse response = extractionService.extract(request.rawText);
            return Response.ok(response).build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(new ErrorMessage(e.getMessage()))
                .build();
        }
    }

    @GET
    @Path("/artists")
    public Response listArtists() {
        try {
            List<ArtistDataDto.SimplifiedArtistDto> list = artistPriceService.list();
            return Response.ok(list).build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(new ErrorMessage(e.getMessage()))
                .build();
        }
    }

    @POST
    @Path("/artists")
    public Response persistArtists(List<ArtistDataDto.SimplifiedArtistDto> body) {
        try {
            artistPriceService.persist(body != null ? body : List.of());
            return Response.ok().build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(new ErrorMessage(e.getMessage()))
                .build();
        }
    }

    @DELETE
    @Path("/artists")
    public Response clearArtists() {
        try {
            artistPriceService.clear();
            return Response.ok().build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(new ErrorMessage(e.getMessage()))
                .build();
        }
    }

    public static class ErrorMessage {
        public String error;
        public ErrorMessage(String error) { this.error = error; }
    }
}
