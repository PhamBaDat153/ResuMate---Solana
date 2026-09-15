package resumate.source_code.Service;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import resumate.source_code.Model.JobListing;
import resumate.source_code.Model.JobSearchCriteria;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Component
public class RemotiveJobProvider implements JobProvider {
    private final RestClient client = RestClient.builder().baseUrl("https://remotive.com").build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String source() {
        return "remotive";
    }

    @Override
    public List<JobListing> search(JobSearchCriteria criteria) {
        try {
            String query = criteria.targetRoleOrAny().isBlank()
                    ? ""
                    : "?search=" + URLEncoder.encode(criteria.targetRoleOrAny(), StandardCharsets.UTF_8);
            String body = client.get().uri("/api/remote-jobs" + query).retrieve().body(String.class);
            JsonNode jobs = objectMapper.readTree(body).path("jobs");
            List<JobListing> result = new ArrayList<>();
            for (JsonNode job : jobs) {
                String description = job.path("description").asText("");
                String title = job.path("title").asText("");
                if (!matchesText(title + " " + description, criteria)) continue;
                result.add(new JobListing(
                        job.path("id").asText(), source(), title,
                        job.path("company_name").asText("Unknown company"),
                        description, job.path("candidate_required_location").asText("Remote"),
                        "Remote", job.path("salary").asText("Not specified"), job.path("url").asText("")));
                if (result.size() >= 20) break;
            }
            return result;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private boolean matchesText(String text, JobSearchCriteria criteria) {
        if (!criteria.locationOrAny().isBlank()
                && !text.toLowerCase().contains(criteria.locationOrAny().toLowerCase())) return false;
        return true;
    }
}
