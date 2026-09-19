package resumate.source_code.DTO;

public record CredentialPackageUploadRequest(
        String algorithm,
        String ivBase64,
        String ciphertextBase64,
        String documentHash,
        String claimsHash,
        String mimeType,
        String originalFileName
) {}
