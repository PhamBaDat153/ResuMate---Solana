package resumate.source_code.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import resumate.source_code.DTO.EvaluateRequest;
import resumate.source_code.DTO.EvaluateResponse;
import resumate.source_code.Service.Function.CVEvaluateService;

import java.util.Map;

@RestController
public class EvaluateController {

    private final CVEvaluateService cvEvaluateService;

    public EvaluateController(CVEvaluateService cvEvaluateService) {
        this.cvEvaluateService = cvEvaluateService;
    }

    @GetMapping("/evaluate")
    public ResponseEntity<Map<String, String>> evaluatePage() {
        return ResponseEntity.ok(Map.of(
                "endpoint", "/evaluate",
                "method", "POST",
                "description", "Submit a CV and job description for evaluation"
        ));
    }

    @PostMapping("/evaluate")
    public ResponseEntity<?> evaluate(@ModelAttribute EvaluateRequest request) {
        if (request.getCv() == null || request.getCv().isEmpty()) {
            return respondError("Vui lòng chọn file CV.");
        }
        boolean hasJdText = request.getJobDescription() != null && !request.getJobDescription().isBlank();
        boolean hasJdFile = request.getJobDescriptionFile() != null && !request.getJobDescriptionFile().isEmpty();
        if (!hasJdText && !hasJdFile) {
            return respondError("Vui lòng cung cấp mô tả công việc (dán văn bản hoặc tải file).");
        }

        EvaluateResponse result = cvEvaluateService.evaluateCV(request);
        return ResponseEntity.ok(result);
    }

    @ExceptionHandler({IllegalArgumentException.class, RuntimeException.class})
    public ResponseEntity<Map<String, String>> handleFileError(Exception e) {
        return respondError("Không thể đọc file. Vui lòng chọn file PDF hoặc DOCX hợp lệ.");
    }

    private ResponseEntity<Map<String, String>> respondError(String message) {
        return ResponseEntity.badRequest().body(Map.of("error", message));
    }
}
