import { loadConfig } from "./config";
import { createReplier } from "./replier";
import { startCli } from "./cli";
import { startHttpServer } from "./http-server";
import { StatusStore } from "./status-store";
import { WhatsAppGateway } from "./whatsapp-gateway";

async function main(): Promise<void> {
  const config = loadConfig();
  const startedAt = new Date();

  const status = new StatusStore();
  const replier = createReplier(config);
  const gateway = new WhatsAppGateway(config, status, replier);

  startHttpServer({ config, status, gateway, startedAt });

  if (config.enableCli) {
    startCli({ rootDir: process.cwd(), gateway, status });
  } else {
    // eslint-disable-next-line no-console
    console.log("CLI disabled (ENABLE_CLI=false). Use HTTP /init to start.");
  }
}

void main();
