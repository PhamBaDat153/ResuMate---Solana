package resumate.source_code.Service;

public interface CloudinaryUploadClient {
    CloudinaryAsset upload(byte[] bytes, String folder);

    record CloudinaryAsset(String secureUrl, String publicId) {
    }
}
