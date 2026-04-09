import React, { useState } from 'react';
import "./App.css";
import Navbar from './components/Navbar';
import Editor from '@monaco-editor/react';
import Select from 'react-select';
import Markdown from 'react-markdown';
import { ClimbingBoxLoader } from "react-spinners";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? "https://codeify-ai-powered-code-reviewer.onrender.com"
    : "http://localhost:3001");

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

      const res = await fetch(`${API_BASE_URL}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language: selectedOption.value,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to review code");
      }

      const data = await res.json();
      setResponse(data.text || "No response received.");
    } catch (err) {
      setResponse(`Error while reviewing code: ${err.message || "Please try again."}`);
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

      const res = await fetch(`${API_BASE_URL}/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language: selectedOption.value,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fix code");
      }

      const data = await res.json();
      const fixedCode = data.text || "No response received.";
      setCode(fixedCode);
      setResponse("Code has been fixed! The corrected code is now in the editor.");
    } catch (err) {
      setResponse(`Error while fixing code: ${err.message || "Please try again."}`);
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

      const res = await fetch(`${API_BASE_URL}/github/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          token: githubToken.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to fetch files`);
      }

      const data = await res.json();
      
      if (!data.files || data.files.length === 0) {
        setGithubResponse("No code files found in the repository. The repository might be empty or only contains non-code files.");
        setGithubLoading(false);
        return;
      }

      setAvailableFiles(data.files);
      setFilesFetched(true);
      setGithubResponse(`Found ${data.files.length} code files in the repository. Select files to review.`);
    } catch (err) {
      console.error("GitHub fetch error:", err);
      setGithubResponse(`Error: ${err.message || "Unknown error occurred"}`);
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

      const res = await fetch(`${API_BASE_URL}/github/review-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          token: githubToken.trim(),
          selectedFiles,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to review files`);
      }

      const data = await res.json();
      setGithubReviews(data.reviews);
      setReviewsGenerated(true);
      setGithubResponse(`Review completed. Review results appear below.`);
    } catch (err) {
      console.error("GitHub review error:", err);
      setGithubResponse(`Error: ${err.message || "Unknown error occurred"}`);
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

      const res = await fetch(`${API_BASE_URL}/github/create-pr`, {
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
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to create pull request`);
      }

      const data = await res.json();
      setGithubResponse(`${data.message}\n\n[View Pull Request](${data.prUrl})\n\nPull Request #${data.prNumber} created successfully!`);
      setPrConsent(false);
    } catch (err) {
      console.error("GitHub PR creation error:", err);
      setGithubResponse(`Error: ${err.message || "Unknown error occurred"}`);
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
              <div className="tabs !mt-6 !px-6 !mb-4 w-full flex items-center gap-4">
                <div className="w-64">
                  <Select
                    value={selectedOption}
                    onChange={(e) => setSelectedOption(e)}
                    options={options}
                    styles={customStyles}
                  />
                </div>

                <button
                  onClick={fixCode}
                  disabled={loading}
                  className={`btnNormal bg-zinc-900 min-w-[120px] transition-all hover:bg-zinc-800 py-2 px-4 text-sm font-medium ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {loading ? "Fixing..." : "Fix Code"}
                </button>

                <button
                  onClick={reviewCode}
                  disabled={loading}
                  className={`btnNormal bg-zinc-900 min-w-[120px] transition-all hover:bg-zinc-800 py-2 px-4 text-sm font-medium ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {loading ? "Reviewing..." : "Review"}
                </button>

                <button
                  onClick={() => setMode("github")}
                  className="btnNormal bg-purple-600 min-w-[160px] transition-all hover:bg-purple-700 hover:shadow-lg py-2 px-4 text-sm font-medium"
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
            <div className="right relative overflow-scroll !p-6 bg-zinc-900 w-[50%] h-[100%]">
              <div className="topTab border-b border-zinc-700 flex items-center justify-between h-[60px] mb-4">
                <p className="font-semibold text-lg text-white">Response</p>
              </div>

              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 z-10 rounded-lg">
                  <ClimbingBoxLoader color="#9333ea" />
                </div>
              )}

              <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
                <Markdown>{response}</Markdown>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* GITHUB MODE */}
            <div className="w-full min-h-screen bg-zinc-900 overflow-auto flex justify-center">
              <div className="max-w-6xl w-full mx-auto px-10 py-16">
                {/* Header */}
                <div className="text-center mb-16">
                  <div className="flex justify-center mb-8">
                    <button
                      onClick={() => setMode("editor")}
                      className="btnNormal bg-zinc-800 hover:bg-zinc-700 px-8 py-3 text-sm font-medium"
                    >
                      ← Back to Editor
                    </button>
                  </div>
                  <h1 className="text-6xl font-bold text-white mb-6">GitHub Integration</h1>
                  <p className="text-zinc-400 text-xl leading-relaxed max-w-3xl mx-auto">Review and fix your GitHub repository code automatically</p>
                </div>

                {/* GitHub Setup */}
                <div className="bg-zinc-800 rounded-2xl p-12 mb-12 shadow-2xl">
                  <h2 className="text-4xl font-bold text-white mb-10 text-center">Repository Details</h2>

                  <div className="space-y-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div>
                        <label className="block text-base font-semibold text-zinc-300 mb-4">
                          GitHub Repository URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://github.com/owner/repo or owner/repo"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          className="w-full bg-zinc-700 text-white px-6 py-4 rounded-xl border border-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-base"
                          disabled={filesFetched}
                        />
                      </div>

                      <div>
                        <label className="block text-base font-semibold text-zinc-300 mb-4">
                          GitHub Personal Access Token
                        </label>
                        <input
                          type="password"
                          placeholder="ghp_xxxxxxxxxxxxx"
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          className="w-full bg-zinc-700 text-white px-6 py-4 rounded-xl border border-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-base"
                          disabled={filesFetched}
                        />
                      </div>
                    </div>

                    <div className="text-center space-y-6">
                      <p className="text-base text-zinc-500 leading-relaxed max-w-2xl mx-auto">
                        Create a token at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline hover:text-purple-300 transition-colors font-medium">github.com/settings/tokens</a>
                      </p>

                      <button
                        onClick={fetchGithubFiles}
                        disabled={githubLoading || filesFetched}
                        className={`btnNormal bg-purple-600 hover:bg-purple-700 transition-all py-5 px-12 text-lg font-medium rounded-xl ${
                          githubLoading || filesFetched ? "opacity-50 cursor-not-allowed" : "hover:shadow-2xl hover:scale-105"
                        }`}
                      >
                        {githubLoading ? "Fetching files..." : filesFetched ? "Files fetched" : "Fetch Repository Files"}
                      </button>
                    </div>
                    <br />
                  </div>
                </div>
                <br />
                {/* File Selection */}
                {filesFetched && (
                  <div className="bg-zinc-800 rounded-2xl p-12 mb-12 shadow-2xl">
                    <h2 className="text-4xl font-bold text-white mb-10 text-center">
                      Select Files to Review <span className="text-2xl font-normal text-zinc-400">({selectedFiles.length}/{availableFiles.length} selected)</span>
                    </h2>
                    <br />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                      {availableFiles.map((file) => (
                        <label key={file.path} className="flex items-center space-x-4 cursor-pointer hover:bg-zinc-800 p-6 rounded-xl transition-all duration-200 border border-zinc-700 hover:border-zinc-600 hover:shadow-lg">
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(file.path)}
                            onChange={() => toggleFileSelection(file.path)}
                            className="w-6 h-6 accent-purple-600 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-zinc-300 font-medium block truncate text-base">{file.name}</span>
                            <span className="text-sm text-zinc-500">{(file.size / 1024).toFixed(2)} KB</span>
                          </div>
                        </label>
                      ))}
                    
                    </div>
                    <br />
                    <div className="flex justify-center">
                      <button
                        onClick={reviewGithubFiles}
                        disabled={githubLoading || selectedFiles.length === 0 || reviewsGenerated}
                        className={`btnNormal bg-blue-600 hover:bg-blue-700 transition-all py-5 px-12 text-lg font-medium rounded-xl ${
                          githubLoading || selectedFiles.length === 0 || reviewsGenerated ? "opacity-50 cursor-not-allowed" : "hover:shadow-2xl hover:scale-105"
                        }`}
                      >
                        {githubLoading ? "Reviewing files..." : reviewsGenerated ? "Files reviewed" : "Review Selected Files"}
                      </button>
                    </div>
                    <br />
                  </div>
                )}
                <br />
                {githubResponse && (
                  <div className="bg-zinc-800 rounded-2xl p-10 mb-16 shadow-2xl">
                    <h2 className="text-3xl font-bold text-white mb-8 text-center">Status</h2>
                    <br />
                    <div className={`p-8 rounded-2xl font-medium text-base leading-relaxed space-y-5 ${
                      githubResponse.includes("Error:")
                        ? "bg-red-900/20 border border-red-500 text-red-200"
                        : "bg-green-900/20 border border-green-500 text-green-200"
                    }`}>
                      <Markdown>{githubResponse}</Markdown>
                    </div>
                    <br />
                  </div>
                )}
                <br />
                {/* Reviews */}
                {reviewsGenerated && githubReviews.length > 0 && (
                  <div className="bg-zinc-800 rounded-2xl p-12 mb-12 shadow-2xl">
                    <br />
                    <h2 className="text-4xl font-bold text-white mb-12 text-center">Review Results & Fixed Code</h2>
                    <br />
                    <div className="space-y-10">
                      {githubReviews.map((review, idx) => (
                        <div key={idx} className="bg-zinc-900/70 rounded-2xl p-8 border border-zinc-700 hover:border-zinc-600 transition-all duration-200 shadow-lg">
                          <br />
                          <h3 className="text-2xl font-semibold text-purple-400 mb-8 flex items-center justify-center">
                            <span className="w-4 h-4 bg-purple-400 rounded-full mr-4"></span>
                            {review.filePath}
                          </h3>

                          {review.error ? (
                            <p className="text-red-400 bg-red-900/20 p-6 rounded-xl border border-red-800 text-center text-lg">Error: {review.error}</p>
                          ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                              {/* Review Section */}
                              <div className="space-y-6">
                                <h4 className="text-xl font-semibold text-blue-400 flex items-center justify-center">
                                  <span className="w-3 h-3 bg-blue-400 rounded-full mr-3"></span>
                                  Code Review
                                </h4>
                                <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-600 max-h-96 overflow-y-auto shadow-inner">
                                  <div className="text-zinc-200 text-base leading-relaxed prose prose-invert prose-base max-w-none">
                                    <Markdown>{review.review}</Markdown>
                                  </div>
                                </div>
                              </div>

                              {/* Fixed Code Section */}
                              <div className="space-y-6">
                                <h4 className="text-xl font-semibold text-green-400 flex items-center justify-center">
                                  <span className="w-3 h-3 bg-green-400 rounded-full mr-3"></span>
                                  Fixed Code (Will be pushed to PR)
                                </h4>
                                <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-600 max-h-96 overflow-y-auto shadow-inner">
                                  <pre className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                                    <code>{review.fixedCode}</code>
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <br />
                {/* PR Creation */}
                {reviewsGenerated && githubReviews.length > 0 && (
                  <div className="bg-zinc-800 rounded-2xl p-12 shadow-2xl">
                    <h2 className="text-4xl font-bold text-white mb-12 text-center">Create Pull Request</h2>
                    <br />
                    <div className="max-w-4xl mx-auto space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-base font-semibold text-zinc-300 mb-4">
                            Branch Name
                          </label>
                          <input
                            type="text"
                            placeholder="codeify-ai-fixes"
                            value={branchName}
                            onChange={(e) => setBranchName(e.target.value)}
                            className="w-full bg-zinc-700 text-white px-6 py-4 rounded-xl border border-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-base"
                          />
                        </div>
                        <div className="flex items-end">
                          <div className="w-full">
                            <label className="block text-base font-semibold text-zinc-300 mb-4 opacity-0">
                              Placeholder
                            </label>
                            <div className="text-base text-zinc-400 bg-zinc-700/50 p-4 rounded-xl border border-zinc-600">
                              <strong className="text-white">{githubReviews.length}</strong> file(s) will be updated in the PR
                            </div>
                          </div>
                        </div>
                      </div>
                      <br />
                      <label className="flex items-start gap-5 cursor-pointer p-8 bg-zinc-900/50 rounded-2xl border border-zinc-700 hover:border-purple-500 transition-all duration-200 shadow-lg">
                        <input
                          type="checkbox"
                          checked={prConsent}
                          onChange={(e) => setPrConsent(e.target.checked)}
                          className="w-6 h-6 accent-purple-600 rounded mt-1"
                        />
                        <span className="text-zinc-200 leading-relaxed text-lg max-w-4xl">
                          I consent to create a pull request with the automated fixes in this repository
                        </span>
                      </label>
                      <br />
                      <div className="grid place-items-center pt-6">
                        <button
                          onClick={createPullRequest}
                          disabled={githubLoading || !prConsent}
                          className={`btnNormal inline-flex items-center justify-center bg-green-600 hover:bg-green-700 transition-all py-5 px-16 text-xl font-medium rounded-2xl w-fit ${
                            githubLoading || !prConsent ? "opacity-50 cursor-not-allowed" : "hover:shadow-2xl hover:scale-105"
                          }`}
                        >
                          {githubLoading ? "Creating PR..." : "Create Pull Request"}
                        </button>
                      </div>
                      <br />
                    </div>
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
