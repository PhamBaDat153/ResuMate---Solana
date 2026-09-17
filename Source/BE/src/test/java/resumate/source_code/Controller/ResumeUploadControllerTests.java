package resumate.source_code.Controller;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import resumate.source_code.DTO.ResumeUploadResponse;
import resumate.source_code.Service.ResumeStorageService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResumeUploadControllerTests {
    @Test
    void requiresPublicAcknowledgmentAndReturnsUpload() {
        ResumeStorageService service = org.mockito.Mockito.mock(ResumeStorageService.class);
        var expected = new ResumeUploadResponse("https://example.com/cv.pdf", "id", "application/pdf", "cv.pdf", 5, "ab");
        org.mockito.Mockito.when(service.upload(org.mockito.ArgumentMatchers.any())).thenReturn(expected);
        var controller = new ResumeUploadController(service);
        var file = new MockMultipartFile("file", "cv.pdf", "application/pdf", "%PDF".getBytes());

        assertThrows(IllegalArgumentException.class, () -> controller.upload(file, false));
        assertEquals(expected, controller.upload(file, true).getBody());
    }

    @Test
    void mapsValidationAndStorageFailures() {
        ResumeStorageService service = org.mockito.Mockito.mock(ResumeStorageService.class);
        var controller = new ResumeUploadController(service);
        assertEquals(400, controller.validationError(new IllegalArgumentException("bad file")).getStatusCode().value());
        assertEquals(503, controller.storageError(new IllegalStateException("not configured")).getStatusCode().value());
    }
}
