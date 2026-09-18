package resumate.source_code.Service;

public interface CloudinaryUploadClient {
    CloudinaryAsset upload(byte[] bytes, String folder, String fileName);

    record CloudinaryAsset(String secureUrl, String publicId) {
    }
}
