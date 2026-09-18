package resumate.source_code.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import resumate.source_code.DTO.ResumeUploadResponse;

import java.net.URI;
import java.net.URISyntaxException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Service
public class ResumeStorageService {
    private final ResumeDocumentValidator validator;
    private final CloudinaryUploadClient uploadClient;
    private final String folder;

    public ResumeStorageService(
            ResumeDocumentValidator validator,
            CloudinaryUploadClient uploadClient,
            @Value("${cloudinary.resume-folder:resumate/resumes}") String folder) {
        this.validator = validator;
        this.uploadClient = uploadClient;
        this.folder = folder;
    }

    public ResumeUploadResponse upload(MultipartFile file) {
        ResumeDocumentValidator.ValidatedResumeDocument document = validator.validate(file);
        CloudinaryUploadClient.CloudinaryAsset asset = uploadClient.upload(
                document.bytes(), folder, document.fileName());
        validateUri(asset.secureUrl());
        return new ResumeUploadResponse(
                asset.secureUrl(),
                asset.publicId(),
                document.mediaType(),
                document.fileName(),
                document.bytes().length,
                sha256(document.bytes()));
    }

    private void validateUri(String value) {
        try {
            URI uri = new URI(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                throw new IllegalStateException("Cloudinary returned an invalid public HTTPS URL.");
            }
            if (value.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 200) {
                throw new IllegalStateException("Cloudinary URL exceeds the on-chain URI limit.");
            }
        } catch (URISyntaxException error) {
            throw new IllegalStateException("Cloudinary returned an invalid public HTTPS URL.", error);
        }
    }

    static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable.", impossible);
        }
    }
}
