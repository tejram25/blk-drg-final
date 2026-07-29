package com.example.diagram.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for the Arrow APIM Design Win APIs (part search + Design Win
 * data: customers, projects, boards, registrations, POS).
 *
 * <p>Per the Design Win API V2.0 doc all endpoints — including the OAuth2 token
 * — live on a single host ({@code qa-components-api-int.arrow.com} on QUAL). The
 * auth, search and Design Win base URLs are still configured separately so they
 * can be split per environment if needed.
 *
 * <p>Credentials are supplied via environment variables
 * ({@code ARROW_CLIENT_ID} / {@code ARROW_CLIENT_SECRET}) and are never
 * hardcoded or committed.
 */
@Component
@ConfigurationProperties(prefix = "arrow")
public class ArrowProperties {

    /** Host that issues the OAuth2 token (…/auth/oauth2/token). */
    private String authBaseUrl;
    /** Host that serves part search. */
    private String searchBaseUrl;
    /** Base for the Design Win endpoints, e.g. https://host/designwin. */
    private String designwinBaseUrl;
    private String tokenPath;
    /** Search path on the search host, e.g. /arrowapi/dw/partservice/search. */
    private String searchPath;
    /** APIM application id query param (the docs use "gen"). */
    private String appId;
    /** How many results to request per search (the API pages; default returns 1). */
    private int searchLimit = 25;
    private String version;
    private String clientId;
    private String clientSecret;

    /**
     * Which search endpoint contract to speak.
     *
     * <p>{@code partservice} is the original {@code /eupartservice/search}
     * ({@code srchtxt}, {@code render}, {@code appid}). {@code acpartservice} is
     * the newer Workbench endpoint, which drops those and takes a warehouse
     * filter and a set of sourcing switches instead. Both return the same
     * {@code partserviceresult} body, so only the request differs.
     */
    private SearchApi searchApi = SearchApi.PARTSERVICE;

    public enum SearchApi { PARTSERVICE, ACPARTSERVICE }

    // ---- acpartservice request parameters -------------------------------
    /** Inventory organisations to search, as the {@code ioebs} CSV. */
    private String invOrgs = "";
    /** Calling application, sent as {@code source}. */
    private String source = "Workbench";
    /** Search mode, sent as {@code srchmode}. */
    private String searchMode = "EBS";
    /** Warehouse type, sent as {@code whsetype}. */
    private String warehouseType = "2";
    /** Return the warehouse filter, sent as {@code retWhseFilter}. */
    private boolean returnWarehouseFilter = true;
    /** Boost foreign-trade-zone stock, sent as {@code ftzBoostFlag}. */
    private boolean ftzBoost = true;
    /** Sent as {@code enableStcFlagFilter}. */
    private boolean stcFlagFilter = false;

    /** True only when both credentials are present, so we can fail fast otherwise. */
    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
                && clientSecret != null && !clientSecret.isBlank();
    }

    /** Full token endpoint, e.g. https://host/auth/oauth2/token. */
    public String tokenUrl() {
        return trimTrailingSlash(authBaseUrl) + tokenPath;
    }

    /** Full search endpoint, e.g. https://host/arrowapi/dw/partservice/search. */
    public String searchUrl() {
        return trimTrailingSlash(searchBaseUrl) + searchPath;
    }

    /** A Design Win endpoint URL, e.g. designwinUrl("/customers"). */
    public String designwinUrl(String path) {
        return trimTrailingSlash(designwinBaseUrl) + path;
    }

    private static String trimTrailingSlash(String s) {
        if (s == null) return "";
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    public String getAuthBaseUrl() { return authBaseUrl; }
    public void setAuthBaseUrl(String authBaseUrl) { this.authBaseUrl = authBaseUrl; }

    public String getSearchBaseUrl() { return searchBaseUrl; }
    public void setSearchBaseUrl(String searchBaseUrl) { this.searchBaseUrl = searchBaseUrl; }

    public String getDesignwinBaseUrl() { return designwinBaseUrl; }
    public void setDesignwinBaseUrl(String designwinBaseUrl) { this.designwinBaseUrl = designwinBaseUrl; }

    public String getTokenPath() { return tokenPath; }
    public void setTokenPath(String tokenPath) { this.tokenPath = tokenPath; }

    public String getSearchPath() { return searchPath; }
    public void setSearchPath(String searchPath) { this.searchPath = searchPath; }

    public String getAppId() { return appId; }
    public void setAppId(String appId) { this.appId = appId; }

    public int getSearchLimit() { return searchLimit; }
    public void setSearchLimit(int searchLimit) { this.searchLimit = searchLimit; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientSecret() { return clientSecret; }
    public void setClientSecret(String clientSecret) { this.clientSecret = clientSecret; }

    public SearchApi getSearchApi() { return searchApi; }
    public void setSearchApi(SearchApi searchApi) { this.searchApi = searchApi; }

    public String getInvOrgs() { return invOrgs; }
    public void setInvOrgs(String invOrgs) { this.invOrgs = invOrgs; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getSearchMode() { return searchMode; }
    public void setSearchMode(String searchMode) { this.searchMode = searchMode; }

    public String getWarehouseType() { return warehouseType; }
    public void setWarehouseType(String warehouseType) { this.warehouseType = warehouseType; }

    public boolean isReturnWarehouseFilter() { return returnWarehouseFilter; }
    public void setReturnWarehouseFilter(boolean returnWarehouseFilter) { this.returnWarehouseFilter = returnWarehouseFilter; }

    public boolean isFtzBoost() { return ftzBoost; }
    public void setFtzBoost(boolean ftzBoost) { this.ftzBoost = ftzBoost; }

    public boolean isStcFlagFilter() { return stcFlagFilter; }
    public void setStcFlagFilter(boolean stcFlagFilter) { this.stcFlagFilter = stcFlagFilter; }
}
