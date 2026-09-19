package resumate.source_code.Controller;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CredentialAccessControllerTests {
    private final CredentialAccessController controller = new CredentialAccessController();

    @Test
    void rejectsMissingPublicKeyRegistrationFields() {
        ResponseEntity<Map<String, Object>> response = controller.registerPublicKey(Map.of("wallet", "wallet", "keyVersion", 1));
        assertEquals(400, response.getStatusCode().value());
        assertTrue(response.getBody().containsKey("error"));
    }

    @Test
    void returnsLookupShapeWithoutPrivateKey() {
        ResponseEntity<Map<String, Object>> response = controller.getPublicKey("wallet");
        assertEquals(200, response.getStatusCode().value());
        assertEquals("wallet", response.getBody().get("wallet"));
        assertEquals("", response.getBody().get("encryptionPublicKey"));
        assertFalse(response.getBody().containsKey("privateKey"));
    }
}
