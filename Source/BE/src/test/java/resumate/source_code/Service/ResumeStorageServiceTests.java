package resumate.source_code.Service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResumeStorageServiceTests {
    private static final byte[] PDF = "%PDF-1.7".getBytes();
    private final ResumeDocumentValidator validator = new ResumeDocumentValidator(1024);

    @Test
    void returnsStableUploadMetadataAndSha256() {
        CloudinaryUploadClient client = (bytes, folder, fileName) -> new CloudinaryUploadClient.CloudinaryAsset(
                "https://res.cloudinary.com/demo/raw/upload/v1/cv.pdf", "resumate/resumes/cv");
        var service = new ResumeStorageService(validator, client, "resumate/resumes");
        var response = service.upload(new MockMultipartFile("file", "cv.pdf", "application/pdf", PDF));

        assertEquals("resumate/resumes/cv", response.providerId());
        assertEquals(PDF.length, response.size());
        assertEquals(ResumeStorageService.sha256(PDF), response.contentHash());
    }

    @Test
    void passesOriginalFilenameToStorageClient() {
        String[] uploadedName = new String[1];
        CloudinaryUploadClient client = (bytes, folder, fileName) -> {
            uploadedName[0] = fileName;
            return new CloudinaryUploadClient.CloudinaryAsset(
                    "https://res.cloudinary.com/demo/raw/upload/v1/cv.pdf", "resumate/resumes/cv.pdf");
        };

        new ResumeStorageService(validator, client, "resumate/resumes")
                .upload(new MockMultipartFile("file", "my-resume.pdf", "application/pdf", PDF));

        assertEquals("my-resume.pdf", uploadedName[0]);
    }

    @Test
    void rejectsInvalidProviderUrlsAndPropagatesProviderFailure() {
        var http = new ResumeStorageService(validator,
                (bytes, folder, fileName) -> new CloudinaryUploadClient.CloudinaryAsset("http://example.com/cv.pdf", "id"),
                "folder");
        assertThrows(IllegalStateException.class, () -> http.upload(file()));

        var longUrl = new ResumeStorageService(validator,
                (bytes, folder, fileName) -> new CloudinaryUploadClient.CloudinaryAsset(
                        "https://example.com/" + "x".repeat(190), "id"), "folder");
        assertThrows(IllegalStateException.class, () -> longUrl.upload(file()));

        var failed = new ResumeStorageService(validator, (bytes, folder, fileName) -> {
            throw new IllegalStateException("Cloudinary upload failed.");
        }, "folder");
        assertThrows(IllegalStateException.class, () -> failed.upload(file()));
    }

    private MockMultipartFile file() {
        return new MockMultipartFile("file", "cv.pdf", "application/pdf", PDF);
    }
}
