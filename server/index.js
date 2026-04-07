import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { Octokit } from "octokit";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.post("/review", async (req, res) => {
  const { code, language } = req.body;

  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
You are a senior developer.
Review the following ${language} code:

${code}
Your job is to deeply review this code and provide the following:

1. A quality rating: Better, Good, Normal, or Bad.
2. Detailed suggestions for improvement, including best practices and advanced alternatives.
3. A clear explanation of what the code does, step by step.
4. A list of any potential bugs or logical errors, if found.
5. Identification of syntax errors or runtime errors, if present.
6. Solutions and recommendations on how to fix each identified issue.

Analyze it like a senior developer reviewing a pull request.
      `,
    });

    res.json({ text: response.text });
  } catch (err) {
    res.status(500).json({ error: "AI review failed" });
  }
});

app.post("/fix", async (req, res) => {
  const { code, language } = req.body;

  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a senior developer. Fix the following ${language} code by correcting any bugs, improving syntax, and following best practices. Return only the corrected code without any explanations or markdown formatting.

${code}`,
    });

    // Extract just the code from the response
    let fixedCode = response.text || "";
    
    // Clean up the response - remove markdown code blocks if present
    fixedCode = fixedCode.replace(/^```[a-zA-Z]*\n?/gm, "").replace(/```\n?$/gm, "").trim();
    
    res.json({ text: fixedCode });
  } catch (err) {
    res.status(500).json({ error: "AI fix failed" });
  }
});

// GitHub Integration Endpoints
app.post("/github/files", async (req, res) => {
  const { repoUrl, token } = req.body;

  if (!repoUrl || !token) {
    return res.status(400).json({ error: "Repository URL and token are required" });
  }

  try {
    // Parse repo URL (supports https://github.com/owner/repo and owner/repo formats)
    let owner, repo;
    if (repoUrl.includes("github.com")) {
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error("Invalid GitHub URL");
      owner = match[1];
      repo = match[2].replace(".git", "");
    } else {
      const parts = repoUrl.split("/");
      if (parts.length !== 2) throw new Error("Invalid repo format");
      owner = parts[0];
      repo = parts[1];
    }

    const octokit = new Octokit({ auth: token });

    // Get repository structure
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: "",
    });

    // Filter only code files
    const codeExtensions = [
      ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".cs",
      ".go", ".rs", ".php", ".rb", ".swift", ".kt", ".dart", ".r", ".sql",
      ".yaml", ".yml", ".json", ".html", ".css", ".scss", ".md"
    ];

    const files = data
      .filter(item => item.type === "file" && codeExtensions.some(ext => item.name.endsWith(ext)))
      .map(item => ({
        name: item.name,
        path: item.path,
        size: item.size,
      }));

    res.json({ files, owner, repo });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch repository files" });
  }
});

app.post("/github/review-files", async (req, res) => {
  const { repoUrl, token, selectedFiles } = req.body;

  if (!repoUrl || !token || !selectedFiles || selectedFiles.length === 0) {
    return res.status(400).json({ error: "Repository URL, token, and selected files are required" });
  }

  try {
    // Parse repo URL
    let owner, repo;
    if (repoUrl.includes("github.com")) {
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error("Invalid GitHub URL");
      owner = match[1];
      repo = match[2].replace(".git", "");
    } else {
      const parts = repoUrl.split("/");
      owner = parts[0];
      repo = parts[1];
    }

    const octokit = new Octokit({ auth: token });
    const reviews = [];

    for (const filePath of selectedFiles) {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
        });

        const content = Buffer.from(data.content, "base64").toString("utf-8");
        const language = filePath.split(".").pop();

        // Review the file
        const review = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `You are a senior developer.
Review the following ${language} code from file "${filePath}":

${content}

Your job is to deeply review this code and provide:
1. A quality rating: Better, Good, Normal, or Bad.
2. Detailed suggestions for improvement.
3. Potential bugs or logical errors.
4. Syntax or runtime errors.
5. Fixes and recommendations.`,
        });

        // Get the fixed version
        const fixedReview = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `You are a senior developer. Fix the following ${language} code by correcting any bugs, improving syntax, and following best practices. Return only the corrected code without any explanations or markdown formatting.

${content}`,
        });

        let fixedCode = fixedReview.text || "";
        fixedCode = fixedCode.replace(/^```[a-zA-Z]*\n?/gm, "").replace(/```\n?$/gm, "").trim();

        reviews.push({
          filePath,
          review: review.text,
          fixedCode,
          sha: data.sha,
        });
      } catch (fileErr) {
        reviews.push({
          filePath,
          error: fileErr.message,
        });
      }
    }

    res.json({ reviews, owner, repo });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to review files" });
  }
});

app.post("/github/create-pr", async (req, res) => {
  const { repoUrl, token, reviews, branchName = "codeify-ai-fixes" } = req.body;

  if (!repoUrl || !token || !reviews || reviews.length === 0) {
    return res.status(400).json({ error: "Repository URL, token, and reviews are required" });
  }

  try {
    // Parse repo URL
    let owner, repo;
    if (repoUrl.includes("github.com")) {
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error("Invalid GitHub URL");
      owner = match[1];
      repo = match[2].replace(".git", "");
    } else {
      const parts = repoUrl.split("/");
      if (parts.length !== 2) throw new Error("Invalid repo format");
      owner = parts[0];
      repo = parts[1];
    }

    const octokit = new Octokit({ auth: token });

    // Validate access and get default branch
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const baseBranch = repoData.default_branch;

    // Get the commit SHA of the base branch
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });
    const baseCommitSha = refData.object.sha;

    // Create new branch only if it does not already exist
    try {
      await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });
      console.log(`Branch ${branchName} already exists, continuing with it.`);
    } catch (branchErr) {
      if (branchErr.status === 404) {
        await octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branchName}`,
          sha: baseCommitSha,
        });
      } else {
        throw branchErr;
      }
    }

    // Update files with fixed code
    for (const review of reviews) {
      if (review.error || !review.fixedCode) continue;

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

    // Create PR
    const prBody = reviews
      .map(r => `## ${r.filePath}\n\n${r.review || "No issues found"}`)
      .join("\n\n---\n\n");

    const { data: prData } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: "🤖 Codeify AI: Automated Code Improvements",
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
    const message = err.message || "Failed to create pull request";
    const guidance = message.includes("Resource not accessible by personal access token")
      ? "Make sure your GitHub PAT has the `repo` scope and write access to this repository. If the repo belongs to an organization, ensure the token is granted access to that organization."
      : "";

    res.status(500).json({
      error: `${message}${guidance ? ` ${guidance}` : ""}`,
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

