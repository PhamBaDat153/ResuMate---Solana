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
        if (request.getCv() == null || request.getCv().isEmpty()) {
            throw new IllegalArgumentException("CV is missing");
        }
        String cvText = extractText(request.getCv());
        if (cvText.isBlank()) {
            throw new IllegalArgumentException("CV contains no readable text");
        }
        int minimumScore = request.getMinimumMatchScore() == null ? 70 : request.getMinimumMatchScore();
        if (minimumScore < 0 || minimumScore > 100) {
            throw new IllegalArgumentException("Minimum match score must be between 0 and 100");
        }
        return jobMatcher.match(cvText, request.getLocation(), request.getWorkMode(), request.getTargetRole(), minimumScore);
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
