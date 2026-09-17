package resumate.source_code;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "gemini.api-key=",
        "gemini.model=test-model"
})
class SourceCodeApplicationTests {

    @Test
    void contextLoads() {
    }

}
