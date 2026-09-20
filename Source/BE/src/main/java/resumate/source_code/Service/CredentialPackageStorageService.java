package resumate.source_code.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import resumate.source_code.DTO.CredentialPackageUploadRequest;
import resumate.source_code.DTO.CredentialPackageUploadResponse;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class CredentialPackageStorageService {
    private static final Pattern SHA256_HEX = Pattern.compile("^[0-9a-fA-F]{64}$");
    private static final int MAX_PACKAGE_BYTES = 10 * 1024 * 1024;
    private final CloudinaryUploadClient uploadClient;
    private final String folder;

    public CredentialPackageStorageService(
            CloudinaryUploadClient uploadClient,
            @Value("${cloudinary.credential-folder:resumate/credentials}") String folder) {
        this.uploadClient = uploadClient;
        this.folder = folder;
    }

    public CredentialPackageUploadResponse upload(CredentialPackageUploadRequest request) {
        validate(request);
        byte[] envelopeJson = buildEnvelopeJson(request);
        if (envelopeJson.length > MAX_PACKAGE_BYTES) {
            throw new IllegalArgumentException("Encrypted package exceeds maximum size.");
        }
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

    private void validate(CredentialPackageUploadRequest request) {
        if (request.algorithm() == null || !"AES-256-GCM".equals(request.algorithm())) {
            throw new IllegalArgumentException("Unsupported or missing algorithm. Must be AES-256-GCM.");
        }
        if (request.ivBase64() == null || request.ivBase64().isBlank()) {
            throw new IllegalArgumentException("Initialization vector is required.");
        }
        if (request.ciphertextBase64() == null || request.ciphertextBase64().isBlank()) {
            throw new IllegalArgumentException("Encrypted ciphertext is required.");
        }
        if (request.documentHash() == null || !SHA256_HEX.matcher(request.documentHash()).matches()) {
            throw new IllegalArgumentException("Document hash must be a 64-character hex SHA-256 value.");
        }
        if (request.claimsHash() == null || !SHA256_HEX.matcher(request.claimsHash()).matches()) {
            throw new IllegalArgumentException("Claims hash must be a 64-character hex SHA-256 value.");
        }
        if (request.claims() == null || request.claims().isEmpty()) {
            throw new IllegalArgumentException("Claims envelope is required.");
        }
        if (!"application/pdf".equalsIgnoreCase(request.mimeType())
                || request.originalFileName() == null
                || !request.originalFileName().toLowerCase().endsWith(".pdf")) {
            throw new IllegalArgumentException("Credential document must be a PDF file.");
        }
        try {
            Base64.getDecoder().decode(request.ivBase64());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("IV must be valid Base64.");
        }
        try {
            Base64.getDecoder().decode(request.ciphertextBase64());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Ciphertext must be valid Base64.");
        }
    }

    private byte[] buildEnvelopeJson(CredentialPackageUploadRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"version\":").append(request.version() != null ? request.version() : 1).append(",");
        sb.append("\"algorithm\":\"").append(escapeJson(request.algorithm())).append("\",");
        sb.append("\"iv\":\"").append(escapeJson(request.ivBase64())).append("\",");
        sb.append("\"ciphertextBase64\":\"").append(escapeJson(request.ciphertextBase64())).append("\",");
        sb.append("\"documentHash\":\"").append(escapeJson(request.documentHash())).append("\",");
        sb.append("\"claimsHash\":\"").append(escapeJson(request.claimsHash())).append("\",");
        sb.append("\"claims\":{");
        boolean first = true;
        for (Map.Entry<String, String> entry : request.claims().entrySet()) {
            if (!first) sb.append(",");
            sb.append("\"").append(escapeJson(entry.getKey())).append("\":");
            sb.append("\"").append(escapeJson(entry.getValue())).append("\"");
            first = false;
        }
        sb.append("},");
        sb.append("\"mimeType\":\"").append(escapeJson(request.mimeType())).append("\",");
        sb.append("\"originalFileName\":\"").append(escapeJson(request.originalFileName())).append("\"");
        sb.append("}");
        return sb.toString().getBytes(StandardCharsets.UTF_8);
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
