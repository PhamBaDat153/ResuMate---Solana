package resumate.source_code.Service.Function;

import resumate.source_code.DTO.JobMatchRequest;
import resumate.source_code.DTO.JobMatchResponse;

public interface JobMatchingService {
    JobMatchResponse findMatches(JobMatchRequest request);
}
