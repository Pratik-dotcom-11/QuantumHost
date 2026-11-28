import type { AiProviderType } from "@/types/database";

export interface AiDiagnosticInput {
  projectName: string;
  framework: string;
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
  nodeVersion: string;
  errorSummary: string | null;
  logLines: Array<{ stage: string; level: string; message: string }>;
}

export interface AiDiagnosticOutput {
  summary: string;
  rootCause: string;
  suggestedFixes: string[];
  confidence: "high" | "medium" | "low";
  provider: AiProviderType;
  model: string;
  tokensUsed: number;
  analyzedAt: string;
}

export interface AiProviderConfig {
  provider: AiProviderType;
  model: string;
  apiKey: string;
  baseUrl?: string | null;
}

function buildDiagnosticPrompt(input: AiDiagnosticInput): string {
  const formattedLogs = input.logLines
    .slice(-100)
    .map((l) => `[${l.stage}/${l.level}] ${l.message}`)
    .join("\n");

  return [
    "You are a senior cloud build engineer analyzing a failed web deployment on QuantumHost.",
    "Return strictly valid JSON matching this schema:",
    '{"summary": string, "rootCause": string, "suggestedFixes": string[], "confidence": "high" | "medium" | "low"}',
    "",
    `Project: ${input.projectName}`,
    `Framework: ${input.framework}`,
    `Node Version: ${input.nodeVersion}`,
    `Install Command: ${input.installCommand || "(none)"}`,
    `Build Command: ${input.buildCommand || "(none)"}`,
    `Output Directory: ${input.outputDirectory}`,
    `Error Summary: ${input.errorSummary || "Unknown failure"}`,
    "",
    "Build Logs:",
    formattedLogs || "(no log lines captured)",
  ].join("\n");
}

function parseJsonDiagnosis(rawText: string): {
  summary: string;
  rootCause: string;
  suggestedFixes: string[];
  confidence: "high" | "medium" | "low";
} {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<{
    summary: string;
    rootCause: string;
    suggestedFixes: string[];
    confidence: "high" | "medium" | "low";
  }>;

  return {
    summary: parsed.summary || "Build failed during execution.",
    rootCause: parsed.rootCause || "See build logs for the failing step.",
    suggestedFixes: Array.isArray(parsed.suggestedFixes)
      ? parsed.suggestedFixes.map(String)
      : ["Verify build command and dependencies in project settings."],
    confidence:
      parsed.confidence === "high" ||
      parsed.confidence === "medium" ||
      parsed.confidence === "low"
        ? parsed.confidence
        : "medium",
  };
}

async function callGemini(
  config: AiProviderConfig,
  prompt: string
): Promise<{ text: string; tokensUsed: number }> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    config.model
  )}:generateContent`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { totalTokenCount?: number };
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini API returned an empty response.");
  }

  return {
    text,
    tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
  };
}

async function callOpenAiCompatible(
  config: AiProviderConfig,
  prompt: string
): Promise<{ text: string; tokensUsed: number }> {
  const baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a cloud build diagnostics assistant. Output valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI-compatible API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI-compatible API returned an empty response.");
  }

  return {
    text,
    tokensUsed: data.usage?.total_tokens ?? 0,
  };
}

async function callAnthropic(
  config: AiProviderConfig,
  prompt: string
): Promise<{ text: string; tokensUsed: number }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = data.content?.find((c) => c.type === "text")?.text;
  if (!text) {
    throw new Error("Anthropic API returned an empty response.");
  }

  return {
    text,
    tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
  };
}

export interface AiCopilotInput {
  question: string;
  project?: {
    name: string;
    slug: string;
    framework: string;
    installCommand: string;
    buildCommand: string;
    outputDirectory: string;
    nodeVersion: string;
  } | null;
  deployment?: {
    id: string;
    deploymentNumber: number;
    status: string;
    environment: string;
    branch: string | null;
    errorSummary: string | null;
    buildDurationMs: number | null;
    artifactSizeBytes: number;
    logLines: Array<{ stage: string; level: string; message: string }>;
  } | null;
  usageSummary?: {
    buildMinutes: number;
    storageBytes: number;
    bandwidthBytes: number;
    httpRequests: number;
    deploymentCount: number;
    readyDeployments: number;
    failedDeployments: number;
    aiTokens: number;
  } | null;
}

export interface AiCopilotOutput {
  answer: string;
  keyFindings: string[];
  recommendedActions: string[];
  provider: AiProviderType;
  model: string;
  tokensUsed: number;
  answeredAt: string;
  authorizationNotice: string;
}

function buildCopilotPrompt(input: AiCopilotInput): string {
  const parts: string[] = [
    "You are QuantumHost Deployment Copilot, a senior cloud reliability engineer.",
    "Strictly base your analysis on the supplied real backend telemetry, project config, logs, and usage metrics.",
    "NEVER claim you executed shell commands or modified repository code; present suggested actions strictly for explicit user authorization.",
    "Return strictly valid JSON matching:",
    '{"answer": string, "keyFindings": string[], "recommendedActions": string[]}',
    "",
    `User Question: ${input.question}`,
  ];

  if (input.project) {
    parts.push(
      "",
      "Project Configuration:",
      `- Name: ${input.project.name} (slug: ${input.project.slug})`,
      `- Framework: ${input.project.framework} (Node ${input.project.nodeVersion})`,
      `- Install Command: ${input.project.installCommand || "(none)"}`,
      `- Build Command: ${input.project.buildCommand || "(none)"}`,
      `- Output Directory: ${input.project.outputDirectory}`
    );
  }

  if (input.deployment) {
    const formattedLogs = input.deployment.logLines
      .slice(-120)
      .map((l) => `[${l.stage}/${l.level}] ${l.message}`)
      .join("\n");

    parts.push(
      "",
      `Deployment #${input.deployment.deploymentNumber} (${input.deployment.status}, ${input.deployment.environment})`,
      `- Branch: ${input.deployment.branch || "main"}`,
      `- Build Duration ms: ${input.deployment.buildDurationMs ?? "null"}`,
      `- Artifact Size bytes: ${input.deployment.artifactSizeBytes}`,
      `- Error Summary: ${input.deployment.errorSummary || "(none)"}`,
      "",
      "Captured Build & Hosting Logs:",
      formattedLogs || "(no logs captured yet)"
    );
  }

  if (input.usageSummary) {
    parts.push(
      "",
      "Workspace Infrastructure Usage (Real Recorded Telemetry):",
      `- Total Deployments: ${input.usageSummary.deploymentCount} (${input.usageSummary.readyDeployments} ready, ${input.usageSummary.failedDeployments} failed)`,
      `- Build Minutes: ${input.usageSummary.buildMinutes}`,
      `- Artifact Storage Bytes: ${input.usageSummary.storageBytes}`,
      `- Origin Served Bandwidth Bytes: ${input.usageSummary.bandwidthBytes}`,
      `- Served HTTP Requests: ${input.usageSummary.httpRequests}`,
      `- AI Tokens Consumed: ${input.usageSummary.aiTokens}`
    );
  }

  return parts.join("\n");
}

function parseCopilotJson(rawText: string): {
  answer: string;
  keyFindings: string[];
  recommendedActions: string[];
} {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Partial<{
    answer: string;
    keyFindings: string[];
    recommendedActions: string[];
  }>;

  return {
    answer: parsed.answer || "Analysis complete.",
    keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings.map(String) : [],
    recommendedActions: Array.isArray(parsed.recommendedActions)
      ? parsed.recommendedActions.map(String)
      : [],
  };
}

export async function askDeploymentCopilot(
  config: AiProviderConfig,
  input: AiCopilotInput
): Promise<AiCopilotOutput> {
  const prompt = buildCopilotPrompt(input);

  let rawResult: { text: string; tokensUsed: number };
  if (config.provider === "gemini") {
    rawResult = await callGemini(config, prompt);
  } else if (config.provider === "anthropic") {
    rawResult = await callAnthropic(config, prompt);
  } else {
    rawResult = await callOpenAiCompatible(config, prompt);
  }

  const parsed = parseCopilotJson(rawResult.text);
  return {
    ...parsed,
    provider: config.provider,
    model: config.model,
    tokensUsed: rawResult.tokensUsed,
    answeredAt: new Date().toISOString(),
    authorizationNotice:
      "Advisory only: QuantumHost Copilot never modifies files or executes commands automatically without explicit authorization.",
  };
}

export async function runBuildDiagnosis(
  config: AiProviderConfig,
  input: AiDiagnosticInput
): Promise<AiDiagnosticOutput> {
  const prompt = buildDiagnosticPrompt(input);

  let rawResult: { text: string; tokensUsed: number };
  if (config.provider === "gemini") {
    rawResult = await callGemini(config, prompt);
  } else if (config.provider === "anthropic") {
    rawResult = await callAnthropic(config, prompt);
  } else {
    rawResult = await callOpenAiCompatible(config, prompt);
  }

  const structured = parseJsonDiagnosis(rawResult.text);
  return {
    ...structured,
    provider: config.provider,
    model: config.model,
    tokensUsed: rawResult.tokensUsed,
    analyzedAt: new Date().toISOString(),
  };
}
