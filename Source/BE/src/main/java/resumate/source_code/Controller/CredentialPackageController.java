package resumate.source_code.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import resumate.source_code.DTO.CredentialPackageUploadRequest;
import resumate.source_code.DTO.CredentialPackageUploadResponse;
import resumate.source_code.Service.CredentialPackageStorageService;

import java.util.Map;

@RestController
@RequestMapping("/credentials")
public class CredentialPackageController {
    private final CredentialPackageStorageService storageService;

    public CredentialPackageController(CredentialPackageStorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping("/upload-encrypted")
    public ResponseEntity<CredentialPackageUploadResponse> uploadEncrypted(
            @RequestBody CredentialPackageUploadRequest request) {
        return ResponseEntity.ok(storageService.upload(request));
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
