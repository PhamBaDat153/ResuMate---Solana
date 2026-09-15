package resumate.source_code.Ultility;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import resumate.source_code.DTO.JobMatchResponse;
import resumate.source_code.Model.JobListing;
import resumate.source_code.Model.JobSearchCriteria;
import resumate.source_code.Service.JobAggregator;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

@Service
public class JobMatcher {
    private final RestClient geminiClient = RestClient.builder().baseUrl("https://generativelanguage.googleapis.com").build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final JobAggregator jobAggregator;
    private final String apiKey;
    private final String model;
    private final RestClient xkiroClient;
    private final String xkiroApiKey;
    private final String xkiroModel;

    public JobMatcher(JobAggregator jobAggregator,
                      @Value("${gemini.api-key}") String apiKey,
                      @Value("${gemini.model}") String model,
                      @Value("${xkiro.base-url:https://api.xkiro.com/v1}") String xkiroBaseUrl,
                      @Value("${xkiro.api-key:}") String xkiroApiKey,
                      @Value("${xkiro.model:deepseek/deepseek-v4.1-flash:free}") String xkiroModel) {
        this.jobAggregator = jobAggregator;
        this.apiKey = apiKey;
        this.model = model;
        this.xkiroClient = RestClient.builder().baseUrl(xkiroBaseUrl).build();
        this.xkiroApiKey = xkiroApiKey;
        this.xkiroModel = xkiroModel;
    }

    public JobMatchResponse match(String cv, String location, String workMode, String targetRole, int minimumMatchScore) {
        JobSearchCriteria criteria = new JobSearchCriteria(location, workMode, targetRole);
        List<JobListing> jobs = jobAggregator.search(criteria);
        if (jobs.isEmpty()) return JobMatchResponse.builder()
                .profileSummary("No live jobs matched the selected filters. Try a broader role or location.")
                .matches(List.of()).build();
        String prompt = buildPrompt(cv, jobs, criteria, minimumMatchScore);

        if (!apiKey.isBlank()) {
            try {
                System.out.println("[JOB_SEARCH] 5/6 Sending CV and " + jobs.size() + " jobs to Gemini model " + model);
                String response = geminiClient.post().uri("/v1beta/models/{model}:generateContent?key={key}", model, apiKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                                "generationConfig", Map.of("responseMimeType", "application/json")))
                        .retrieve().body(String.class);
                JsonNode root = objectMapper.readTree(response);
                JsonNode candidates = root.path("candidates");
                if (!candidates.isArray() || candidates.isEmpty()) {
                    throw new IllegalStateException(root.path("error").path("message").asText("No candidates returned by Gemini"));
                }
                String text = candidates.get(0).path("content").path("parts").get(0).path("text").asText().trim();
                if (text.isBlank()) throw new IllegalStateException("Gemini returned an empty response");
                return filterMatches(objectMapper.readValue(stripCodeFence(text), JobMatchResponse.class), minimumMatchScore, "Gemini");
            } catch (Exception exception) {
                System.err.println("Gemini job matching failed with model " + model + ": " + exception.getMessage());
            }
        } else {
            System.err.println("Gemini job matching skipped because GEMINI_API_KEY is empty");
        }

        if (!xkiroApiKey.isBlank()) {
            try {
                System.out.println("[JOB_SEARCH] 5/6 Gemini unavailable; using xKiro model " + xkiroModel);
                Map<String, Object> body = Map.of(
                        "model", xkiroModel,
                        "response_format", Map.of("type", "json_object"),
                        "messages", List.of(Map.of("role", "system", "content", "Return only valid JSON matching the requested schema."),
                                Map.of("role", "user", "content", prompt)));
                String response = xkiroClient.post().uri("/chat/completions")
                        .header("Authorization", "Bearer " + xkiroApiKey)
                        .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class);
                JsonNode root = objectMapper.readTree(response);
                JsonNode choices = root.path("choices");
                if (!choices.isArray() || choices.isEmpty()) {
                    throw new IllegalStateException(root.path("error").path("message").asText("No choices returned by xKiro"));
                }
                String text = choices.get(0).path("message").path("content").asText().trim();
                if (text.isBlank()) throw new IllegalStateException("xKiro returned an empty response");
                return filterMatches(objectMapper.readValue(stripCodeFence(text), JobMatchResponse.class), minimumMatchScore, "xKiro");
            } catch (Exception exception) {
                System.err.println("xKiro job matching failed with model " + xkiroModel + ": " + exception.getMessage());
            }
        } else {
            System.err.println("xKiro fallback skipped because XKIRO_API_KEY is empty");
        }

        return JobMatchResponse.builder()
                .profileSummary("AI validation failed. Configure GEMINI_API_KEY or XKIRO_API_KEY in BE/.env, then try again.")
                .matches(List.of()).build();
    }

    private JobMatchResponse filterMatches(JobMatchResponse result, int minimumMatchScore, String provider) {
        List<JobMatchResponse.JobMatch> matches = result.getMatches() == null ? List.of() : result.getMatches().stream()
                .filter(match -> match.getMatchScore() >= minimumMatchScore)
                .sorted((left, right) -> Integer.compare(right.getMatchScore(), left.getMatchScore()))
                .limit(6).toList();
        result.setMatches(matches);
        System.out.println("[JOB_SEARCH] " + provider + " returned " + matches.size()
                + " matches; applying minimum score " + minimumMatchScore);
        if (matches.isEmpty()) result.setProfileSummary("No live jobs reached the minimum suitability score of " + minimumMatchScore + "%.");
        return result;
    }

    private String buildPrompt(String cv, List<JobListing> jobs, JobSearchCriteria criteria, int minimumMatchScore) {
        StringBuilder listings = new StringBuilder();
        for (int i = 0; i < jobs.size(); i++) {
            JobListing job = jobs.get(i);
            listings.append("JOB ").append(i + 1).append("\n")
                    .append("title: ").append(job.title()).append("\n")
                    .append("company: ").append(job.company()).append("\n")
                    .append("location: ").append(job.location()).append("\n")
                    .append("workMode: ").append(job.workMode()).append("\n")
                    .append("salary: ").append(job.salary()).append("\n")
                    .append("url: ").append(job.url()).append("\n")
                    .append("description: ").append(job.description()).append("\n\n");
        }
        return """
                You are a fair recruitment assistant. Match the CV to the REAL job listings below.
                Never invent a job, company, score evidence, or URL. Only return jobs from the listings.
                Never use protected characteristics. Return ONLY valid JSON, with at most 6 matches sorted by score.
                The user filters are location=%s, workMode=%s, targetRole=%s. Prefer matches scoring at least %s%%.
                JSON schema: {"profileSummary":"string","matches":[{"title":"string","company":"string","location":"string","workMode":"string","salary":"string","url":"string","matchScore":0,"reason":"string","matchedSkills":["string"],"missingSkills":["string"]}]}
                CV:
                %s
                LIVE JOB LISTINGS:
                %s
                """.formatted(value(criteria.location()), value(criteria.workMode()), value(criteria.targetRole()), minimumMatchScore, cv, listings);
    }

    private String value(String value) { return value == null || value.isBlank() ? "any" : value; }

    private String stripCodeFence(String value) {
        return value.replaceFirst("(?s)^```(?:json)?\\s*", "").replaceFirst("(?s)```$", "");
    }
}
