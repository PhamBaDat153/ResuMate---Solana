package resumate.source_code.Controller;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import resumate.source_code.Service.PublicKeyRegistryService;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CredentialAccessControllerTests {
    private final PublicKeyRegistryService registry = new PublicKeyRegistryService();
    private final CredentialAccessController controller = new CredentialAccessController(registry);

    @Test
    void rejectsMissingPublicKeyRegistrationFields() {
        ResponseEntity<Map<String, Object>> response = controller.registerPublicKey(Map.of("wallet", "wallet", "keyVersion", 1));
        assertEquals(400, response.getStatusCode().value());
        assertTrue(response.getBody().containsKey("error"));
    }

    @Test
    void registersAndLooksUpPublicKey() {
        controller.registerPublicKey(Map.of("wallet", "w1", "encryptionPublicKey", "pk1", "keyVersion", 1));
        ResponseEntity<?> response = controller.getPublicKey("w1");
        assertEquals(200, response.getStatusCode().value());
        Map body = (Map) response.getBody();
        assertEquals("w1", body.get("wallet"));
        assertEquals("pk1", body.get("encryptionPublicKey"));
        assertEquals(1, body.get("keyVersion"));
    }

    @Test
    void returns404ForUnknownWallet() {
        ResponseEntity<?> response = controller.getPublicKey("unknown");
        assertEquals(404, response.getStatusCode().value());
    }
}
