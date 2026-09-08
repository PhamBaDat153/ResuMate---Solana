package resumate.source_code.DTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.multipart.MultipartFile;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class EvaluateRequest {
    private MultipartFile cv;
    private String jobDescription;
    private MultipartFile jobDescriptionFile;
}