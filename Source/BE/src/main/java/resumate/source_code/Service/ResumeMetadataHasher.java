package resumate.source_code.Service;

import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.Map;

public final class ResumeMetadataHasher {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ResumeMetadataHasher() {
    }

    public static byte[] canonicalBytes(String fileName, String mediaType, long size) {
        if (size < 0) {
            throw new IllegalArgumentException("Size must not be negative.");
        }
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("fileName", Normalizer.normalize(fileName, Normalizer.Form.NFC));
        metadata.put("mediaType", mediaType);
        metadata.put("schema", "resumate.resume-metadata.v1");
        metadata.put("size", size);
        try {
            return MAPPER.writeValueAsString(metadata).getBytes(StandardCharsets.UTF_8);
        } catch (Exception error) {
            throw new IllegalStateException("Could not canonicalize resume metadata.", error);
        }
    }
}
