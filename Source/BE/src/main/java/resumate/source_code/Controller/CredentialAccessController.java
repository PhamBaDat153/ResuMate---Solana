package resumate.source_code.Controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/credentials")
public class CredentialAccessController {

    @PostMapping("/public-key")
    public ResponseEntity<Map<String, Object>> registerPublicKey(@RequestBody Map<String, Object> request) {
        String wallet = String.valueOf(request.getOrDefault("wallet", ""));
        String publicKey = String.valueOf(request.getOrDefault("encryptionPublicKey", ""));
        int keyVersion = ((Number) request.getOrDefault("keyVersion", 1)).intValue();
        if (wallet.isBlank() || publicKey.isBlank() || keyVersion < 1) {
            return ResponseEntity.badRequest().body(Map.of("error", "wallet, encryptionPublicKey, and keyVersion are required"));
        }
        return ResponseEntity.ok(Map.of("wallet", wallet, "encryptionPublicKey", publicKey, "keyVersion", keyVersion));
    }

    @GetMapping("/public-key/{wallet}")
    public ResponseEntity<Map<String, Object>> getPublicKey(@PathVariable String wallet) {
        return ResponseEntity.ok(Map.of(
                "wallet", wallet,
                "encryptionPublicKey", "",
                "keyVersion", 0
        ));
    }
}
