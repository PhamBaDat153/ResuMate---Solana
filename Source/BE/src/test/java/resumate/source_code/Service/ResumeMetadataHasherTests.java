package resumate.source_code.Service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ResumeMetadataHasherTests {
    @Test
    void createsCanonicalMetadataWithNfcFilenameAndFixedKeyOrder() {
        String value = new String(ResumeMetadataHasher.canonicalBytes(
                "re\u0301sume\".pdf", "application/pdf", 123456), StandardCharsets.UTF_8);
        assertEquals(
                "{\"fileName\":\"résume\\\".pdf\",\"mediaType\":\"application/pdf\",\"schema\":\"resumate.resume-metadata.v1\",\"size\":123456}",
                value);
        assertEquals("cd19fd014bed2f3a6bcb06f94e21ecf0dc2197fb94372e0fffe829b8f96268d4",
                ResumeStorageService.sha256(value.getBytes(StandardCharsets.UTF_8)));
    }
}
