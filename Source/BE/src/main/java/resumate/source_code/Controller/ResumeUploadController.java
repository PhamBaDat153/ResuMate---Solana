package resumate.source_code.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import resumate.source_code.DTO.ResumeUploadResponse;
import resumate.source_code.Service.ResumeStorageService;

import java.util.Map;

@RestController
public class ResumeUploadController {
    private final ResumeStorageService storageService;

    public ResumeUploadController(ResumeStorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping("/resume-versions/upload")
    public ResponseEntity<ResumeUploadResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("publicAcknowledged") boolean publicAcknowledged) {
        if (!publicAcknowledged) {
            throw new IllegalArgumentException("Public document acknowledgment is required.");
        }
        return ResponseEntity.ok(storageService.upload(file));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> validationError(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<Map<String, String>> storageError(IllegalStateException error) {
        return ResponseEntity.status(503).body(Map.of("error", error.getMessage()));
    }
}
