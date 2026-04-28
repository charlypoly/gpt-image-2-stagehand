"use client";

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from "react";

type Step = "idle" | "scraping" | "generating" | "done" | "error";

interface State {
  step: Step;
  selfiePreview: string | null;
  selfieFile: File | null;
  productUrl: string;
  productImageUrl: string | null;
  productName: string;
  resultImage: string | null;
  errorMessage: string | null;
  statusMessage: string;
}

const INITIAL_STATE: State = {
  step: "idle",
  selfiePreview: null,
  selfieFile: null,
  productUrl: "",
  productImageUrl: null,
  productName: "",
  resultImage: null,
  errorMessage: null,
  statusMessage: "",
};

export default function TryOnApp() {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setState((s) => ({ ...s, errorMessage: "Please upload an image file (JPG, PNG, WebP)" }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setState((s) => ({ ...s, errorMessage: "Image must be smaller than 10MB" }));
      return;
    }
    const preview = URL.createObjectURL(file);
    setState((s) => ({ ...s, selfieFile: file, selfiePreview: preview, errorMessage: null }));
  }, []);

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleTryOn = async () => {
    if (!state.selfieFile) {
      setState((s) => ({ ...s, errorMessage: "Please upload a selfie first" }));
      return;
    }
    if (!state.productUrl.startsWith("http")) {
      setState((s) => ({ ...s, errorMessage: "Please enter a valid product URL starting with https://" }));
      return;
    }

    setState((s) => ({
      ...s,
      step: "scraping",
      errorMessage: null,
      resultImage: null,
      productImageUrl: null,
      statusMessage: "Extracting product image…",
    }));

    try {
      // Step 1: Stagehand agent extracts the product image and name
      const scrapeRes = await fetch("/api/extract-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: state.productUrl }),
      });

      if (!scrapeRes.ok) {
        const err = await scrapeRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Product extraction failed (${scrapeRes.status})`);
      }

      const { imageUrl, productName } = (await scrapeRes.json()) as {
        imageUrl: string;
        productName: string;
      };

      setState((s) => ({
        ...s,
        step: "generating",
        productImageUrl: imageUrl,
        productName,
        statusMessage: `Generating try-on for "${productName}"…`,
      }));

      // Step 2: GPT-Image-2 generates the try-on
      const tryOnForm = new FormData();
      tryOnForm.append("selfie", state.selfieFile);
      tryOnForm.append("productImageUrl", imageUrl);
      tryOnForm.append("productName", productName);

      const tryOnRes = await fetch("/api/tryon", { method: "POST", body: tryOnForm });

      if (!tryOnRes.ok) {
        const err = await tryOnRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Try-on failed (${tryOnRes.status})`);
      }

      const { resultImage } = (await tryOnRes.json()) as { resultImage: string };

      setState((s) => ({ ...s, step: "done", resultImage, statusMessage: "Your try-on is ready!" }));
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        step: "error",
        errorMessage: err instanceof Error ? err.message : "An unexpected error occurred",
        statusMessage: "",
      }));
    }
  };

  const reset = () => {
    if (state.selfiePreview) URL.revokeObjectURL(state.selfiePreview);
    setState(INITIAL_STATE);
  };

  const isLoading = state.step === "scraping" || state.step === "generating";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white">
      <div className="max-w-5xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-6">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            Powered by Stagehand + GPT-Image-2
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            Virtual Try-On
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Upload a selfie and paste any product URL — see it on you in seconds.
          </p>
        </div>

        {/* Input Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">

          {/* Card 1: Selfie */}
          <div className="bg-slate-800/60 backdrop-blur rounded-2xl p-6 border border-slate-700/60">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
              Step 1 — Your Selfie
            </p>
            <div
              className={[
                "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
                isDragging
                  ? "border-violet-400 bg-violet-500/10"
                  : state.selfiePreview
                  ? "border-green-500/40 bg-green-500/5"
                  : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/30",
              ].join(" ")}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileInputChange}
              />
              {state.selfiePreview ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.selfiePreview}
                    alt="Selfie preview"
                    className="w-28 h-28 object-cover rounded-xl mx-auto ring-2 ring-green-500/40"
                  />
                  <p className="text-sm text-green-400 truncate px-4">{state.selfieFile?.name}</p>
                  <button
                    className="text-xs text-slate-400 hover:text-slate-300 underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (state.selfiePreview) URL.revokeObjectURL(state.selfiePreview);
                      setState((s) => ({ ...s, selfieFile: null, selfiePreview: null }));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <div className="text-3xl">📸</div>
                  <p className="text-slate-300 font-medium">Drop your photo here</p>
                  <p className="text-slate-500 text-sm">or click to browse · JPG, PNG, WebP up to 10MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Product URL */}
          <div className="bg-slate-800/60 backdrop-blur rounded-2xl p-6 border border-slate-700/60">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
              Step 2 — Product URL
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Paste any e-commerce product link
                </label>
                <input
                  type="url"
                  value={state.productUrl}
                  onChange={(e) => setState((s) => ({ ...s, productUrl: e.target.value, errorMessage: null }))}
                  placeholder="https://www.amazon.com/dp/..."
                  disabled={isLoading}
                  className="w-full bg-slate-700/80 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 transition-colors"
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Works great with caps, glasses, scarves, jewelry, and accessories on Amazon, ASOS, Zara, Nike, and most major retailers.
              </p>

              {/* Product preview after scraping */}
              {state.productImageUrl && (
                <div className="flex items-center gap-3 p-3 bg-slate-700/60 rounded-xl border border-slate-600/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.productImageUrl}
                    alt={state.productName}
                    className="w-14 h-14 object-contain rounded-lg bg-white flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white line-clamp-2">{state.productName}</p>
                    <p className="text-xs text-green-400 mt-0.5">Product extracted</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {state.errorMessage && (
          <div className="mb-5 p-4 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300 text-sm">
            {state.errorMessage}
          </div>
        )}

        {/* Try On Button */}
        {state.step !== "done" && (
          <div className="text-center mb-10 space-y-4">
            <button
              onClick={handleTryOn}
              disabled={isLoading || !state.selfieFile || !state.productUrl}
              className={[
                "px-12 py-4 rounded-2xl font-semibold text-lg transition-all duration-200",
                isLoading || !state.selfieFile || !state.productUrl
                  ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white shadow-xl shadow-violet-900/30 hover:shadow-violet-900/50 active:scale-95",
              ].join(" ")}
            >
              {isLoading ? (
                <span className="flex items-center gap-3">
                  <svg className="w-5 h-5 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {state.statusMessage}
                </span>
              ) : (
                "Try On"
              )}
            </button>

            {/* Step progress */}
            {isLoading && (
              <div className="flex justify-center items-center gap-3 text-sm">
                <span className={state.step === "scraping" ? "text-violet-300 font-medium" : "text-slate-600"}>
                  1. Extract product image
                </span>
                <span className="text-slate-700">→</span>
                <span className={state.step === "generating" ? "text-violet-300 font-medium" : "text-slate-600"}>
                  2. Generate try-on
                </span>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {state.step === "done" && state.resultImage && (
          <div className="space-y-8">
            <h2 className="text-center text-2xl font-bold text-white">Your Try-On Result</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-widest">You</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.selfiePreview!}
                  alt="Your selfie"
                  className="w-full aspect-square object-cover rounded-2xl"
                />
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-widest">Product</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.productImageUrl!}
                  alt={state.productName}
                  className="w-full aspect-square object-contain bg-white rounded-2xl p-4"
                />
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-violet-400 uppercase tracking-widest font-semibold">Try-On Result</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${state.resultImage}`}
                  alt="Virtual try-on result"
                  className="w-full aspect-square object-cover rounded-2xl ring-2 ring-violet-500"
                />
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <a
                href={`data:image/png;base64,${state.resultImage}`}
                download="tryon-result.png"
                className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-medium transition-colors"
              >
                Download Result
              </a>
              <button
                onClick={reset}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-colors"
              >
                Try Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
