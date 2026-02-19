/**
 * Adaptador LLM para agentes HIVE.
 * Permite usar proveedores gratuitos (Ollama, Groq) o Anthropic.
 * Configuración vía .env: LLM_PROVIDER=ollama|groq|anthropic
 */

const provider = process.env.LLM_PROVIDER || "groq";

/**
 * Envía mensajes al LLM y devuelve la respuesta en texto.
 * @param {Array<{role: string, content: string}>} messages - Ej: [{ role: "user", content: "Hola" }]
 * @param {{ model?: string }} options - model opcional (por defecto según provider)
 * @returns {Promise<string>}
 */
async function chat(messages, options = {}) {
  if (provider === "ollama") {
    return chatOllama(messages, options);
  }
  if (provider === "groq") {
    return chatGroq(messages, options);
  }
  if (provider === "anthropic") {
    return chatAnthropic(messages, options);
  }
  throw new Error(`LLM_PROVIDER no soportado: ${provider}. Usa: ollama | groq | anthropic`);
}

async function chatOllama(messages, options) {
  const host = process.env.OLLAMA_HOST || "http://localhost:11434";
  const model = options.model || process.env.OLLAMA_MODEL || "llama3.2";
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ollama error ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data.message?.content ?? "";
}

async function chatGroq(messages, options) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY no definido. Regístrate en https://console.groq.com");
  const model = options.model || process.env.LLM_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (content == null) throw new Error("Groq: sin contenido en la respuesta");
  return content;
}

async function chatAnthropic(messages, options) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY no definido");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: key });
  const system = messages.find((m) => m.role === "system")?.content;
  const userMessages = messages.filter((m) => m.role !== "system");
  const res = await client.messages.create({
    model: options.model || "claude-3-5-haiku-20241022",
    max_tokens: 1024,
    system: system || undefined,
    messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
  });
  const block = res.content?.find((b) => b.type === "text");
  return block?.text ?? "";
}

export { chat, provider };
