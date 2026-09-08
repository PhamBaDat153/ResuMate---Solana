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
public class EvaluateResponse {
    private int score;
    private String summary;
    private List<String> matchedKeywords;
    private List<String> missingKeywords;
    private List<String> suitablePoints;
    private List<String> unsuitablePoints;
    private List<String> suggestions;
}
