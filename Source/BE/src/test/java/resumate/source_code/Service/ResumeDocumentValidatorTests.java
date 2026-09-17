package resumate.source_code.Service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResumeDocumentValidatorTests {
    private final ResumeDocumentValidator validator = new ResumeDocumentValidator(16);

    @Test
    void acceptsMatchingPdfAndDocxSignatures() {
        var pdf = new MockMultipartFile("file", "cv.pdf", "application/pdf", "%PDF-1.7".getBytes());
        var docx = new MockMultipartFile(
                "file", "cv.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                new byte[]{'P', 'K', 3, 4, 1});

        assertEquals("application/pdf", validator.validate(pdf).mediaType());
        assertEquals("cv.docx", validator.validate(docx).fileName());
    }

    @Test
    void rejectsEmptyMismatchBadSignatureAndOversize() {
        assertThrows(IllegalArgumentException.class, () -> validator.validate(
                new MockMultipartFile("file", "cv.pdf", "application/pdf", new byte[0])));
        assertThrows(IllegalArgumentException.class, () -> validator.validate(
                new MockMultipartFile("file", "cv.pdf",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        new byte[]{'P', 'K', 3, 4})));
        assertThrows(IllegalArgumentException.class, () -> validator.validate(
                new MockMultipartFile("file", "cv.pdf", "application/pdf", "plain text".getBytes())));
        assertThrows(IllegalArgumentException.class, () -> validator.validate(
                new MockMultipartFile("file", "cv.pdf", "application/pdf", new byte[17])));
    }
}
