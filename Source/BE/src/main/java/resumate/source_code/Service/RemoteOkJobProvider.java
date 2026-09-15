package resumate.source_code.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import resumate.source_code.Model.JobListing;
import resumate.source_code.Model.JobSearchCriteria;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

@Component
public class RemoteOkJobProvider implements JobProvider {
    private final RestClient client = RestClient.builder().build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String apiUrl;

    public RemoteOkJobProvider(@Value("${jobs.remoteok.api-url:https://remoteok.com/api}") String apiUrl) {
        this.apiUrl = apiUrl;
    }

    @Override
    public String source() {
        return "remoteok";
    }

    @Override
    public List<JobListing> search(JobSearchCriteria criteria) {
        try {
            JsonNode root = objectMapper.readTree(client.get().uri(apiUrl).retrieve().body(String.class));
            List<JobListing> results = new ArrayList<>();
            for (JsonNode job : root) {
                String title = job.path("position").asText("");
                String description = job.path("description").asText("");
                String location = job.path("location").asText("Remote");
                if (!matches(title + " " + description, location, criteria)) continue;
                results.add(new JobListing(
                        job.path("id").asText(job.path("slug").asText()), source(), title,
                        job.path("company").asText("Unknown company"), description,
                        location.isBlank() ? "Remote" : location, "Remote",
                        salary(job), job.path("url").asText("")));
                if (results.size() >= 20) break;
            }
            return results;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private boolean matches(String text, String location, JobSearchCriteria criteria) {
        return (criteria.targetRoleOrAny().isBlank() || text.toLowerCase().contains(criteria.targetRoleOrAny().toLowerCase()))
                && (criteria.locationOrAny().isBlank() || location.toLowerCase().contains(criteria.locationOrAny().toLowerCase()));
    }

    private String salary(JsonNode job) {
        long min = job.path("salary_min").asLong(0);
        long max = job.path("salary_max").asLong(0);
        if (min == 0 && max == 0) return "Not specified";
        return min > 0 && max > 0 ? min + " - " + max : String.valueOf(Math.max(min, max));
    }
}
