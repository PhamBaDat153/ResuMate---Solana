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
public class JobicyJobProvider implements JobProvider {
    private final RestClient client = RestClient.builder().build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String apiUrl;

    public JobicyJobProvider(@Value("${jobs.jobicy.api-url:https://jobicy.com/api/v2/remote-jobs}") String apiUrl) {
        this.apiUrl = apiUrl;
    }

    @Override
    public String source() {
        return "jobicy";
    }

    @Override
    public List<JobListing> search(JobSearchCriteria criteria) {
        try {
            JsonNode jobs = objectMapper.readTree(client.get().uri(apiUrl).retrieve().body(String.class)).path("jobs");
            List<JobListing> results = new ArrayList<>();
            for (JsonNode job : jobs) {
                String title = job.path("jobTitle").asText("");
                String description = job.path("jobDescription").asText("");
                String location = job.path("jobGeo").asText("Remote");
                if (!matches(title + " " + description, location, criteria)) continue;
                results.add(new JobListing(
                        job.path("id").asText(job.path("url").asText()), source(), title,
                        job.path("companyName").asText("Unknown company"), description,
                        location, "Remote", job.path("salary").asText(job.path("salaryMin").asText("Not specified")),
                        job.path("url").asText("")));
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
}
