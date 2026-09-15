package resumate.source_code.DTO;

import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

@Data
public class JobMatchRequest {
    private MultipartFile cv;
    private String location;
    private String workMode;
    private String targetRole;
    private Integer minimumMatchScore = 70;
}
