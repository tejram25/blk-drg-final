# Design Workspace backend

Owns designs, the documents filed against them, and the approval that decides
what a customer may see. It does **not** own block diagrams — those belong to
the block diagram service, which reaches this one over its API and never writes
its data.

Runs on **8091**, alongside the block diagram backend on 8090.

```bash
mvn spring-boot:run
curl -s localhost:8091/api/sfdc/opportunities/0061t00000AbCdEfGhI/tabs | jq
```

Deploying it: [DEPLOY.md](./DEPLOY.md) — fat jar on the host, run by systemd,
same as BLK.

The one endpoint it exposes today is documented in
[sfdc-embed-api.md](../design/dc-workspace/sfdc-embed-api.md).

---

## Layout

Dependencies point **inwards**. `domain` imports no Spring and no Jackson,
which is what lets the rules be tested without a container and replaced
underneath without touching them.

```
com.arrow.dws
├── api            controllers, wire DTOs, error handling   — knows HTTP
├── application    use cases and tab contributors           — knows the workflow
├── domain         model and ports                          — knows the business
│   ├── model      records and enums, no framework
│   └── port       interfaces the application depends on
├── adapter        implementations of those ports           — knows the outside world
│   └── persistence
└── config         wiring
```

`api` depends on `application`, `application` on `domain`, `adapter` on
`domain`. Nothing depends on `adapter` except Spring, at startup.

## How the SOLID principles actually show up here

Not as ceremony — each one is doing a job you can point at.

### Single responsibility

A tab is a class. `PartIntelligenceTabContributor` knows about parts and
nothing else; it does not know how many other tabs exist, how the response is
assembled, or how the request arrived. `DefaultOpportunityViewService` knows
how to assemble a response and nothing about what is in one.

The alternative — one service with a seven-branch switch — is the version where
a change to the parts tab makes you re-read the documents tab to be sure you
did not break it.

### Open/closed

**Adding a tab is adding a class.**

```java
@Component
public class RiskTabContributor implements TabContributor {
    public String key()  { return "risk"; }
    public int    order() { return 8; }
    public TabView build(Design design, Audience audience) {
        return TabBuilder.of(key(), "Risk", "shield", order(), audience)
                .count("openRisks", "Open risks", design.openQueries().size())
                .build();
    }
}
```

That is the whole change. Spring injects every `TabContributor` into the use
case, which sorts by `order()` and calls each. No service, controller, DTO or
existing tab is touched — and `TabContributorTest` picks the new tab up and
holds it to the shared invariants automatically.

### Liskov substitution

Every contributor is interchangeable because `TabBuilder` owns the invariants
rather than each tab re-deriving them: `readOnly` follows the audience, and the
badge is derived from the items actually added. A contributor cannot ship a
badge of 4 over a list of 2, because it never writes the badge and the list
separately.

### Interface segregation

`TabContributor` has three methods and one default. `DesignRepository` has
three. A fake for either is a few lines, which is why the use-case tests need
neither Mockito nor a database.

### Dependency inversion

The use case depends on `DesignRepository`, an interface owned by the *domain*.
`InMemoryDesignRepository` implements it and is annotated `@Profile("!jpa")`.
Swapping the fixture for a real database is:

1. write `JpaDesignRepository implements DesignRepository` with `@Profile("jpa")`
2. run with `--spring.profiles.active=jpa`

No use case, controller or contributor changes. The profile marker is there so
that swap is a configuration decision rather than a deletion.

`Clock` is injected the same way, which is why `generatedAt` can be asserted
exactly instead of "roughly now".

## Two deliberate choices worth knowing about

**`Audience` is an enum, not a `boolean embed`.** A boolean answers one
question and cannot answer a second: the day a partner portal appears, every
signature carrying it changes and every call site has to be re-read to work out
which way round `true` meant. Adding a constant changes no signatures.

**Tone lives on the domain enum.** `PartLifecycle.LAST_TIME_BUY` knows it is
`CRITICAL`. Putting that in the client means the same rules get re-implemented
in every surface that shows a part, and then drift. It also means adding a
lifecycle *forces* a risk decision at the point of adding rather than leaving a
default to be discovered in production.

## Tests

```bash
mvn test          # 56 tests, no database, no network
```

| Suite | What it holds |
|---|---|
| `VisibilityTest` | the rules that decide what leaves Arrow — pure domain, milliseconds |
| `TabContributorTest` | invariants applied to **every** tab, so the eighth cannot forget them |
| `DefaultOpportunityViewServiceTest` | assembly and ordering, against stub contributors |
| `InMemoryDesignRepositoryTest` | the port contract, including that collections cannot be mutated by a caller |
| `OpportunityControllerTest` | the whole app wired as it ships — that Spring finds all seven contributors, and that the endpoint answers without a session |

Tests build their own designs (`TestDesigns`) rather than asserting against the
shipped fixture. A test that breaks when someone renames a document for a demo
is a test everyone learns to ignore.

## Before this is real

1. **No caller identity, so no entitlement check.** Anyone who knows an
   opportunity id gets an answer. `embed=true` filters *content*, not *access* —
   they are not substitutes. `Audience` is where the caller's identity will
   turn into a decision.
2. **No approval gate.** The fixture sets `Visibility` by hand. In the real
   thing an approver sets it and the database enforces it.
3. **CORS allows credentials: false**, which is what makes the wildcard origin
   patterns safe. If authentication is added, that pairing has to be revisited
   in the same change.
