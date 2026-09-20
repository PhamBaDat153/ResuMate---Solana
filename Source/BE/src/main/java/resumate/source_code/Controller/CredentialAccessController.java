package resumate.source_code.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import resumate.source_code.Service.PublicKeyRegistryService;

import java.util.Map;

@RestController
@RequestMapping("/credentials")
public class CredentialAccessController {
    private final PublicKeyRegistryService registry;

    public CredentialAccessController(PublicKeyRegistryService registry) {
        this.registry = registry;
    }

    @PostMapping("/public-key")
    public ResponseEntity<Map<String, Object>> registerPublicKey(@RequestBody Map<String, Object> request) {
        String wallet = String.valueOf(request.getOrDefault("wallet", ""));
        String publicKey = String.valueOf(request.getOrDefault("encryptionPublicKey", ""));
        int keyVersion = ((Number) request.getOrDefault("keyVersion", 0)).intValue();
        if (wallet.isBlank() || publicKey.isBlank() || keyVersion < 1) {
            return ResponseEntity.badRequest().body(Map.of("error", "wallet, encryptionPublicKey, and keyVersion are required"));
        }
        try {
            registry.register(wallet, publicKey, keyVersion);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
        return ResponseEntity.ok(Map.of("wallet", wallet, "encryptionPublicKey", publicKey, "keyVersion", keyVersion));
    }

    @GetMapping("/public-key/{wallet}")
    public ResponseEntity<?> getPublicKey(@PathVariable String wallet) {
        PublicKeyRegistryService.PublicKeyRecord record = registry.lookup(wallet);
        if (record == null) {
            return ResponseEntity.status(404).body(Map.of("error", "No public key registered for wallet"));
        }
        return ResponseEntity.ok(Map.of(
                "wallet", record.wallet(),
                "encryptionPublicKey", record.encryptionPublicKey(),
                "keyVersion", record.keyVersion()
        ));
    }
}
