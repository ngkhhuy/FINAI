import app from "./app";
import { env } from "./config/env";

const PORT = env.PORT;

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[server] FINAI backend running on http://localhost:${PORT}`);
  console.log(`[server] Environment: ${env.NODE_ENV}`);
});
