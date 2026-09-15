package resumate.source_code.Service;

import org.springframework.stereotype.Service;
import resumate.source_code.Model.JobListing;
import resumate.source_code.Model.JobSearchCriteria;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class JobAggregator {
    private final List<JobProvider> providers;

    public JobAggregator(List<JobProvider> providers) {
        this.providers = providers;
    }

    public List<JobListing> search(JobSearchCriteria criteria) {
        Map<String, JobListing> unique = new LinkedHashMap<>();
        for (JobProvider provider : providers) {
            for (JobListing job : provider.search(criteria)) {
                String key = job.url().isBlank() ? job.source() + ":" + job.externalId() : job.url();
                unique.putIfAbsent(key, job);
            }
        }
        return new ArrayList<>(unique.values()).stream().limit(30).toList();
    }
}
