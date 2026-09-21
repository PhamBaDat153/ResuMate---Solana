package resumate.source_code.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import resumate.source_code.DTO.PublicCredentialUploadResponse;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;

@Service
public class PublicCredentialStorageService {
    private final ResumeDocumentValidator validator;
    private final CloudinaryUploadClient uploadClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String documentFolder;
    private final String manifestFolder;

    public PublicCredentialStorageService(
            ResumeDocumentValidator validator,
            CloudinaryUploadClient uploadClient,
            @Value("${cloudinary.credential-folder:resumate/credentials}") String documentFolder,
            @Value("${cloudinary.credential-manifest-folder:resumate/credential-manifests}") String manifestFolder) {
        this.validator = validator;
        this.uploadClient = uploadClient;
        this.documentFolder = documentFolder;
        this.manifestFolder = manifestFolder;
    }

    public PublicCredentialUploadResponse upload(MultipartFile file, String claimsJson, String claimsHash) {
        var document = validator.validate(file);
        if (!"application/pdf".equalsIgnoreCase(document.mediaType())) {
            throw new IllegalArgumentException("Credential document must be a PDF file.");
        }
        if (claimsHash == null || !claimsHash.matches("^[0-9a-fA-F]{64}$")) {
            throw new IllegalArgumentException("Claims hash must be a 64-character SHA-256 value.");
        }

        String documentHash = sha256(document.bytes());
        CloudinaryUploadClient.CloudinaryAsset documentAsset = uploadClient.upload(
                document.bytes(), documentFolder, document.fileName(), "raw");
        validateUri(documentAsset.secureUrl());

        Map<String, Object> manifest = Map.of(
                "version", 1,
                "documentUri", documentAsset.secureUrl(),
                "documentHash", documentHash,
                "claimsHash", claimsHash.toLowerCase(),
                "claims", parseClaims(claimsJson),
                "mimeType", document.mediaType(),
                "originalFileName", document.fileName());
        try {
            byte[] manifestBytes = objectMapper.writeValueAsBytes(manifest);
            CloudinaryUploadClient.CloudinaryAsset manifestAsset = uploadClient.upload(
                    manifestBytes, manifestFolder, "credential-" + System.currentTimeMillis() + ".json", "raw");
            validateUri(manifestAsset.secureUrl());
            return new PublicCredentialUploadResponse(
                    manifestAsset.secureUrl(), documentAsset.secureUrl(), documentHash,
                    claimsHash.toLowerCase(), document.fileName(), document.mediaType());
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Public credential manifest could not be created.", error);
        }
    }

    private Map<String, String> parseClaims(String claimsJson) {
        try {
            Map<?, ?> parsed = objectMapper.readValue(claimsJson == null ? "{}" : claimsJson, Map.class);
            return parsed.entrySet().stream().collect(java.util.stream.Collectors.toMap(
                    entry -> String.valueOf(entry.getKey()), entry -> String.valueOf(entry.getValue())));
        } catch (Exception error) {
            throw new IllegalArgumentException("Claims must be a valid JSON object.", error);
        }
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception error) {
            throw new IllegalStateException("SHA-256 is unavailable.", error);
        }
    }

    private void validateUri(String value) {
        try {
            URI uri = new URI(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                throw new IllegalStateException("Storage returned an invalid public HTTPS URL.");
            }
            if (value.getBytes(StandardCharsets.UTF_8).length > 200) {
                throw new IllegalStateException("Credential URI exceeds the on-chain 200-byte limit.");
            }
        } catch (URISyntaxException error) {
            throw new IllegalStateException("Storage returned an invalid public HTTPS URL.", error);
        }
    }
}
