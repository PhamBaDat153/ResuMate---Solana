package resumate.source_code.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.beans.factory.annotation.Value;
import resumate.source_code.DTO.EvaluateRequest;
import resumate.source_code.DTO.EvaluateResponse;
import resumate.source_code.Service.Function.CVEvaluateService;
import resumate.source_code.Service.Function.JobMatchingService;
import resumate.source_code.DTO.JobMatchRequest;

import java.util.Map;

@RestController
public class EvaluateController {

    private final CVEvaluateService cvEvaluateService;
    private final JobMatchingService jobMatchingService;
    private final String jobDiscoveryToken;

    public EvaluateController(CVEvaluateService cvEvaluateService,
                              JobMatchingService jobMatchingService,
                              @Value("${jobs.discovery.internal-token:}") String jobDiscoveryToken) {
        this.cvEvaluateService = cvEvaluateService;
        this.jobMatchingService = jobMatchingService;
        this.jobDiscoveryToken = jobDiscoveryToken;
    }

    @PostMapping("/jobs/match")
    public ResponseEntity<?> matchJobs(
            @ModelAttribute JobMatchRequest request,
            @RequestHeader(value = "X-ResuMate-Job-Token", required = false) String requestToken) {
        if (jobDiscoveryToken.isBlank() || !jobDiscoveryToken.equals(requestToken)) {
            return ResponseEntity.status(403).body(Map.of("error", "Job discovery requires a completed payment."));
        }
        try {
            return ResponseEntity.ok(jobMatchingService.findMatches(request));
        } catch (IllegalArgumentException e) {
            return respondError("Vui lòng tải lên CV PDF hoặc DOCX hợp lệ.");
        }
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
