/** Runtime configuration, read once from the environment. */
export const config = {
  bffUrl: (process.env.DIAGRAM_BFF_URL ?? "http://localhost:8080").replace(/\/+$/, ""),
  email: process.env.DIAGRAM_BFF_EMAIL ?? "",
  password: process.env.DIAGRAM_BFF_PASSWORD ?? "",
  collabWsUrl: (process.env.DIAGRAM_COLLAB_WS_URL ?? "ws://localhost:1234").replace(/\/+$/, ""),
  botName: process.env.DIAGRAM_BOT_NAME ?? "Claude",
  botUid: process.env.DIAGRAM_BOT_UID ?? "ai-agent",
};
