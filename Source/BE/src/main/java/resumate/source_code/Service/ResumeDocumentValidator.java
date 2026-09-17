package resumate.source_code.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import resumate.source_code.Model.FileType;

import java.io.IOException;

@Component
public class ResumeDocumentValidator {
    private final long maximumBytes;

    public ResumeDocumentValidator(@Value("${resume.upload.max-bytes:10485760}") long maximumBytes) {
        this.maximumBytes = maximumBytes;
    }

    public ValidatedResumeDocument validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Resume file must not be empty.");
        }
        if (file.getSize() > maximumBytes) {
            throw new IllegalArgumentException("Resume file exceeds the upload size limit.");
        }

        String fileName = file.getOriginalFilename();
        FileType extensionType = FileType.fromFilename(fileName)
                .orElseThrow(() -> new IllegalArgumentException("Only PDF and DOCX resume files are supported."));
        FileType mediaType = FileType.fromMimeType(file.getContentType())
                .orElseThrow(() -> new IllegalArgumentException("Resume media type is not supported."));
        if (extensionType != mediaType) {
            throw new IllegalArgumentException("Resume extension and media type do not match.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException error) {
            throw new IllegalArgumentException("Resume file could not be read.", error);
        }
        if (!hasSignature(extensionType, bytes)) {
            throw new IllegalArgumentException("Resume file signature does not match its type.");
        }
        return new ValidatedResumeDocument(
                bytes,
                fileName == null ? "resume" + extensionType.getExtension() : fileName,
                extensionType.getMimeType());
    }

    private boolean hasSignature(FileType type, byte[] bytes) {
        if (type == FileType.PDF) {
            return bytes.length >= 5
                    && bytes[0] == '%'
                    && bytes[1] == 'P'
                    && bytes[2] == 'D'
                    && bytes[3] == 'F'
                    && bytes[4] == '-';
        }
        return bytes.length >= 4
                && bytes[0] == 'P'
                && bytes[1] == 'K'
                && (bytes[2] == 3 || bytes[2] == 5 || bytes[2] == 7)
                && (bytes[3] == 4 || bytes[3] == 6 || bytes[3] == 8);
    }

    public record ValidatedResumeDocument(byte[] bytes, String fileName, String mediaType) {
    }
}
