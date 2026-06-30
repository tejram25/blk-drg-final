package com.example.diagram.service.impl;

import com.example.diagram.config.ArrowProperties;
import com.example.diagram.service.DesignWinService;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Live Arrow Design Win integration. Builds each documented endpoint URL,
 * validates the conditionally-required parameters, and delegates auth/transport
 * to {@link ArrowApiClient}. Always calls the real Arrow APIs.
 */
@Service
public class ArrowDesignWinService implements DesignWinService {

    private final ArrowProperties props;
    private final ArrowApiClient client;

    public ArrowDesignWinService(ArrowProperties props, ArrowApiClient client) {
        this.props = props;
        this.client = client;
    }

    @Override
    public String customers(String customerName, String billToNumber, String operatingUnit) {
        require(present(customerName) || present(billToNumber), "customerName or billToNumber is required.");
        return client.getJson(url("/customers")
                .queryParamIfPresent("customerName", opt(customerName))
                .queryParamIfPresent("billToNumber", opt(billToNumber))
                .queryParamIfPresent("operatingUnit", opt(operatingUnit))
                .build().toUriString());
    }

    @Override
    public String projects(String customerName, String projectName, String billToNumber) {
        require(present(customerName) || present(projectName) || present(billToNumber),
                "customerName, projectName or billToNumber is required.");
        return client.getJson(url("/projects")
                .queryParamIfPresent("customerName", opt(customerName))
                .queryParamIfPresent("projectName", opt(projectName))
                .queryParamIfPresent("billToNumber", opt(billToNumber))
                .build().toUriString());
    }

    @Override
    public String boards(String projectId, String projectName) {
        require(present(projectId) || present(projectName), "projectId or projectName is required.");
        return client.getJson(url("/boards")
                .queryParamIfPresent("projectId", opt(projectId))
                .queryParamIfPresent("projectName", opt(projectName))
                .build().toUriString());
    }

    @Override
    public String registrationDetails(String arrowUniqueNum, String registrationNum,
                                      String boardNum, String trackingNum) {
        require(present(arrowUniqueNum) || present(registrationNum)
                        || present(boardNum) || present(trackingNum),
                "arrowUniqueNum, registrationNum, boardNum or trackingNum is required.");
        return client.getJson(url("/getRegistrationDetails")
                .queryParamIfPresent("arrowUniqueNum", opt(arrowUniqueNum))
                .queryParamIfPresent("registrationNum", opt(registrationNum))
                .queryParamIfPresent("boardNum", opt(boardNum))
                .queryParamIfPresent("trackingNum", opt(trackingNum))
                .build().toUriString());
    }

    @Override
    public String custPartSearch(String customerName, String custBillTo,
                                 String projectId, String boardNum, String projectName) {
        require(present(customerName) || present(custBillTo), "customerName or custBillTo is required.");
        return client.getJson(url("/getCustPartSearch")
                .queryParamIfPresent("customerName", opt(customerName))
                .queryParamIfPresent("custBillTo", opt(custBillTo))
                .queryParamIfPresent("projectId", opt(projectId))
                .queryParamIfPresent("boardNum", opt(boardNum))
                .queryParamIfPresent("projectName", opt(projectName))
                .build().toUriString());
    }

    @Override
    public String sales(String partNumber, String mfrName) {
        require(present(partNumber), "partNumber is required.");
        return client.getJson(url("/sales")
                .queryParamIfPresent("partNumber", opt(partNumber))
                .queryParamIfPresent("mfrName", opt(mfrName))
                .build().toUriString());
    }

    private UriComponentsBuilder url(String path) {
        return UriComponentsBuilder.fromHttpUrl(props.designwinUrl(path));
    }

    private static boolean present(String s) {
        return s != null && !s.isBlank();
    }

    private static java.util.Optional<String> opt(String s) {
        return present(s) ? java.util.Optional.of(s.trim()) : java.util.Optional.empty();
    }

    private static void require(boolean ok, String message) {
        if (!ok) throw new IllegalArgumentException(message);
    }
}
