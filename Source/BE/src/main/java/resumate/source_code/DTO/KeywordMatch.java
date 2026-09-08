package resumate.source_code.DTO;

import java.util.List;

public record KeywordMatch(List<String> matched, List<String> missing) {
}
