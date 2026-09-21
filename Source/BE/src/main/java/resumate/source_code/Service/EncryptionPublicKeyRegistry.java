package resumate.source_code.Service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class EncryptionPublicKeyRegistry {

    public record EncryptionPublicKeyRecord(
            String wallet,
            String encryptionPublicKey,
            int keyVersion,
            long updatedAt
    ) {
    }

    private final ConcurrentHashMap<String, EncryptionPublicKeyRecord> records = new ConcurrentHashMap<>();

    public EncryptionPublicKeyRecord register(String wallet, String encryptionPublicKey, int keyVersion) {
        EncryptionPublicKeyRecord existing = records.get(wallet);
        if (existing != null && keyVersion < existing.keyVersion()) {
            throw new IllegalArgumentException("keyVersion must be greater than or equal to the current version");
        }
        EncryptionPublicKeyRecord record = new EncryptionPublicKeyRecord(
                wallet,
                encryptionPublicKey,
                keyVersion,
                System.currentTimeMillis()
        );
        records.put(wallet, record);
        return record;
    }

    public Optional<EncryptionPublicKeyRecord> findByWallet(String wallet) {
        return Optional.ofNullable(records.get(wallet));
    }

    public Map<String, Object> toResponse(EncryptionPublicKeyRecord record) {
        return Map.of(
                "wallet", record.wallet(),
                "encryptionPublicKey", record.encryptionPublicKey(),
                "keyVersion", record.keyVersion(),
                "updatedAt", record.updatedAt()
        );
    }
}
