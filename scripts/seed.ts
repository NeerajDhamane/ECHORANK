import { seedDemoData, demoCredentials } from "@/lib/demo-seed";

async function main() {
  const reset = process.argv.includes("--reset");
  const result = await seedDemoData(undefined, { reset });
  console.log(`Demo login: ${demoCredentials.email} / ${demoCredentials.password}`);
  console.log(`Seeded brand ${result.brandId}: ${result.prompts} prompts, ${result.runs} runs, ${result.chats} simulated answers${reset ? " (reset by soft-deleting the prior demo brand)" : ""}.`);
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : "Demo seed failed.");
  process.exitCode = 1;
});
