import { createServer } from "./api/server";
import { config } from "./config";

const app = createServer();

app.listen(config.port, () => {
  console.log(`backend listening on http://localhost:${config.port} (${config.nodeEnv})`);
});
