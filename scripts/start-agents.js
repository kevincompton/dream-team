import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const agents = ["proposer", "executor", "validator"];

console.log("Iniciando agentes del protocolo Hive...");

agents.forEach((agentName) => {
  const agentPath = path.join(__dirname, "..", "agents", agentName);
  const agentProcess = spawn("node", ["index.js"], {
    cwd: agentPath,
    stdio: "inherit",
    shell: true,
  });

  agentProcess.on("error", (error) => {
    console.error(`Error al iniciar agente ${agentName}:`, error);
  });

  console.log(`✓ Agente ${agentName} iniciado`);
});

console.log("\nTodos los agentes están corriendo. Presiona Ctrl+C para detenerlos.");
