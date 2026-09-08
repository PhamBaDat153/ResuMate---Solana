package resumate.source_code.Ultility;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import resumate.source_code.DTO.KeywordMatch;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class KeywordExtractorImplement implements KeywordExtractor {

    private final List<CatalogEntry> keywords;
    private final List<Pattern> patterns;

    public KeywordExtractorImplement() {
        List<CatalogEntry> catalog = loadCatalog();
        this.keywords = List.copyOf(catalog);
        this.patterns = buildPatterns(catalog);
    }

    @Override
    public KeywordMatch extract(String cvText, String jdText) {
        String cv = normalize(cvText);
        String jd = normalize(jdText);

        List<String> matched = new ArrayList<>();
        List<String> missing = new ArrayList<>();

        for (int i = 0; i < keywords.size(); i++) {
            Pattern pattern = patterns.get(i);
            if (!pattern.matcher(jd).find()) {
                continue;
            }
            if (pattern.matcher(cv).find()) {
                matched.add(keywords.get(i).canonical());
            } else {
                missing.add(keywords.get(i).canonical());
            }
        }

        return new KeywordMatch(matched, missing);
    }

    private List<Pattern> buildPatterns(List<CatalogEntry> all) {
        List<Pattern> compiled = new ArrayList<>();

        for (CatalogEntry keyword : all) {
            List<String> terms = new ArrayList<>(keyword.synonyms());
            terms.add(keyword.canonical());
            String alternation = terms.stream()
                    .map(Pattern::quote)
                    .collect(Collectors.joining("|"));

            compiled.add(Pattern.compile(
                    "(?<![\\p{L}\\p{N}])(" + alternation + ")(?![\\p{L}\\p{N}])",
                    Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE));
        }

        return List.copyOf(compiled);
    }

    private List<CatalogEntry> loadCatalog() {
        List<CatalogEntry> catalog = new ArrayList<>();
        Set<String> terms = new HashSet<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource("keywords.tsv").getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            int lineNumber = 0;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.isBlank() || line.trim().startsWith("#")) {
                    continue;
                }

                String[] fields = line.split("\\t", -1);
                if (fields.length != 3 || fields[0].isBlank() || fields[1].isBlank()) {
                    throw invalidCatalog(lineNumber, "expected canonical, category, and synonyms fields");
                }

                String canonical = fields[0].trim();
                String category = fields[1].trim();
                List<String> synonyms = fields[2].isBlank()
                        ? List.of()
                        : List.of(fields[2].split("\\|", -1)).stream()
                        .map(String::trim)
                        .toList();

                if (!terms.add(canonical.toLowerCase(Locale.ROOT))) {
                    throw invalidCatalog(lineNumber, "duplicate keyword: " + canonical);
                }
                for (String synonym : synonyms) {
                    if (synonym.isBlank() || !terms.add(synonym.toLowerCase(Locale.ROOT))) {
                        throw invalidCatalog(lineNumber, "duplicate or blank synonym");
                    }
                }
                catalog.add(new CatalogEntry(canonical, category, synonyms));
            }
        } catch (IOException e) {
            throw new IllegalStateException("Cannot load keyword catalog", e);
        }

        if (catalog.isEmpty()) {
            throw new IllegalStateException("Invalid keyword catalog: no entries found");
        }
        return catalog;
    }

    private IllegalStateException invalidCatalog(int lineNumber, String message) {
        return new IllegalStateException("Invalid keyword catalog at line " + lineNumber + ": " + message);
    }

    private String normalize(String text) {
        return text == null ? "" : text.toLowerCase(Locale.ROOT).trim();
    }

    private record CatalogEntry(String canonical, String category, List<String> synonyms) {
    }
}
