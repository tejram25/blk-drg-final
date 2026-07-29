package com.example.diagram.service;

import com.example.diagram.web.dto.CatalogPart;
import com.example.diagram.web.dto.PartCompliance;
import com.example.diagram.web.dto.PartLeadTime;
import com.example.diagram.web.dto.PartLocation;
import com.example.diagram.web.dto.PartPackaging;
import com.example.diagram.web.dto.PartPriceBreak;
import com.example.diagram.web.dto.PartPricing;
import com.example.diagram.web.dto.PartSearchResponse;
import com.example.diagram.web.dto.PartSourcing;
import com.example.diagram.web.dto.PartStock;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Turns the upstream {@code partserviceresult} payload into the typed model the
 * UI consumes.
 *
 * <p>The upstream returns one row per inventory organisation, so a single part
 * stocked in 25 warehouses arrives as 25 "parts" that differ only in their
 * {@code invOrgs} entry. This groups them by {@code itemId} and folds those
 * organisations into one part's locations, picking headline values from the
 * best-ranked location (Active status and real pricing win) and summing stock.
 *
 * <p>Everything is null-tolerant: the catalogue omits fields freely — pricing,
 * lead-time dates and delivery dates are all routinely absent — so missing data
 * becomes an empty string or zero rather than an exception.
 */
@Component
public class PartSearchNormalizer {

    public PartSearchResponse normalize(JsonNode root, String query) {
        return normalize(root, query, 0);
    }

    /** As {@link #normalize(JsonNode, String)}, for a page starting at {@code start}. */
    public PartSearchResponse normalize(JsonNode root, String query, int start) {
        JsonNode result = root.path("partserviceresult");
        JsonNode rows = result.path("parts");

        // Preserve upstream relevance order while grouping.
        Map<String, List<JsonNode>> byItem = new LinkedHashMap<>();
        int row1 = 0;
        for (JsonNode row : rows) {
            // Grouping identity. The part number is part of the chain because a
            // row missing every id must not be merged with another one that is
            // also missing them — that would silently collapse unrelated parts
            // into one. The positional key is the last resort for the same reason.
            String key = firstNonBlank(
                    text(row, "itemId"), text(row, "partKey"), text(row, "docid"),
                    row.path("arwPartNum").path("name").asText(""),
                    row.path("suppPartNum").path("name").asText(""),
                    "row-" + row1);
            row1++;
            byItem.computeIfAbsent(key, k -> new ArrayList<>()).add(row);
        }

        List<CatalogPart> parts = new ArrayList<>();
        byItem.forEach((id, group) -> parts.add(toPart(id, group)));

        int returned = rows.isArray() ? rows.size() : 0;
        long total = result.path("totalItems").asLong(0);
        // The upstream advertises the next offset; fall back to counting rows
        // for responses (like the mock's) that do not.
        int nextStart = result.hasNonNull("nextStart")
                ? result.path("nextStart").asInt(start + returned)
                : start + returned;
        boolean hasMore = returned > 0 && nextStart < total;

        return new PartSearchResponse(
                query, start, returned, nextStart, hasMore, total,
                "Y".equalsIgnoreCase(result.path("exactMatchFound").asText("")),
                result.path("matchReason").path("description").asText(""),
                parts);
    }

    /** Fold every upstream row for one item into a single part. */
    private CatalogPart toPart(String id, List<JsonNode> group) {
        JsonNode first = group.get(0);

        List<PartLocation> locations = new ArrayList<>();
        long totalOnHand = 0;
        long freeOnHand = 0;
        long soonestQty = 0;
        String soonestDate = "";
        int inStock = 0;
        JsonNode bestOrg = null;

        for (JsonNode row : group) {
            for (JsonNode org : row.path("invOrgs")) {
                JsonNode avail = org.path("avail");
                long onHand = avail.path("totohQty").asLong(0);
                totalOnHand += onHand;
                freeOnHand += avail.path("FOHQty").asLong(0);
                if (onHand > 0) inStock++;

                String nextDate = text(avail, "nextDelivery");
                if (!nextDate.isEmpty() && (soonestDate.isEmpty() || earlier(nextDate, soonestDate))) {
                    soonestDate = nextDate;
                    soonestQty = avail.path("nextQty").asLong(0);
                }

                locations.add(new PartLocation(
                        text(org, "id"), text(org, "cd"), text(org, "type"), text(org, "ou"),
                        text(org, "IODesc"), text(org, "status"),
                        onHand, avail.path("nextQty").asLong(0), nextDate,
                        org.path("minOrdQty").asInt(0),
                        "Yes".equalsIgnoreCase(text(org, "pref")),
                        "Y".equalsIgnoreCase(org.path("dwData").path("dwEligible").asText(""))));

                if (isBetter(org, bestOrg)) bestOrg = org;
            }
        }
        if (bestOrg == null) bestOrg = first.path("invOrgs").path(0);

        JsonNode icc = first.path("icc");
        List<String> categoryPath = new ArrayList<>();
        for (String segment : text(icc, "tree").split("\\|")) {
            if (!segment.isBlank()) categoryPath.add(segment.trim());
        }

        return new CatalogPart(
                id,
                text(first, "partKey"),
                firstNonBlank(first.path("arwPartNum").path("name").asText(""),
                        first.path("suppPartNum").path("name").asText(""), text(first, "partKey")),
                first.path("suppPartNum").path("name").asText(""),
                first.path("arwPartNum").path("isExactMatch").asBoolean(false),
                first.path("mfr").path("name").asText(""),
                first.path("supp").path("name").asText(""),
                text(bestOrg, "desc"),
                text(icc, "name"),
                categoryPath,
                text(bestOrg, "status"),
                url(first, "Image Large", "Image Small"),
                url(first, "Datasheet"),
                leadTime(first.path("leadTime")),
                new PartStock(totalOnHand, soonestQty, soonestDate, locations.size(), inStock, freeOnHand),
                pricing(bestOrg),
                packaging(bestOrg),
                compliance(first, bestOrg),
                locations,
                sourcing(bestOrg),
                locations.stream().anyMatch(PartLocation::designWinEligible),
                "Y".equalsIgnoreCase(text(first, "xrefInd")),
                strings(first.path("xrefTypes")),
                strings(first.path("relationshipTypes")),
                first.path("score").asDouble(0));
    }

    /**
     * Rank locations so headline figures come from a meaningful one: an Active
     * location beats a never-active one, and among equals the one that actually
     * quotes a price wins (many organisations carry no pricing at all).
     */
    private boolean isBetter(JsonNode candidate, JsonNode current) {
        if (current == null) return true;
        int c = score(candidate), n = score(current);
        return c > n;
    }

    private int score(JsonNode org) {
        int s = 0;
        if ("Active".equalsIgnoreCase(text(org, "status"))) s += 4;
        if (org.path("webPrice").path("resalelist").isArray()
                && org.path("webPrice").path("resalelist").size() > 0) s += 2;
        if (org.path("avail").path("totohQty").asLong(0) > 0) s += 1;
        return s;
    }

    private PartLeadTime leadTime(JsonNode lt) {
        return new PartLeadTime(text(lt, "arwLT"), text(lt, "suppLT"), text(lt, "suppLTDt"),
                lt.path("suppAvail").asLong(0), text(lt, "factStkDate"));
    }

    /**
     * Sourcing signals from the best-ranked organisation.
     *
     * <p>Only flags an engineer or buyer acts on. The upstream also returns
     * Arrow's cost basis and internal win scores in the same object; those are
     * deliberately not read here so they cannot reach the browser.
     */
    private PartSourcing sourcing(JsonNode org) {
        return new PartSourcing(
                text(org, "suppAlloc"),
                yes(org, "franchised"),
                yes(org.path("pcn"), "ind"),
                yes(org.path("ncnr"), "custContractReq"),
                yes(org, "soleSrc"),
                yes(org, "bkordind"),
                yes(org, "militarySpec"),
                yes(org, "ftzEnabled"),
                text(org, "partClass"));
    }

    /** The upstream spells booleans "Y"/"N" in some fields and "Yes"/"No" in others. */
    private static boolean yes(JsonNode node, String field) {
        String v = text(node, field);
        return "Y".equalsIgnoreCase(v) || "YES".equalsIgnoreCase(v);
    }

    private PartPricing pricing(JsonNode org) {
        JsonNode price = org.path("webPrice");
        List<PartPriceBreak> breaks = new ArrayList<>();
        for (JsonNode b : price.path("resalelist")) {
            breaks.add(new PartPriceBreak(text(b, "price"), text(b, "minQty"), text(b, "maxQty")));
        }
        String unit = breaks.isEmpty() ? "" : breaks.get(0).price();
        return new PartPricing(text(price, "currency"), breaks, unit);
    }

    private PartPackaging packaging(JsonNode org) {
        return new PartPackaging(
                text(org, "pkg"), text(org, "pkgQty"),
                org.path("minOrdQty").asInt(0), org.path("multOrdQty").asInt(0),
                text(org, "primaryUOM"), text(org, "pkgStyle"));
    }

    private PartCompliance compliance(JsonNode part, JsonNode org) {
        List<String> standards = new ArrayList<>();
        for (JsonNode c : part.path("EnvData").path("complianceList")) {
            String type = text(c, "type");
            if (!type.isEmpty()) standards.add(type);
        }
        return new PartCompliance(
                standards,
                "YES".equalsIgnoreCase(part.path("svhc").path("svhcInclude").asText("")),
                text(part, "eccnus"), text(part, "eccnwass"),
                text(org, "hts"), text(org, "coo"));
    }

    /** First URL matching any of the given types, in preference order. */
    private String url(JsonNode part, String... types) {
        for (String type : types) {
            for (JsonNode u : part.path("urls")) {
                if (type.equalsIgnoreCase(text(u, "type"))) return text(u, "URL");
            }
        }
        return "";
    }

    private List<String> strings(JsonNode array) {
        List<String> out = new ArrayList<>();
        for (JsonNode n : array) out.add(n.asText(""));
        return out;
    }

    /**
     * Is {@code a} an earlier delivery date than {@code b}? Dates arrive as
     * "22-APR-2026" with inconsistent month casing, so they are parsed rather
     * than compared as strings — lexically, "22-APR" sorts before "10-MAR",
     * which would report the wrong soonest delivery. Unparseable dates never
     * win, so a bad value cannot displace a good one.
     */
    private boolean earlier(String a, String b) {
        LocalDate da = parseDate(a), db = parseDate(b);
        if (da == null) return false;
        if (db == null) return true;
        return da.isBefore(db);
    }

    private static final DateTimeFormatter DELIVERY_DATE = new DateTimeFormatterBuilder()
            .parseCaseInsensitive()
            .appendPattern("dd-MMM-yyyy")
            .toFormatter(Locale.ENGLISH);

    private static LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value, DELIVERY_DATE);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        return node == null ? "" : node.path(field).asText("");
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) if (v != null && !v.isBlank()) return v;
        return "";
    }
}
