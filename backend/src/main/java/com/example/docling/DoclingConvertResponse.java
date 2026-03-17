package com.example.docling;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public class DoclingConvertResponse {

    /** v1 API returns single document */
    public DocumentResult document;
    /** Alternative: list of documents */
    public List<DocumentResult> documents;
    public List<ErrorDetail> errors;
    public String status;
    @JsonProperty("processing_time")
    public Double processingTime;
    public Map<String, Object> timings;

    public static class DocumentResult {
        @JsonProperty("md_content")
        public String mdContent;
        @JsonProperty("html_content")
        public String htmlContent;
        @JsonProperty("text_content")
        public String textContent;
        @JsonProperty("filename")
        public String filename;
    }

    public static class ErrorDetail {
        public String component;
        public String module;
        public String message;
    }
}
