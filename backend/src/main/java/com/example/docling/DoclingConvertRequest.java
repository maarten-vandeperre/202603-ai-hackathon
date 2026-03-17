package com.example.docling;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class DoclingConvertRequest {

    public List<Source> sources;
    public Options options;

    public static class Source {
        public String kind;
        public String filename;
        @JsonProperty("base64_string")
        public String base64String;

        public static Source file(String filename, String base64Content) {
            Source s = new Source();
            s.kind = "file";
            s.filename = filename;
            s.base64String = base64Content;
            return s;
        }
    }

    public static class Options {
        @JsonProperty("to_formats")
        public List<String> toFormats = List.of("md", "text");

        public static Options defaults() {
            Options o = new Options();
            o.toFormats = List.of("md", "text");
            return o;
        }
    }
}
