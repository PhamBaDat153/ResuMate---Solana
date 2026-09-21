package resumate.source_code.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import resumate.source_code.DTO.PublicCredentialUploadResponse;
import resumate.source_code.Service.PublicCredentialStorageService;

import java.util.Map;

@RestController
@RequestMapping("/credentials")
public class PublicCredentialController {
    private final PublicCredentialStorageService storageService;

    public PublicCredentialController(PublicCredentialStorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping(value = "/upload-public", consumes = "multipart/form-data")
    public ResponseEntity<PublicCredentialUploadResponse> uploadPublic(
            @RequestPart("file") MultipartFile file,
            @RequestParam("claims") String claims,
            @RequestParam("claimsHash") String claimsHash) {
        return ResponseEntity.ok(storageService.upload(file, claims, claimsHash));
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
