package resumate.source_code.DTO;

public record CredentialPackageUploadRequest(
        Integer version,
        String algorithm,
        String ivBase64,
        String ciphertextBase64,
        String documentHash,
        String claimsHash,
        java.util.Map<String, String> claims,
        String mimeType,
        String originalFileName
) {}
