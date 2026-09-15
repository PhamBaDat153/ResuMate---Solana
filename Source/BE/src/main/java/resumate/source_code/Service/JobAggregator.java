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
            long startedAt = System.currentTimeMillis();
            List<JobListing> providerJobs = provider.search(criteria);
            System.out.println("[JOB_SEARCH] Provider " + provider.source() + " returned " + providerJobs.size()
                    + " jobs in " + (System.currentTimeMillis() - startedAt) + " ms");
            for (JobListing job : providerJobs) {
                String key = job.url().isBlank() ? job.source() + ":" + job.externalId() : job.url();
                unique.putIfAbsent(key, job);
            }
        }
        List<JobListing> results = new ArrayList<>(unique.values()).stream().limit(30).toList();
        System.out.println("[JOB_SEARCH] 4/6 Normalized and deduplicated: " + unique.size()
                + " unique jobs; sending " + results.size() + " to AI");
        return results;
    }
}
