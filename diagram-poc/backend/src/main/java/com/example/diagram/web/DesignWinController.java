package com.example.diagram.web;

import com.example.diagram.service.DesignWinService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Design Win API proxy. The frontend calls these (authenticated) instead of
 * the upstream API directly, so the OAuth credentials stay server-side. Each endpoint
 * returns the raw Design Win JSON.
 */
@RestController
@RequestMapping(value = "/api/designwin", produces = MediaType.APPLICATION_JSON_VALUE)
public class DesignWinController {

    private final DesignWinService designWin;

    public DesignWinController(DesignWinService designWin) {
        this.designWin = designWin;
    }

    @GetMapping("/customers")
    public String customers(@RequestParam(required = false) String customerName,
                            @RequestParam(required = false) String billToNumber,
                            @RequestParam(required = false) String operatingUnit) {
        return designWin.customers(customerName, billToNumber, operatingUnit);
    }

    @GetMapping("/projects")
    public String projects(@RequestParam(required = false) String customerName,
                           @RequestParam(required = false) String projectName,
                           @RequestParam(required = false) String billToNumber) {
        return designWin.projects(customerName, projectName, billToNumber);
    }

    @GetMapping("/boards")
    public String boards(@RequestParam(required = false) String projectId,
                         @RequestParam(required = false) String projectName) {
        return designWin.boards(projectId, projectName);
    }

    @GetMapping("/registration-details")
    public String registrationDetails(@RequestParam(required = false) String uniqueNum,
                                      @RequestParam(required = false) String registrationNum,
                                      @RequestParam(required = false) String boardNum,
                                      @RequestParam(required = false) String trackingNum) {
        return designWin.registrationDetails(uniqueNum, registrationNum, boardNum, trackingNum);
    }

    @GetMapping("/cust-parts")
    public String custParts(@RequestParam(required = false) String customerName,
                            @RequestParam(required = false) String custBillTo,
                            @RequestParam(required = false) String projectId,
                            @RequestParam(required = false) String boardNum,
                            @RequestParam(required = false) String projectName) {
        return designWin.custPartSearch(customerName, custBillTo, projectId, boardNum, projectName);
    }

    @GetMapping("/sales")
    public String sales(@RequestParam(required = false) String partNumber,
                        @RequestParam(required = false) String mfrName) {
        return designWin.sales(partNumber, mfrName);
    }
}
