package resumate.source_code.Model;

public record JobListing(
        String externalId,
        String source,
        String title,
        String company,
        String description,
        String location,
        String workMode,
        String salary,
        String url
) {
}
