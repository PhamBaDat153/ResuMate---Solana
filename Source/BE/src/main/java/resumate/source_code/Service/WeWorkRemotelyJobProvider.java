package resumate.source_code.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import resumate.source_code.Model.JobListing;
import resumate.source_code.Model.JobSearchCriteria;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

@Component
public class WeWorkRemotelyJobProvider implements JobProvider {
    private final RestClient client = RestClient.builder().build();
    private final String feedUrl;

    public WeWorkRemotelyJobProvider(@Value("${jobs.weworkremotely.feed-url:https://weworkremotely.com/remote-jobs.rss}") String feedUrl) {
        this.feedUrl = feedUrl;
    }

    @Override
    public String source() {
        return "weworkremotely";
    }

    @Override
    public List<JobListing> search(JobSearchCriteria criteria) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            Document document = factory.newDocumentBuilder().parse(new InputSource(new StringReader(
                    client.get().uri(feedUrl).retrieve().body(String.class))));
            NodeList items = document.getElementsByTagName("item");
            List<JobListing> results = new ArrayList<>();
            for (int index = 0; index < items.getLength(); index++) {
                Element item = (Element) items.item(index);
                String title = value(item, "title");
                String description = value(item, "description");
                String location = value(item, "region");
                String url = value(item, "link");
                if (!matches(title + " " + description, location, criteria)) continue;
                results.add(new JobListing(value(item, "guid"), source(), title,
                        companyFromTitle(title), description,
                        location.isBlank() ? "Remote" : location, "Remote", "Not specified", url));
                if (results.size() >= 20) break;
            }
            return results;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String value(Element item, String tag) {
        NodeList nodes = item.getElementsByTagName(tag);
        return nodes.getLength() == 0 ? "" : nodes.item(0).getTextContent().trim();
    }

    private String companyFromTitle(String title) {
        int separator = title.indexOf(':');
        return separator > 0 ? title.substring(0, separator).trim() : "Unknown company";
    }

    private boolean matches(String text, String location, JobSearchCriteria criteria) {
        return (criteria.targetRoleOrAny().isBlank() || text.toLowerCase().contains(criteria.targetRoleOrAny().toLowerCase()))
                && (criteria.locationOrAny().isBlank() || location.toLowerCase().contains(criteria.locationOrAny().toLowerCase()));
    }
}
