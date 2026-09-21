package resumate.source_code.Service;

public interface CloudinaryUploadClient {
    CloudinaryAsset upload(byte[] bytes, String folder, String fileName);

    default CloudinaryAsset upload(byte[] bytes, String folder, String fileName, String resourceType) {
        return upload(bytes, folder, fileName);
    }

    record CloudinaryAsset(String secureUrl, String publicId) {
    }
}
