package resumate.source_code.Service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

import java.io.IOException;
import java.util.Map;

public class CloudinarySdkUploadClient implements CloudinaryUploadClient {
    private final Cloudinary cloudinary;

    public CloudinarySdkUploadClient(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    @Override
    public CloudinaryAsset upload(byte[] bytes, String folder) {
        try {
            Map<?, ?> result = cloudinary.uploader().upload(bytes, ObjectUtils.asMap(
                    "resource_type", "raw",
                    "type", "upload",
                    "folder", folder,
                    "unique_filename", true,
                    "overwrite", false));
            return new CloudinaryAsset(
                    String.valueOf(result.get("secure_url")),
                    String.valueOf(result.get("public_id")));
        } catch (IOException error) {
            throw new IllegalStateException("Cloudinary upload failed.", error);
        }
    }
}
