package resumate.source_code.Service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PublicKeyRegistryService {
    private final Map<String, PublicKeyRecord> registry = new ConcurrentHashMap<>();

    public record PublicKeyRecord(String wallet, String encryptionPublicKey, int keyVersion, long registeredAt) {}

    public void register(String wallet, String encryptionPublicKey, int keyVersion) {
        if (wallet == null || wallet.isBlank()) throw new IllegalArgumentException("Wallet is required.");
        if (encryptionPublicKey == null || encryptionPublicKey.isBlank()) throw new IllegalArgumentException("Public key is required.");
        if (keyVersion < 1) throw new IllegalArgumentException("Key version must be at least 1.");
        registry.put(wallet, new PublicKeyRecord(wallet, encryptionPublicKey, keyVersion, System.currentTimeMillis()));
    }

    public PublicKeyRecord lookup(String wallet) {
        return registry.get(wallet);
    }
}
