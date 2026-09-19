package resumate.source_code.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import resumate.source_code.DTO.CredentialPackageUploadRequest;
import resumate.source_code.DTO.CredentialPackageUploadResponse;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Service
public class CredentialPackageStorageService {
    private final CloudinaryUploadClient uploadClient;
    private final String folder;

    public CredentialPackageStorageService(
            CloudinaryUploadClient uploadClient,
            @Value("${cloudinary.credential-folder:resumate/credentials}") String folder) {
        this.uploadClient = uploadClient;
        this.folder = folder;
    }

    public CredentialPackageUploadResponse upload(CredentialPackageUploadRequest request) {
        if (request.ciphertextBase64() == null || request.ciphertextBase64().isBlank()) {
            throw new IllegalArgumentException("Encrypted ciphertext is required. Plaintext uploads are rejected.");
        }
        if (request.ivBase64() == null || request.ivBase64().isBlank()) {
            throw new IllegalArgumentException("Initialization vector is required.");
        }
        if (!"application/pdf".equalsIgnoreCase(request.mimeType())
                || request.originalFileName() == null
                || !request.originalFileName().toLowerCase().endsWith(".pdf")) {
            throw new IllegalArgumentException("Credential document must be a PDF file.");
        }
        byte[] envelopeJson = buildEnvelopeJson(request);
        String fileName = "credential-" + System.currentTimeMillis() + ".enc.json";
        CloudinaryUploadClient.CloudinaryAsset asset = uploadClient.upload(envelopeJson, folder, fileName);
        validateUri(asset.secureUrl());
        return new CredentialPackageUploadResponse(
                asset.secureUrl(),
                asset.publicId(),
                request.documentHash(),
                request.claimsHash(),
                envelopeJson.length
        );
    }

    private byte[] buildEnvelopeJson(CredentialPackageUploadRequest request) {
        String json = "{"
                + "\"version\":1,"
                + "\"algorithm\":\"" + escapeJson(request.algorithm()) + "\","
                + "\"iv\":\"" + request.ivBase64() + "\","
                + "\"ciphertextBase64\":\"" + request.ciphertextBase64() + "\","
                + "\"documentHash\":\"" + escapeJson(request.documentHash()) + "\","
                + "\"claimsHash\":\"" + escapeJson(request.claimsHash()) + "\","
                + "\"mimeType\":\"" + escapeJson(request.mimeType()) + "\","
                + "\"originalFileName\":\"" + escapeJson(request.originalFileName()) + "\""
                + "}";
        return json.getBytes(StandardCharsets.UTF_8);
    }

    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private void validateUri(String value) {
        try {
            URI uri = new URI(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                throw new IllegalStateException("Storage returned an invalid public HTTPS URL.");
            }
            if (value.getBytes(StandardCharsets.UTF_8).length > 200) {
                throw new IllegalStateException("Package URI exceeds the on-chain 200-byte limit.");
            }
        } catch (URISyntaxException error) {
            throw new IllegalStateException("Storage returned an invalid public HTTPS URL.", error);
        }
    }
}
