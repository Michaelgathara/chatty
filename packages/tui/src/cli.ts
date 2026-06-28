import { ChattyApp } from "./app";

async function main(): Promise<void> {
  const app = new ChattyApp();
  await app.run();
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
