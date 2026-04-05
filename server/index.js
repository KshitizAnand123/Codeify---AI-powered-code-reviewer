import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.post("/review", async (req, res) => {
  const { code, language } = req.body;

  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    const response = await model.generateContent({
      model: "gemini-1.5-flash",
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
    console.error("Gemini Error:", err);  // 👈 ADD THIS
    res.status(500).json({ error: "AI review failed" });
  }
});

app.post("/fix", async (req, res) => {
  const { code, language } = req.body;

  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    const response = await model.generateContent({
      model: "gemini-1.5-flash",
      contents: `
You are an expert developer.

Fix the following ${language} code:
- Correct all errors
- Improve readability
- Optimize performance
- Follow best practices

Return ONLY the improved code.
Do NOT include markdown formatting.
Do NOT include \`\`\` or language tags.
Do NOT include explanations.

Code:
${code}
      `,
    });

    res.json({ fixedCode: response.text });
  } catch (err) {
    console.error("Gemini Error:", err);  // 👈 ADD THIS
    res.status(500).json({ error: "AI fix failed" });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

