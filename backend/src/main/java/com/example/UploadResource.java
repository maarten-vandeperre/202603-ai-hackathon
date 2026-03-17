package com.example;

import com.example.docling.DoclingApi;
import com.example.docling.DoclingConvertRequest;
import com.example.docling.DoclingConvertResponse;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.jboss.resteasy.reactive.RestForm;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Path("/api")
public class UploadResource {

    private static final Logger LOG = Logger.getLogger(UploadResource.class);

    @Inject
    @org.eclipse.microprofile.rest.client.inject.RestClient
    DoclingApi doclingApi;

    @POST
    @Path("/upload")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    @Produces(MediaType.APPLICATION_JSON)
    public Response upload(@RestForm("file") org.jboss.resteasy.reactive.multipart.FileUpload file) {
        if (file == null || file.filePath() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "No file provided"))
                    .build();
        }

        String filename = file.fileName();
        if (filename == null || filename.isBlank()) {
            filename = "document";
        }

        try {
            byte[] bytes = java.nio.file.Files.readAllBytes(file.filePath());
            String base64 = Base64.getEncoder().encodeToString(bytes);

            DoclingConvertRequest request = new DoclingConvertRequest();
            request.sources = List.of(DoclingConvertRequest.Source.file(filename, base64));
            request.options = DoclingConvertRequest.Options.defaults();

            DoclingConvertResponse response = doclingApi.convertSource(request);

            if (response.errors != null && !response.errors.isEmpty()) {
                LOG.warnf("Docling errors: %s", response.errors);
            }

            DoclingConvertResponse.DocumentResult doc = response.document != null
                    ? response.document
                    : (response.documents != null && !response.documents.isEmpty() ? response.documents.get(0) : null);
            if (doc != null) {
                return Response.ok(Map.of(
                        "filename", filename,
                        "status", response.status != null ? response.status : "ok",
                        "processingTime", response.processingTime != null ? response.processingTime : 0,
                        "markdown", doc.mdContent != null ? doc.mdContent : "",
                        "text", doc.textContent != null ? doc.textContent : "",
                        "errors", response.errors != null ? response.errors.stream()
                                .map(e -> e.message)
                                .collect(Collectors.toList()) : List.of()
                )).build();
            }

            return Response.status(422)
                    .entity(Map.of(
                            "error", "Docling returned no document",
                            "errors", response.errors != null ? response.errors : List.of()
                    ))
                    .build();

        } catch (Exception e) {
            LOG.error("Failed to process file", e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", e.getMessage()))
                    .build();
        }
    }
}
