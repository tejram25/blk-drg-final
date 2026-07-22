import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { bff } from "./bff.js";
import { registerTools } from "./tools.js";

/**
 * Diagram MCP server. Exposes the Block Diagram app as MCP resources (read
 * context) and tools (actions) over stdio, so any MCP-capable agent — an
 * in-editor copilot, or the Yjs session bot — can read and edit diagrams
 * grounded in the real catalogue. Everything is a thin adapter over the
 * existing Spring BFF endpoints.
 */
async function main(): Promise<void> {
  const server = new McpServer({ name: "diagram-mcp", version: "0.1.0" });

  // ---- resources: read-only context the model can pull in -----------------
  server.registerResource(
    "block-types",
    "catalog://block-types",
    { title: "Block-type catalogue", description: "Valid `shape` keys for blocks", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await bff.blockTypes(), null, 2) }],
    }),
  );

  server.registerResource(
    "diagram",
    new ResourceTemplate("diagram://{id}", { list: undefined }),
    { title: "Diagram", description: "A diagram's GoJS model (nodes + links)", mimeType: "application/json" },
    async (uri, { id }) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await bff.getDiagram(String(id)), null, 2) }],
    }),
  );

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[diagram-mcp] ready on stdio");
}

main().catch((err) => {
  console.error("[diagram-mcp] fatal:", err);
  process.exit(1);
});
