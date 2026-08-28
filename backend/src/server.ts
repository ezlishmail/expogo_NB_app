import { buildApp } from "./app";
import { env } from "./config";
import { startReminderCron } from "./lib/reminders";

const app = await buildApp();

await app.listen({ port: env.PORT, host: "0.0.0.0" });
app.log.info(`API listening on http://localhost:${env.PORT}/api/v1`);

startReminderCron(5);
