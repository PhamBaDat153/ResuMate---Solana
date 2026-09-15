package resumate.source_code.Ultility;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import resumate.source_code.DTO.EvaluateResponse;

import java.util.List;
import java.util.Map;

@Service
public class GeminiEvaluatorImplement implements LLMEvaluator {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final RestClient xkiroClient;
    private final String xkiroApiKey;
    private final String xkiroModel;

    public GeminiEvaluatorImplement(@Value("${gemini.api-key}") String apiKey,
                                    @Value("${gemini.model}") String model,
                                    @Value("${xkiro.base-url:https://api.xkiro.com/v1}") String xkiroBaseUrl,
                                    @Value("${xkiro.api-key:}") String xkiroApiKey,
                                    @Value("${xkiro.model:deepseek/deepseek-v4.1-flash:free}") String xkiroModel) {
        this.restClient = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com")
                .build();
        this.objectMapper = new ObjectMapper();
        this.apiKey = apiKey;
        this.model = model;
        this.xkiroClient = RestClient.builder().baseUrl(xkiroBaseUrl).build();
        this.xkiroApiKey = xkiroApiKey;
        this.xkiroModel = xkiroModel;
    }

    @Override
    public EvaluateResponse evaluate(String cvText, String jdText) {
        String prompt = buildPrompt(cvText, jdText);
        if (!apiKey.isBlank()) {
            try {
                Map<String, Object> body = Map.of(
                        "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                        "generationConfig", Map.of("responseMimeType", "application/json"));
                String responseJson = restClient.post()
                        .uri("/v1beta/models/{model}:generateContent?key={key}", model, apiKey)
                        .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class);
                return parseGemini(responseJson);
            } catch (Exception e) {
                System.err.println("Gemini CV evaluation failed with model " + model + ": " + e.getMessage());
            }
        }

        if (!xkiroApiKey.isBlank()) {
            try {
                Map<String, Object> body = Map.of(
                        "model", xkiroModel,
                        "response_format", Map.of("type", "json_object"),
                        "messages", List.of(
                                Map.of("role", "system", "content", "Return only valid JSON matching the requested schema."),
                                Map.of("role", "user", "content", prompt)));
                String responseJson = xkiroClient.post().uri("/chat/completions")
                        .header("Authorization", "Bearer " + xkiroApiKey)
                        .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(String.class);
                return parseXkiro(responseJson);
            } catch (Exception e) {
                System.err.println("xKiro CV evaluation failed with model " + xkiroModel + ": " + e.getMessage());
            }
        }
        return fallback();
    }

    private EvaluateResponse parseGemini(String responseJson) throws Exception {
        JsonNode root = objectMapper.readTree(responseJson);
        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new IllegalStateException(root.path("error").path("message").asText("No candidates returned by Gemini"));
        }
        return parseResponse(candidates.get(0).path("content").path("parts").get(0).path("text").asText());
    }

    private EvaluateResponse parseXkiro(String responseJson) throws Exception {
        JsonNode root = objectMapper.readTree(responseJson);
        JsonNode choices = root.path("choices");
        if (!choices.isArray() || choices.isEmpty()) {
            throw new IllegalStateException(root.path("error").path("message").asText("No choices returned by xKiro"));
        }
        return parseResponse(choices.get(0).path("message").path("content").asText());
    }

    private EvaluateResponse parseResponse(String text) throws Exception {
        String cleaned = text == null ? "" : text.trim();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("(?s)^```(?:json)?\\s*", "");
            cleaned = cleaned.replaceFirst("(?s)```\\s*$", "");
        }
        if (cleaned.isBlank()) throw new IllegalStateException("AI returned an empty response");
        return objectMapper.readValue(cleaned, EvaluateResponse.class);
    }

    private EvaluateResponse fallback() {
        return EvaluateResponse.builder()
                .score(0)
                .summary("Không thể đánh giá lúc này. Vui lòng thử lại.")
                .suitablePoints(List.of())
                .unsuitablePoints(List.of())
                .suggestions(List.of())
                .build();
    }

    private String buildPrompt(String cvText, String jdText) {
        return """
                Bạn là chuyên gia tuyển dụng và đánh giá CV.
                
                  Hãy đánh giá mức độ phù hợp của CV với Job Description (JD). Chỉ sử dụng thông tin có trong CV và JD; không được suy đoán hoặc bịa thêm thông tin.
                
                  THỰC HIỆN THEO CÁC BƯỚC:
                
                  1. Xác định các yêu cầu trong JD và phân loại:
                  - Must-have / bắt buộc
                  - Kinh nghiệm
                  - Technical skills
                  - Education / certification
                  - Nice-to-have
                
                  2. Đối chiếu từng yêu cầu với CV:
                  - MET: có bằng chứng rõ ràng đáp ứng
                  - PARTIAL: đáp ứng một phần
                  - MISSING: CV không có bằng chứng đáp ứng
                  - UNKNOWN: JD yêu cầu nhưng CV không đủ thông tin để xác định
                
                  Lưu ý:
                  - UNKNOWN không đồng nghĩa với MISSING.
                  - Không cộng điểm chỉ vì CV chứa một thuật ngữ giống JD; phải xét ngữ cảnh và mức độ liên quan.
                  - Ưu tiên kinh nghiệm thực tế và thành tích có bằng chứng.
                
                  3. Chấm điểm từ 0-100 theo trọng số:
                  - Must-have: 40%
                  - Relevant experience: 25%
                  - Technical skills: 20%
                  - Education / certification: 10%
                  - Nice-to-have: 5%
                
                  Nếu thiếu 1 must-have quan trọng, score tối đa 70.
                  Nếu thiếu từ 2 must-have quan trọng trở lên, score tối đa 50.
                
                  4. Đưa ra:
                  - suitablePoints: các điểm phù hợp quan trọng nhất
                  - unsuitablePoints: các điểm chưa phù hợp hoặc chưa thể xác minh
                  - suggestions: các đề xuất cụ thể để cải thiện CV cho vị trí này
                  - summary: kết luận ngắn gọn về mức độ phù hợp
                
                  QUY TẮC:
                
                  - Không đánh giá dựa trên tuổi, giới tính, ảnh, tình trạng hôn nhân, tôn giáo, dân tộc hoặc các đặc điểm không liên quan đến năng lực công việc.
                  - Không coi việc CV không đề cập một kỹ năng là bằng chứng ứng viên không có kỹ năng đó.
                  - Không lặp lại cùng một ý.
                  - Tối đa 5 phần tử cho mỗi array.
                  - Score phải nhất quán với summary.
                  - recommendation:
                    - 90-100: "strong_match"
                    - 75-89: "interview"
                    - 60-74: "borderline"
                    - 0-59: "reject"
                
                  OUTPUT:
                  Trả về DUY NHẤT một JSON object hợp lệ.
                  Không markdown.
                  Không code fence.
                  Không giải thích bên ngoài JSON.
                  Không thêm key khác.
                
                  {
                    "score": <integer 0-100>,
                    "recommendation": "<strong_match|interview|borderline|reject>",
                    "summary": "<tóm tắt bằng tiếng Việt>",
                    "suitablePoints": ["<điểm phù hợp>", "..."],
                    "unsuitablePoints": ["<điểm chưa phù hợp>", "..."],
                    "suggestions": ["<gợi ý cải thiện>", "..."]
                  }
                
                  JD:
                  {jd}
                
                  CV:
                  {cv}
                """.replace("{jd}", jdText).replace("{cv}", cvText);
    }
}
