package resumate.source_code.Model;

import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.Optional;

public enum FileType {
    PDF(".pdf", "application/pdf"),
    DOCX(".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    private final String extension;
    private final String mimeType;

    FileType(String extension, String mimeType) {
        this.extension = extension;
        this.mimeType = mimeType;
    }

    public String getExtension() {
        return extension;
    }

    public String getMimeType() {
        return mimeType;
    }

    public static Optional<FileType> fromFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return Optional.empty();
        }
        String lower = filename.toLowerCase();
        return Arrays.stream(values())
                .filter(type -> lower.endsWith(type.extension))
                .findFirst();
    }

    public static Optional<FileType> fromMimeType(String mimeType) {
        if (mimeType == null || mimeType.isBlank()) {
            return Optional.empty();
        }

        return Arrays.stream(values())
                .filter(type -> type.mimeType.equalsIgnoreCase(mimeType))
                .findFirst();
    }


    public static FileType detect(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty or null");
        }

        Optional<FileType> byMimeType = fromMimeType(file.getContentType());

        if (byMimeType.isPresent()) {
            return byMimeType.get();
        }

        return fromFilename(file.getOriginalFilename())
                .orElseThrow(() ->
                        new IllegalArgumentException("Unsupported file type"));
    }

    public static boolean isSupported(String filename) {
        return fromFilename(filename).isPresent();
    }
}
