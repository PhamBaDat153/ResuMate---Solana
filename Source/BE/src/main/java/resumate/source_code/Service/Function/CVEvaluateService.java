package resumate.source_code.Service.Function;

import resumate.source_code.DTO.EvaluateRequest;
import resumate.source_code.DTO.EvaluateResponse;

public interface CVEvaluateService {
    public EvaluateResponse evaluateCV(EvaluateRequest request);
}
