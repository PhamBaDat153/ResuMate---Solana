package resumate.source_code.Ultility;

import resumate.source_code.DTO.EvaluateResponse;

public interface LLMEvaluator {
    EvaluateResponse evaluate(String cvText, String jdText);
}
