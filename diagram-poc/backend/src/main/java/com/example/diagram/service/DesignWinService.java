package com.example.diagram.service;

/**
 * Proxies the Arrow Design Win APIs (customers, projects, boards, registration
 * details, customer part search and POS/sales). Each method returns the raw JSON
 * body from Arrow so the frontend can render it directly. Required-parameter
 * validation is enforced here; transport/auth is handled by the shared client.
 */
public interface DesignWinService {

    /** Customer / BillTo search. Requires customerName or billToNumber. */
    String customers(String customerName, String billToNumber, String operatingUnit);

    /** Project search. Requires one of customerName / projectName / billToNumber. */
    String projects(String customerName, String projectName, String billToNumber);

    /** Board search. Requires projectId or projectName. */
    String boards(String projectId, String projectName);

    /** Registration details (AUN search). Requires one identifier. */
    String registrationDetails(String arrowUniqueNum, String registrationNum,
                               String boardNum, String trackingNum);

    /** Customer part search. Requires customerName or custBillTo. */
    String custPartSearch(String customerName, String custBillTo,
                          String projectId, String boardNum, String projectName);

    /** POS / sales lookup. Requires partNumber. */
    String sales(String partNumber, String mfrName);
}
