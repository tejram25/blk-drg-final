import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { bff } from "./bff.js";
import { addLink, addNode, attachPart, parseModel, serialize, toReviewShape } from "./model.js";

/** Wrap any JSON value as an MCP text result. */
function ok(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}
function fail(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

/**
 * Register every tool the agent can call. Read tools return catalogue/diagram
 * data; write tools fetch a diagram's GoJS model, mutate it, and PUT it back.
 * All of them are thin adapters over endpoints that already exist on the BFF.
 */
export function registerTools(server: McpServer): void {
  // ---- catalogue (grounding) ---------------------------------------------
  server.registerTool(
    "list_block_types",
    {
      title: "List block types",
      description: "The palette of valid `shape` keys (electrical symbols, basic shapes, animated glyphs). Use these when adding blocks so the diagram renders a real symbol.",
      inputSchema: {},
    },
    async () => ok(await bff.blockTypes()),
  );

  server.registerTool(
    "search_parts",
    {
      title: "Search parts",
      description: "Search the part catalogue. Returns grounded, real part records — always call this before attaching a part instead of inventing an MPN.",
      inputSchema: { query: z.string().describe("Free-text part query, e.g. '0.1uF 0402 X7R 16V'") },
    },
    async ({ query }) => ok(await bff.searchParts(query)),
  );

  // ---- diagrams (read) ----------------------------------------------------
  server.registerTool(
    "list_diagrams",
    { title: "List diagrams", description: "All diagrams visible to the agent's account.", inputSchema: {} },
    async () => ok(await bff.listDiagrams()),
  );

  server.registerTool(
    "get_diagram",
    {
      title: "Get diagram",
      description: "Fetch one diagram, including its GoJS `contentJson` model (nodes + links).",
      inputSchema: { id: z.union([z.number(), z.string()]).describe("Diagram id") },
    },
    async ({ id }) => ok(await bff.getDiagram(id)),
  );

  server.registerTool(
    "create_diagram",
    {
      title: "Create diagram",
      description: "Create a new diagram. Pass `contentJson` (a GoJS GraphLinksModel) to seed it, or omit for an empty canvas.",
      inputSchema: {
        name: z.string(),
        contentJson: z.string().optional().describe("Serialized GoJS model; blank = empty"),
        classification: z.string().optional().default("Internal"),
      },
    },
    async ({ name, contentJson, classification }) =>
      ok(await bff.createDiagram({ name, contentJson: contentJson ?? "", classification: classification ?? "Internal" })),
  );

  // ---- diagrams (write) — fetch → mutate model → save ---------------------
  server.registerTool(
    "add_block",
    {
      title: "Add block",
      description: "Add a block/symbol to a diagram. `shape` must be a key from list_block_types. Position is the block centre.",
      inputSchema: {
        diagramId: z.union([z.number(), z.string()]),
        shape: z.string().describe("Catalogue key, e.g. 'elec-cap'"),
        text: z.string().optional().describe("Label, e.g. 'C1'"),
        category: z.enum(["symbol", "anim", "shape", "block", "part"]).optional(),
        x: z.number().optional().describe("Centre X"),
        y: z.number().optional().describe("Centre Y"),
      },
    },
    async ({ diagramId, shape, text, category, x, y }) => {
      const dia = await bff.getDiagram(diagramId);
      const model = parseModel(dia.contentJson);
      const key = addNode(model, {
        category: category ?? (shape.startsWith("elec-") ? "symbol" : "block"),
        shape,
        text: text ?? "",
        loc: `${x ?? 0} ${y ?? 0}`,
      });
      await bff.updateDiagram(diagramId, { name: dia.name, contentJson: serialize(model), classification: dia.classification });
      return ok({ addedNodeKey: key });
    },
  );

  server.registerTool(
    "add_link",
    {
      title: "Add link",
      description: "Connect two blocks by their node keys (from get_diagram / add_block results).",
      inputSchema: {
        diagramId: z.union([z.number(), z.string()]),
        fromKey: z.string(),
        toKey: z.string(),
        fromPort: z.string().optional(),
        toPort: z.string().optional(),
      },
    },
    async ({ diagramId, fromKey, toKey, fromPort, toPort }) => {
      const dia = await bff.getDiagram(diagramId);
      const model = parseModel(dia.contentJson);
      const key = addLink(model, { from: fromKey, to: toKey, fromPort, toPort });
      await bff.updateDiagram(diagramId, { name: dia.name, contentJson: serialize(model), classification: dia.classification });
      return ok({ addedLinkKey: key });
    },
  );

  server.registerTool(
    "attach_part",
    {
      title: "Attach part",
      description: "Attach a catalogue part (with quantity) to a block. Get the part fields from search_parts first so the MPN is real.",
      inputSchema: {
        diagramId: z.union([z.number(), z.string()]),
        nodeKey: z.string(),
        part: z.record(z.any()).describe("A part record from search_parts (must include the MPN/part number)"),
        quantity: z.number().int().positive().optional().default(1),
      },
    },
    async ({ diagramId, nodeKey, part, quantity }) => {
      const dia = await bff.getDiagram(diagramId);
      const model = parseModel(dia.contentJson);
      if (!attachPart(model, nodeKey, part, quantity ?? 1)) return fail(`No node with key '${nodeKey}' in diagram ${diagramId}.`);
      await bff.updateDiagram(diagramId, { name: dia.name, contentJson: serialize(model), classification: dia.classification });
      return ok({ attachedTo: nodeKey, quantity: quantity ?? 1 });
    },
  );

  // ---- AI endpoints -------------------------------------------------------
  server.registerTool(
    "recommend_parts",
    {
      title: "Recommend parts",
      description: "Ask the BFF's recommendation engine for parts that fit a design goal (grounded against the catalogue).",
      inputSchema: {
        goal: z.string().describe("e.g. 'buck regulator 12V to 3.3V at 2A'"),
        currentParts: z.array(z.string()).optional(),
      },
    },
    async ({ goal, currentParts }) => ok(await bff.recommend({ goal, currentParts })),
  );

  server.registerTool(
    "run_design_review",
    {
      title: "Run design review",
      description: "Run the AI/rule design review over a diagram (builds the block/link summary from its model automatically).",
      inputSchema: {
        diagramId: z.union([z.number(), z.string()]),
        goal: z.string().optional().describe("What the design is meant to do (improves the review)"),
      },
    },
    async ({ diagramId, goal }) => {
      const dia = await bff.getDiagram(diagramId);
      const { blocks, links } = toReviewShape(parseModel(dia.contentJson));
      return ok(await bff.designReview({ goal: goal ?? dia.name, blocks, links }));
    },
  );

  server.registerTool(
    "image_to_diagram",
    {
      title: "Image to diagram",
      description: "Extract a block diagram (nodes + links + positions) from an image. Needs the BFF's vision model enabled (OLLAMA_ENABLED).",
      inputSchema: { imageBase64: z.string().describe("Base64 image data (data URL or raw base64)") },
    },
    async ({ imageBase64 }) => ok(await bff.imageToDiagram(imageBase64)),
  );

  server.registerTool(
    "suggest_next_block",
    {
      title: "Suggest next block",
      description: "Get suggestions for the next block given the current selection/context.",
      inputSchema: {
        label: z.string().optional(),
        sub: z.string().optional(),
        kind: z.string().optional(),
        customerName: z.string().optional(),
        custBillTo: z.string().optional(),
        projectId: z.string().optional(),
        boardNum: z.string().optional(),
      },
    },
    async (args) => ok(await bff.boxSuggestions(Object.fromEntries(Object.entries(args).map(([k, v]) => [k, String(v ?? "")])))),
  );
}
