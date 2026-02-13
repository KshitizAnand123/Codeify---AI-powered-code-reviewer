import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

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

app.listen(3001, () => {
  console.log("Backend running at http://localhost:3001");
});
