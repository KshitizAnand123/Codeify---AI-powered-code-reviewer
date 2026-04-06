import React, { useState } from 'react';
import "./App.css";
import Navbar from './components/Navbar';
import Editor from '@monaco-editor/react';
import Select from 'react-select';
import Markdown from 'react-markdown';
import { ClimbingBoxLoader } from "react-spinners";

const App = () => {
  const options = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'php', label: 'PHP' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'bash', label: 'Bash / Shell' },
    { value: 'powershell', label: 'PowerShell' },
    { value: 'kotlin', label: 'Kotlin' },
    { value: 'swift', label: 'Swift' },
    { value: 'dart', label: 'Dart (Flutter)' },
    { value: 'r', label: 'R' },
    { value: 'matlab', label: 'MATLAB' },
    { value: 'sql', label: 'SQL' },
    { value: 'mongodb', label: 'MongoDB' },
    { value: 'yaml', label: 'YAML' },
    { value: 'json', label: 'JSON' },
    { value: 'dockerfile', label: 'Dockerfile' },
  ];

  // Global state
  const [selectedOption, setSelectedOption] = useState(options[0]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [mode, setMode] = useState("editor"); // "editor" or "github"

  // GitHub state
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [availableFiles, setAvailableFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filesFetched, setFilesFetched] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubReviews, setGithubReviews] = useState([]);
  const [reviewsGenerated, setReviewsGenerated] = useState(false);
  const [githubResponse, setGithubResponse] = useState("");
  const [prConsent, setPrConsent] = useState(false);
  const [branchName, setBranchName] = useState("codeify-ai-fixes");

  const customStyles = {
    control: (provided) => ({
      ...provided,
      backgroundColor: '#18181b',
      borderColor: '#3f3f46',
      color: '#fff',
      width: "100%"
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: '#18181b',
      color: '#fff',
      width: "100%"
    }),
    singleValue: (provided) => ({
      ...provided,
      color: '#fff',
      width: "100%"
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused ? '#27272a' : '#18181b',
      color: '#fff',
      cursor: 'pointer',
    }),
    input: (provided) => ({
      ...provided,
      color: '#fff',
      width: "100%"
    }),
    placeholder: (provided) => ({
      ...provided,
      color: '#a1a1aa',
      width: "100%"
    })
  };

  // Original functions
  async function reviewCode() {
    try {
      if (!code.trim()) {
        alert("Please enter code first");
        return;
      }

      setResponse("");
      setLoading(true);

      const res = await fetch("https://codeify-ai-powered-code-reviewer.onrender.com/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language: selectedOption.value,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to review code");
      }

      const data = await res.json();
      setResponse(data.text || "No response received.");
    } catch (err) {
      setResponse("Error while reviewing code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function fixCode() {
    try {
      if (!code.trim()) {
        alert("Please enter code first");
        return;
      }

      setResponse("");
      setLoading(true);

      const res = await fetch("http://localhost:3001/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language: selectedOption.value,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to fix code");
      }

      const data = await res.json();
      const fixedCode = data.text || "No response received.";
      setCode(fixedCode);
      setResponse("Code has been fixed! The corrected code is now in the editor.");
    } catch (err) {
      setResponse("Error while fixing code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // GitHub functions
  async function fetchGithubFiles() {
    try {
      if (!repoUrl.trim() || !githubToken.trim()) {
        alert("Please enter both repository URL and GitHub token");
        return;
      }

      setGithubLoading(true);
      setGithubResponse("");

      const res = await fetch("http://localhost:3001/github/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          token: githubToken.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch files");
      }

      const data = await res.json();
      setAvailableFiles(data.files);
      setFilesFetched(true);
      setGithubResponse(`Found ${data.files.length} code files in the repository.`);
    } catch (err) {
      setGithubResponse(`Error: ${err.message}`);
    } finally {
      setGithubLoading(false);
    }
  }

  function toggleFileSelection(filePath) {
    setSelectedFiles(prev =>
      prev.includes(filePath)
        ? prev.filter(f => f !== filePath)
        : [...prev, filePath]
    );
  }

  async function reviewGithubFiles() {
    try {
      if (selectedFiles.length === 0) {
        alert("Please select at least one file to review");
        return;
      }

      setGithubLoading(true);
      setGithubResponse("");

      const res = await fetch("http://localhost:3001/github/review-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          token: githubToken.trim(),
          selectedFiles,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to review files");
      }

      const data = await res.json();
      setGithubReviews(data.reviews);
      setReviewsGenerated(true);
      setGithubResponse("Files reviewed successfully!");
    } catch (err) {
      setGithubResponse(`Error: ${err.message}`);
    } finally {
      setGithubLoading(false);
    }
  }

  async function createPullRequest() {
    try {
      if (!prConsent) {
        alert("Please consent to create the pull request");
        return;
      }

      setGithubLoading(true);
      setGithubResponse("");

      const res = await fetch("http://localhost:3001/github/create-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          token: githubToken.trim(),
          reviews: githubReviews,
          branchName,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create pull request");
      }

      const data = await res.json();
      setGithubResponse(`✅ ${data.message}\n\n[View PR](${data.prUrl})\n\nPull Request #${data.prNumber} created successfully!`);
      setPrConsent(false);
    } catch (err) {
      setGithubResponse(`Error: ${err.message}`);
    } finally {
      setGithubLoading(false);
    }
  }

  return (
    <>
      <Navbar />

      <div
        className="main flex justify-between"
        style={{ height: "calc(100vh - 90px)" }}
      >
        {mode === "editor" ? (
          <>
            {/* EDITOR MODE */}
            {/* LEFT SIDE */}
            <div className="left h-[87%] w-[50%]">
              <div className="tabs !mt-5 !px-5 !mb-3 w-full flex items-center gap-[10px]">
                <Select
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e)}
                  options={options}
                  styles={customStyles}
                />

                <button
                  onClick={fixCode}
                  disabled={loading}
                  className={`btnNormal bg-zinc-900 min-w-[120px] transition-all hover:bg-zinc-800 ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {loading ? "Fixing..." : "Fix Code"}
                </button>

                <button
                  onClick={reviewCode}
                  disabled={loading}
                  className={`btnNormal bg-zinc-900 min-w-[120px] transition-all hover:bg-zinc-800 ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {loading ? "Reviewing..." : "Review"}
                </button>

                <button
                  onClick={() => setMode("github")}
                  className="btnNormal bg-purple-600 min-w-[150px] transition-all hover:bg-purple-700"
                >
                  GitHub Integration
                </button>
              </div>

              <Editor
                height="100%"
                theme="vs-dark"
                language={selectedOption.value}
                value={code}
                onChange={(e) => setCode(e)}
              />
            </div>

            {/* RIGHT SIDE */}
            <div className="right relative overflow-scroll !p-[10px] bg-zinc-900 w-[50%] h-[100%]">
              <div className="topTab border-b-[1px] border-t-[1px] border-[#27272a] flex items-center justify-between h-[60px]">
                <p className="font-[700] text-[17px]">Response</p>
              </div>

              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 z-10">
                  <ClimbingBoxLoader color="#9333ea" />
                </div>
              )}

              <Markdown>{response}</Markdown>
            </div>
          </>
        ) : (
          <>
            {/* GITHUB MODE */}
            <div className="w-full bg-zinc-900 overflow-auto">
              <div className="max-w-5xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                  <button
                    onClick={() => setMode("editor")}
                    className="btnNormal bg-zinc-800 mb-4 hover:bg-zinc-700"
                  >
                    ← Back to Editor
                  </button>
                  <h1 className="text-3xl font-bold text-white mb-2">GitHub Integration</h1>
                  <p className="text-zinc-400">Review and fix your GitHub repository code automatically</p>
                </div>

                {/* GitHub Setup */}
                <div className="bg-zinc-800 rounded-lg p-6 mb-6">
                  <h2 className="text-xl font-bold text-white mb-4">Repository Details</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        GitHub Repository URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://github.com/owner/repo or owner/repo"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        className="w-full bg-zinc-700 text-white px-4 py-2 rounded border border-zinc-600 focus:outline-none focus:border-purple-500"
                        disabled={filesFetched}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        GitHub Personal Access Token
                      </label>
                      <input
                        type="password"
                        placeholder="ghp_xxxxxxxxxxxxx"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        className="w-full bg-zinc-700 text-white px-4 py-2 rounded border border-zinc-600 focus:outline-none focus:border-purple-500"
                        disabled={filesFetched}
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Create a token at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">github.com/settings/tokens</a>
                      </p>
                    </div>

                    <button
                      onClick={fetchGithubFiles}
                      disabled={githubLoading || filesFetched}
                      className={`w-full btnNormal bg-purple-600 hover:bg-purple-700 transition-all ${
                        githubLoading || filesFetched ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {githubLoading ? "Fetching files..." : filesFetched ? "Files fetched ✓" : "Fetch Repository Files"}
                    </button>
                  </div>
                </div>

                {/* File Selection */}
                {filesFetched && (
                  <div className="bg-zinc-800 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-white mb-4">
                      Select Files to Review ({selectedFiles.length}/{availableFiles.length})
                    </h2>

                    <div className="max-h-96 overflow-y-auto space-y-2 mb-4 border border-zinc-700 rounded p-4 bg-zinc-900">
                      {availableFiles.map((file) => (
                        <label key={file.path} className="flex items-center space-x-3 cursor-pointer hover:bg-zinc-800 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(file.path)}
                            onChange={() => toggleFileSelection(file.path)}
                            className="w-4 h-4 accent-purple-600"
                          />
                          <span className="text-zinc-300">{file.name}</span>
                          <span className="text-xs text-zinc-500 ml-auto">{(file.size / 1024).toFixed(2)} KB</span>
                        </label>
                      ))}
                    </div>

                    <button
                      onClick={reviewGithubFiles}
                      disabled={githubLoading || selectedFiles.length === 0 || reviewsGenerated}
                      className={`w-full btnNormal bg-blue-600 hover:bg-blue-700 transition-all ${
                        githubLoading || selectedFiles.length === 0 || reviewsGenerated ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {githubLoading ? "Reviewing files..." : reviewsGenerated ? "Files reviewed ✓" : "Review Selected Files"}
                    </button>
                  </div>
                )}

                {/* Reviews */}
                {reviewsGenerated && githubReviews.length > 0 && (
                  <div className="bg-zinc-800 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-white mb-4">Review Results</h2>

                    <div className="space-y-6 max-h-96 overflow-y-auto">
                      {githubReviews.map((review, idx) => (
                        <div key={idx} className="bg-zinc-900 rounded p-4 border border-zinc-700">
                          <h3 className="text-lg font-semibold text-purple-400 mb-2">{review.filePath}</h3>
                          {review.error ? (
                            <p className="text-red-400">Error: {review.error}</p>
                          ) : (
                            <div className="text-zinc-200 text-sm max-h-48 overflow-y-auto">
                              <Markdown>{review.review}</Markdown>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PR Creation */}
                {reviewsGenerated && githubReviews.length > 0 && (
                  <div className="bg-zinc-800 rounded-lg p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Create Pull Request</h2>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                          Branch Name
                        </label>
                        <input
                          type="text"
                          placeholder="codeify-ai-fixes"
                          value={branchName}
                          onChange={(e) => setBranchName(e.target.value)}
                          className="w-full bg-zinc-700 text-white px-4 py-2 rounded border border-zinc-600 focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      <label className="flex items-center space-x-3 cursor-pointer p-4 bg-zinc-900 rounded border border-zinc-700 hover:border-purple-500">
                        <input
                          type="checkbox"
                          checked={prConsent}
                          onChange={(e) => setPrConsent(e.target.checked)}
                          className="w-4 h-4 accent-purple-600"
                        />
                        <span className="text-zinc-200">
                          I consent to create a pull request with the automated fixes in this repository
                        </span>
                      </label>

                      <button
                        onClick={createPullRequest}
                        disabled={githubLoading || !prConsent}
                        className={`w-full btnNormal bg-green-600 hover:bg-green-700 transition-all ${
                          githubLoading || !prConsent ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        {githubLoading ? "Creating PR..." : "Create Pull Request"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Response/Status */}
                {githubResponse && (
                  <div className={`mt-6 p-4 rounded-lg ${
                    githubResponse.includes("Error") ? "bg-red-900/30 border border-red-700" : "bg-green-900/30 border border-green-700"
                  }`}>
                    <Markdown className="text-zinc-200">{githubResponse}</Markdown>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default App;
