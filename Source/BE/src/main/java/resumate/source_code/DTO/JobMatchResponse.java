package resumate.source_code.DTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobMatchResponse {
    private String profileSummary;
    private List<JobMatch> matches;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class JobMatch {
        private String title;
        private String company;
        private String location;
        private String workMode;
        private String salary;
        private String url;
        private int matchScore;
        private String reason;
        private List<String> matchedSkills;
        private List<String> missingSkills;
    }
}
