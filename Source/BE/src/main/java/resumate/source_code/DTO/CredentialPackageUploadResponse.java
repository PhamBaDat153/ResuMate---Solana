package resumate.source_code.DTO;

public record CredentialPackageUploadResponse(
        String packageUri,
        String providerId,
        String documentHash,
        String claimsHash,
        int sizeBytes
) {}
