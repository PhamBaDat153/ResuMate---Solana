package resumate.source_code.Service;

import resumate.source_code.Model.JobListing;
import resumate.source_code.Model.JobSearchCriteria;

import java.util.List;

public interface JobProvider {
    String source();

    List<JobListing> search(JobSearchCriteria criteria);
}
