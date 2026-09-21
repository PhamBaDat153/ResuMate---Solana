package resumate.source_code.DTO;

public record PublicCredentialUploadResponse(
        String manifestUri,
        String documentUri,
        String documentHash,
        String claimsHash,
        String fileName,
        String mimeType
) {}
