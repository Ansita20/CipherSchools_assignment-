import { createServer } from "./api/server";
import { config } from "./config";

const { app, evaluationService } = createServer();

evaluationService.recoverStuckJobs().catch((err) => {
  console.error("failed to recover in-flight evaluation jobs on boot", err);
});

app.listen(config.port, () => {
  console.log(`backend listening on http://localhost:${config.port} (${config.nodeEnv})`);
});
