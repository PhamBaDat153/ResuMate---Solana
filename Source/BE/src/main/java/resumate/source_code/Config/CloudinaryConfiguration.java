package resumate.source_code.Config;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import resumate.source_code.Service.CloudinarySdkUploadClient;
import resumate.source_code.Service.CloudinaryUploadClient;

@Configuration
public class CloudinaryConfiguration {
    @Bean
    CloudinaryUploadClient cloudinaryUploadClient(
            @Value("${cloudinary.cloud-name:}") String cloudName,
            @Value("${cloudinary.api-key:}") String apiKey,
            @Value("${cloudinary.api-secret:}") String apiSecret) {
        if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
            return (bytes, folder, fileName) -> {
                throw new IllegalStateException("Cloudinary storage is not configured.");
            };
        }
        Cloudinary cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret,
                "secure", true));
        return new CloudinarySdkUploadClient(cloudinary);
    }
}
