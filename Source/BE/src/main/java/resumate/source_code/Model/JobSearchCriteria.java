package resumate.source_code.Model;

public record JobSearchCriteria(String location, String workMode, String targetRole) {
    public String locationOrAny() {
        return valueOrAny(location);
    }

    public String targetRoleOrAny() {
        return valueOrAny(targetRole);
    }

    private String valueOrAny(String value) {
        return value == null || value.isBlank() ? "" : value.trim();
    }
}
