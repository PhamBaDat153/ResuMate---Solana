package resumate.source_code.Service.Function;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import resumate.source_code.DTO.JobMatchRequest;
import resumate.source_code.DTO.JobMatchResponse;
import resumate.source_code.Model.FileType;
import resumate.source_code.Ultility.JobMatcher;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;

import java.io.IOException;

@Service
public class JobMatchingServiceImplement implements JobMatchingService {
    private final JobMatcher jobMatcher;

    public JobMatchingServiceImplement(JobMatcher jobMatcher) {
        this.jobMatcher = jobMatcher;
    }

    @Override
    public JobMatchResponse findMatches(JobMatchRequest request) {
        long startedAt = System.currentTimeMillis();
        System.out.println("[JOB_SEARCH] 1/6 Request received");
        if (request.getCv() == null || request.getCv().isEmpty()) {
            throw new IllegalArgumentException("CV is missing");
        }
        System.out.println("[JOB_SEARCH] CV file: " + request.getCv().getOriginalFilename()
                + " (" + request.getCv().getSize() + " bytes)");
        System.out.println("[JOB_SEARCH] 2/6 Extracting CV text");
        String cvText = extractText(request.getCv());
        if (cvText.isBlank()) {
            throw new IllegalArgumentException("CV contains no readable text");
        }
        int minimumScore = request.getMinimumMatchScore() == null ? 70 : request.getMinimumMatchScore();
        if (minimumScore < 0 || minimumScore > 100) {
            throw new IllegalArgumentException("Minimum match score must be between 0 and 100");
        }
        System.out.println("[JOB_SEARCH] CV extracted: " + cvText.length() + " characters");
        System.out.println("[JOB_SEARCH] Filters: role=" + value(request.getTargetRole())
                + ", location=" + value(request.getLocation())
                + ", workMode=" + value(request.getWorkMode())
                + ", minimumScore=" + minimumScore);
        System.out.println("[JOB_SEARCH] 3/6 Fetching live jobs from providers");
        JobMatchResponse result = jobMatcher.match(cvText, request.getLocation(), request.getWorkMode(), request.getTargetRole(), minimumScore);
        System.out.println("[JOB_SEARCH] 6/6 Completed in " + (System.currentTimeMillis() - startedAt)
                + " ms; returned " + (result.getMatches() == null ? 0 : result.getMatches().size()) + " matches");
        return result;
    }

    private String value(String value) {
        return value == null || value.isBlank() ? "any" : value;
    }

    private String extractText(MultipartFile file) {
        FileType fileType = FileType.detect(file);
        try {
            if (fileType == FileType.PDF) {
                try (PDDocument document = Loader.loadPDF(file.getBytes())) {
                    return new PDFTextStripper().getText(document);
                }
            }
            try (XWPFDocument document = new XWPFDocument(file.getInputStream())) {
                return new XWPFWordExtractor(document).getText();
            }
        } catch (IOException e) {
            throw new RuntimeException("Cannot read CV", e);
        }
    }
}
