package resumate.source_code.Service;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import resumate.source_code.Model.JobListing;
import resumate.source_code.Model.JobSearchCriteria;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

@Component
public class ArbeitnowJobProvider implements JobProvider {
    private final RestClient client = RestClient.builder().baseUrl("https://www.arbeitnow.com").build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String source() {
        return "arbeitnow";
    }

    @Override
    public List<JobListing> search(JobSearchCriteria criteria) {
        try {
            String body = client.get().uri("/api/job-board-api").retrieve().body(String.class);
            JsonNode jobs = objectMapper.readTree(body).path("data");
            List<JobListing> result = new ArrayList<>();
            for (JsonNode job : jobs) {
                String title = job.path("title").asText("");
                String description = job.path("description").asText("");
                String location = job.path("location").asText("Not specified");
                if (!containsRole(title + " " + description, criteria.targetRoleOrAny())
                        || (!criteria.locationOrAny().isBlank()
                        && !location.toLowerCase().contains(criteria.locationOrAny().toLowerCase()))) continue;
                result.add(new JobListing(
                        job.path("slug").asText(job.path("url").asText()), source(), title,
                        job.path("company_name").asText("Unknown company"), description, location,
                        job.path("remote").asBoolean(false) ? "Remote" : "On-site",
                        "Not specified", job.path("url").asText("")));
                if (result.size() >= 20) break;
            }
            return result;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private boolean containsRole(String text, String role) {
        return role.isBlank() || text.toLowerCase().contains(role.toLowerCase());
    }
}
