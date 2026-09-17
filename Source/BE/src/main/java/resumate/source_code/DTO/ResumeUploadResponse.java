package resumate.source_code.DTO;

public record ResumeUploadResponse(
        String contentUri,
        String providerId,
        String mediaType,
        String fileName,
        long size,
        String contentHash) {
}
