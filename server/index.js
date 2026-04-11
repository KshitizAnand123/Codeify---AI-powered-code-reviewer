import crypto from "crypto";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { Octokit } from "octokit";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const AI_PROVIDER = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const AI_FALLBACK_PROVIDER = (process.env.AI_FALLBACK_PROVIDER || "").toLowerCase();

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";

const GEMINI_PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
const GEMINI_MODELS = [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL].filter(
  (model, index, items) => model && items.indexOf(model) === index
);

const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 20000);
const REVIEW_MAX_OUTPUT_TOKENS = Number(process.env.REVIEW_MAX_OUTPUT_TOKENS || 500);
const FIX_MAX_OUTPUT_TOKENS = Number(process.env.FIX_MAX_OUTPUT_TOKENS || 1800);
const AI_CACHE_TTL_MS = Number(process.env.AI_CACHE_TTL_MS || 5 * 60 * 1000);
const MAX_CODE_CHARS = Number(process.env.MAX_CODE_CHARS || 12000);

const rawGeminiKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const geminiApiKeys = rawGeminiKeys
  .split(/[,;\n\r]+/)
  .map((key) => key.trim())
  .filter(Boolean);

const responseCache = new Map();
let currentGeminiKeyIndex = 0;

function sanitizeProviderName(provider) {
  return String(provider || "").trim().toLowerCase();
}

function getProviderChain() {
  const providers = [sanitizeProviderName(AI_PROVIDER), sanitizeProviderName(AI_FALLBACK_PROVIDER)]
    .filter(Boolean)
    .filter((provider, index, items) => items.indexOf(provider) === index)
    .filter((provider) => provider === "ollama" || provider === "gemini");

  return providers.length > 0 ? providers : ["gemini"];
}

function extractErrorMessage(err) {
  if (!err) {
    return "Unknown AI provider error.";
  }

  if (typeof err === "string") {
    return err;
  }

  return err.message || err.error?.message || err.details || "Unknown AI provider error.";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function createCacheKey(mode, language, code) {
  const hash = crypto.createHash("sha256");
  hash.update(`${mode}::${language || "text"}::${code}`);
  return hash.digest("hex");
}

function getCachedResponse(key) {
  const entry = responseCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedResponse(key, value) {
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + AI_CACHE_TTL_MS,
  });
}

function trimCode(code = "") {
  if (code.length <= MAX_CODE_CHARS) {
    return code;
  }

  return `${code.slice(0, MAX_CODE_CHARS)}\n\n/* Code truncated for fast review */`;
}

function getCurrentGeminiKey() {
  return geminiApiKeys[currentGeminiKeyIndex];
}

function rotateGeminiKey() {
  currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % geminiApiKeys.length;
  return getCurrentGeminiKey();
}

function modelNameMatches(installedModelName = "", requestedModelName = "") {
  const normalizedInstalled = installedModelName.toLowerCase();
  const normalizedRequested = requestedModelName.toLowerCase();

  return (
    normalizedInstalled === normalizedRequested ||
    normalizedInstalled.startsWith(`${normalizedRequested}:`)
  );
}

async function getOllamaTags() {
  const response = await fetch(`${OLLAMA_API_URL}/api/tags`);

  if (!response.ok) {
    throw new Error(`Ollama health check failed with status ${response.status}.`);
  }

  return response.json();
}

async function getOllamaStatus() {
  try {
    const data = await getOllamaTags();
    const modelAvailable = data.models?.some((model) => modelNameMatches(model.name, OLLAMA_MODEL));

    return {
      reachable: true,
      modelAvailable,
      model: OLLAMA_MODEL,
      installedModels: data.models?.map((model) => model.name) || [],
    };
  } catch (err) {
    return {
      reachable: false,
      modelAvailable: false,
      model: OLLAMA_MODEL,
      installedModels: [],
      error: extractErrorMessage(err),
    };
  }
}

function getPromptTemplate(mode, language, code) {
  const compactCode = trimCode(code);

  if (mode === "review") {
    return `You are a fast senior code reviewer.
Review this ${language || "code"} snippet.

${compactCode}

Return concise markdown with exactly these sections:
## Rating
One of: Better, Good, Normal, Bad
## Summary
1-2 sentences
## Top Issues
Up to 3 short bullet points
## Fix Suggestions
Up to 3 short bullet points

Keep the whole answer under 180 words.`;
  }

  return `Fix this ${language || "code"}.
Return only the corrected code.
Do not explain anything.
Do not use markdown fences.

${compactCode}`;
}

function getGeminiConfig(mode) {
  return {
    temperature: mode === "fix" ? 0 : 0.1,
    maxOutputTokens: mode === "fix" ? FIX_MAX_OUTPUT_TOKENS : REVIEW_MAX_OUTPUT_TOKENS,
    thinkingConfig: {
      thinkingBudget: 0,
    },
  };
}

async function queryGemini(mode, language, code) {
  if (geminiApiKeys.length === 0) {
    throw new Error("Gemini is not configured. Add GEMINI_API_KEY or GEMINI_API_KEYS to server/.env.");
  }

  const prompt = getPromptTemplate(mode, language, code);
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    for (let keyAttempt = 0; keyAttempt < geminiApiKeys.length; keyAttempt += 1) {
      const currentIndex = currentGeminiKeyIndex;
      const client = new GoogleGenAI({ apiKey: getCurrentGeminiKey() });

      try {
        const response = await withTimeout(
          client.models.generateContent({
            model,
            contents: prompt,
            config: getGeminiConfig(mode),
          }),
          REQUEST_TIMEOUT_MS,
          `Gemini ${model}`
        );

        const text = (response.text || "").trim();
        if (!text) {
          throw new Error(`Gemini ${model} returned an empty response.`);
        }

        return {
          text,
          provider: "gemini",
          model,
        };
      } catch (err) {
        lastError = err;
        console.warn(`Gemini request failed with model ${model} and key index ${currentIndex}: ${extractErrorMessage(err)}`);

        if (keyAttempt < geminiApiKeys.length - 1) {
          rotateGeminiKey();
          await sleep(250);
        }
      }
    }

    await sleep(400);
  }

  throw new Error(`Gemini failed for all configured models and keys: ${extractErrorMessage(lastError)}`);
}

async function queryOllama(mode, language, code) {
  const prompt = getPromptTemplate(mode, language, code);

  const response = await withTimeout(
    fetch(`${OLLAMA_API_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        temperature: mode === "fix" ? 0 : 0.1,
      }),
    }),
    REQUEST_TIMEOUT_MS,
    `Ollama ${OLLAMA_MODEL}`
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Ollama failed with status ${response.status}: ${errorBody || response.statusText}. ` +
      `Make sure model "${OLLAMA_MODEL}" is installed.`
    );
  }

  const data = await response.json();
  const text = (data.response || "").trim();

  if (!text) {
    throw new Error(`Ollama ${OLLAMA_MODEL} returned an empty response.`);
  }

  return {
    text,
    provider: "ollama",
    model: OLLAMA_MODEL,
  };
}

async function queryAI(mode, language, code) {
  const cacheKey = createCacheKey(mode, language, code);
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    return cached;
  }

  const providerChain = getProviderChain();
  const errors = [];

  for (const provider of providerChain) {
    try {
      const result =
        provider === "ollama"
          ? await queryOllama(mode, language, code)
          : await queryGemini(mode, language, code);

      setCachedResponse(cacheKey, result);
      return result;
    } catch (err) {
      const message = extractErrorMessage(err);
      console.warn(`Provider ${provider} failed: ${message}`);
      errors.push(`${provider}: ${message}`);
    }
  }

  throw new Error(`All AI providers failed. ${errors.join(" | ")}`);
}

function cleanFixedCode(text = "") {
  return text
    .replace(/^```[a-zA-Z]*\n?/gm, "")
    .replace(/```\n?$/gm, "")
    .trim();
}

function parseGitHubRepoInput(repoUrl = "") {
  if (repoUrl.includes("github.com")) {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      throw new Error("Invalid GitHub URL");
    }

    return {
      owner: match[1],
      repo: match[2].replace(".git", ""),
    };
  }

  const parts = repoUrl.split("/");
  if (parts.length !== 2) {
    throw new Error("Invalid repo format");
  }

  return {
    owner: parts[0],
    repo: parts[1],
  };
}

async function listRepositoryCodeFiles(octokit, owner, repo) {
  const codeExtensions = [
    ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".cs",
    ".go", ".rs", ".php", ".rb", ".swift", ".kt", ".dart", ".r", ".sql",
    ".yaml", ".yml", ".json", ".html", ".css", ".scss", ".md"
  ];

  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  const { data: branchData } = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch: defaultBranch,
  });

  const { data: treeData } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branchData.commit.sha,
    recursive: "true",
  });

  return (treeData.tree || [])
    .filter((item) => item.type === "blob" && codeExtensions.some((ext) => item.path.endsWith(ext)))
    .map((item) => ({
      name: item.path.split("/").pop(),
      path: item.path,
      size: item.size ?? 0,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (true) {
      const index = currentIndex;
      currentIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

app.get("/health", async (req, res) => {
  const ollamaStatus = await getOllamaStatus();

  res.json({
    status: "ready",
    providerChain: getProviderChain(),
    ollama: ollamaStatus,
    gemini: {
      configured: geminiApiKeys.length > 0,
      keyCount: geminiApiKeys.length,
      models: GEMINI_MODELS,
    },
    cacheTtlMs: AI_CACHE_TTL_MS,
    timeoutMs: REQUEST_TIMEOUT_MS,
    message: "AI backend is configured for fast responses.",
  });
});

app.post("/review", async (req, res) => {
  const { code, language } = req.body;

  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    const response = await queryAI("review", language, code);
    res.json({ text: response.text, provider: response.provider, model: response.model });
  } catch (err) {
    res.status(500).json({ error: extractErrorMessage(err) });
  }
});

app.post("/fix", async (req, res) => {
  const { code, language } = req.body;

  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    const response = await queryAI("fix", language, code);
    res.json({
      text: cleanFixedCode(response.text),
      provider: response.provider,
      model: response.model,
    });
  } catch (err) {
    res.status(500).json({ error: extractErrorMessage(err) });
  }
});

app.post("/github/files", async (req, res) => {
  const { repoUrl, token } = req.body;

  if (!repoUrl || !token) {
    return res.status(400).json({ error: "Repository URL and token are required" });
  }

  try {
    const { owner, repo } = parseGitHubRepoInput(repoUrl);
    const octokit = new Octokit({ auth: token });
    const files = await listRepositoryCodeFiles(octokit, owner, repo);
    res.json({ files, owner, repo });
  } catch (err) {
    res.status(500).json({ error: extractErrorMessage(err) || "Failed to fetch repository files" });
  }
});

app.post("/github/review-files", async (req, res) => {
  const { repoUrl, token, selectedFiles } = req.body;

  if (!repoUrl || !token || !selectedFiles || selectedFiles.length === 0) {
    return res.status(400).json({ error: "Repository URL, token, and selected files are required" });
  }

  try {
    const { owner, repo } = parseGitHubRepoInput(repoUrl);

    const octokit = new Octokit({ auth: token });
    const reviews = await mapWithConcurrency(selectedFiles, 2, async (filePath) => {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
        });

        const content = Buffer.from(data.content, "base64").toString("utf-8");
        const language = filePath.split(".").pop();

        const [review, fixedReview] = await Promise.all([
          queryAI("review", language, content),
          queryAI("fix", language, content),
        ]);

        return {
          filePath,
          review: review.text,
          fixedCode: cleanFixedCode(fixedReview.text),
          sha: data.sha,
          provider: review.provider,
          model: review.model,
        };
      } catch (fileErr) {
        return {
          filePath,
          error: extractErrorMessage(fileErr),
        };
      }
    });

    res.json({ reviews, owner, repo });
  } catch (err) {
    res.status(500).json({ error: extractErrorMessage(err) || "Failed to review files" });
  }
});

app.post("/github/create-pr", async (req, res) => {
  const { repoUrl, token, reviews, branchName = "codeify-ai-fixes" } = req.body;

  if (!repoUrl || !token || !reviews || reviews.length === 0) {
    return res.status(400).json({ error: "Repository URL, token, and reviews are required" });
  }

  try {
    const { owner, repo } = parseGitHubRepoInput(repoUrl);

    const octokit = new Octokit({ auth: token });
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const baseBranch = repoData.default_branch;

    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });
    const baseCommitSha = refData.object.sha;

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseCommitSha,
    });

    for (const review of reviews) {
      if (review.error || !review.fixedCode) {
        continue;
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: review.filePath,
        message: `Codeify AI: Fix issues in ${review.filePath}`,
        content: Buffer.from(review.fixedCode).toString("base64"),
        branch: branchName,
        sha: review.sha,
      });
    }

    const prBody = reviews
      .map((review) => `## ${review.filePath}\n\n${review.review || "No issues found"}`)
      .join("\n\n---\n\n");

    const { data: prData } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: "Codeify AI: Automated Code Improvements",
      body: `Automated code review and fixes by Codeify AI\n\n${prBody}`,
      head: branchName,
      base: baseBranch,
    });

    res.json({
      success: true,
      prUrl: prData.html_url,
      prNumber: prData.number,
      message: "Pull request created successfully!",
    });
  } catch (err) {
    res.status(500).json({ error: extractErrorMessage(err) || "Failed to create pull request" });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`AI provider chain: ${getProviderChain().join(" -> ")}`);
  console.log(`Gemini models: ${GEMINI_MODELS.join(" -> ") || "none"}`);
  console.log(`Ollama model: ${OLLAMA_MODEL}`);
});
