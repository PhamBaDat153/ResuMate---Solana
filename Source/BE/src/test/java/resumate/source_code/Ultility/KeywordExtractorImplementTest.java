package resumate.source_code.Ultility;

import org.junit.jupiter.api.Test;
import resumate.source_code.DTO.KeywordMatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KeywordExtractorImplementTest {

    private final KeywordExtractor extractor = new KeywordExtractorImplement();

    @Test
    void matchesCanonicalTermsAndSynonyms() {
        KeywordMatch match = extractor.extract(
                "Experienced with JavaScript, Spring Boot, and giao tiếp.",
                "JavaScript, Spring Boot, and communication are required.");

        assertEquals(java.util.List.of("JavaScript", "Spring Boot", "communication"), match.matched());
        assertTrue(match.missing().isEmpty());
    }

    @Test
    void reportsJdKeywordsMissingFromCv() {
        KeywordMatch match = extractor.extract("Java experience", "Java and Docker experience");

        assertEquals(java.util.List.of("Java"), match.matched());
        assertEquals(java.util.List.of("Docker"), match.missing());
    }

    @Test
    void doesNotMatchKeywordInsideLongerTerm() {
        KeywordMatch match = extractor.extract("JavaScript developer", "Java experience");

        assertTrue(match.matched().isEmpty());
        assertEquals(java.util.List.of("Java"), match.missing());
    }
}
