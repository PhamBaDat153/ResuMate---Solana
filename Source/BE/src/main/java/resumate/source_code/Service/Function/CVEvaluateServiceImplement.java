package resumate.source_code.Service.Function;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import resumate.source_code.DTO.EvaluateRequest;
import resumate.source_code.DTO.EvaluateResponse;
import resumate.source_code.DTO.KeywordMatch;
import resumate.source_code.Model.FileType;
import resumate.source_code.Ultility.KeywordExtractor;
import resumate.source_code.Ultility.LLMEvaluator;

import java.io.IOException;

@Service
public class CVEvaluateServiceImplement implements CVEvaluateService {

    private final KeywordExtractor keywordExtractor;
    private final LLMEvaluator llmEvaluator;

    public CVEvaluateServiceImplement(KeywordExtractor keywordExtractor, LLMEvaluator llmEvaluator) {
        this.keywordExtractor = keywordExtractor;
        this.llmEvaluator = llmEvaluator;
    }

    @Override
    public EvaluateResponse evaluateCV(EvaluateRequest request) {
        String cvText = extractText(request.getCv());
        String jdText = resolveJobDescription(request);

        System.out.println("CV text: " + cvText);
        System.out.println("JD text: " + jdText);

        KeywordMatch match = keywordExtractor.extract(cvText, jdText);
        System.out.println("Match: " + match);

        EvaluateResponse ai = llmEvaluator.evaluate(cvText, jdText);

        return EvaluateResponse.builder()
                .score(ai.getScore())
                .summary(ai.getSummary())
                .matchedKeywords(match.matched())
                .missingKeywords(match.missing())
                .suitablePoints(ai.getSuitablePoints())
                .unsuitablePoints(ai.getUnsuitablePoints())
                .suggestions(ai.getSuggestions())
                .build();
    }

    private String resolveJobDescription(EvaluateRequest request) {
        if (request.getJobDescription() != null && !request.getJobDescription().isBlank()) {
            return request.getJobDescription();
        }
        if (request.getJobDescriptionFile() != null && !request.getJobDescriptionFile().isEmpty()) {
            return extractText(request.getJobDescriptionFile());
        }
        throw new IllegalArgumentException("Job description is missing");
    }

    private String extractText(MultipartFile file) {
        FileType fileType = FileType.detect(file);

        try {
            switch (fileType) {
                case PDF:
                    try (PDDocument document = Loader.loadPDF(file.getBytes())) {
                        return new PDFTextStripper().getText(document);
                    }
                case DOCX:
                    try (XWPFDocument document = new XWPFDocument(file.getInputStream())) {
                        return new XWPFWordExtractor(document).getText();
                    }
                default:
                    throw new IllegalArgumentException("Unsupported file type");
            }
        } catch (IOException e) {
            throw new RuntimeException("Cannot read file", e);
        }
    }

}
