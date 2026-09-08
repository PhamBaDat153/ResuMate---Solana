package resumate.source_code.Ultility;

import resumate.source_code.DTO.KeywordMatch;

public interface KeywordExtractor {
    KeywordMatch extract(String cvText, String jdText);
}
