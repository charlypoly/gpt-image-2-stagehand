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
      statusMessage: "Extracting product image...",
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
        statusMessage: `Generating try-on for "${productName}"...`,
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
    <div className="min-h-screen w-full bg-neutral-950 text-white">
      {/* Nav */}
      <header className="border-b border-neutral-900">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="w-7 h-7 bg-[#F26522] rounded-sm flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm leading-none">B</span>
          </div>
          <span className="font-semibold text-white text-sm">Browserbase</span>
          <span className="text-neutral-700 text-sm select-none">/</span>
          <span className="text-neutral-400 text-sm">Virtual Try-On</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#F26522]/10 border border-[#F26522]/20 rounded-full px-4 py-1.5 text-sm text-[#F26522] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F26522] animate-pulse" />
            Stagehand + GPT-Image-2
          </div>
          <h1 className="text-5xl font-bold mb-4 text-white tracking-tight">
            Virtual Try-On
          </h1>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Upload a selfie and paste any product URL — see it on you in seconds.
          </p>
        </div>

        {/* Input Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

          {/* Card 1: Selfie */}
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-4">
              Step 1 — Your Selfie
            </p>
            <div
              className={[
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200",
                isDragging
                  ? "border-[#F26522] bg-[#F26522]/5"
                  : state.selfiePreview
                  ? "border-green-600/40 bg-green-600/5"
                  : "border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800/50",
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
                    className="w-28 h-28 object-cover rounded-lg mx-auto ring-2 ring-green-600/40"
                  />
                  <p className="text-sm text-green-400 truncate px-4">{state.selfieFile?.name}</p>
                  <button
                    className="text-xs text-neutral-500 hover:text-neutral-300 underline"
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
                  <div className="flex justify-center text-neutral-600">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <p className="text-neutral-300 font-medium text-sm">Drop your photo here</p>
                  <p className="text-neutral-600 text-xs">or click to browse · JPG, PNG, WebP up to 10MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Product URL */}
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-4">
              Step 2 — Product URL
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-2">
                  Paste any e-commerce product link
                </label>
                <input
                  type="url"
                  value={state.productUrl}
                  onChange={(e) => setState((s) => ({ ...s, productUrl: e.target.value, errorMessage: null }))}
                  placeholder="https://www.amazon.com/dp/..."
                  disabled={isLoading}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#F26522] focus:border-transparent disabled:opacity-50 transition-colors text-sm"
                />
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Works with caps, glasses, scarves, and accessories on Amazon, ASOS, Zara, Nike, and most major retailers.
              </p>

              {/* Product preview after extraction */}
              {state.productImageUrl && (
                <div className="flex items-center gap-3 p-3 bg-neutral-800 rounded-lg border border-neutral-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.productImageUrl}
                    alt={state.productName}
                    className="w-12 h-12 object-contain rounded-md bg-white flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white line-clamp-2">{state.productName}</p>
                    <p className="text-xs text-green-500 mt-0.5">Product extracted</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {state.errorMessage && (
          <div className="mb-5 p-4 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400 text-sm">
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
                "px-10 py-3.5 rounded-lg font-semibold text-base transition-all duration-200",
                isLoading || !state.selfieFile || !state.productUrl
                  ? "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                  : "bg-[#F26522] hover:bg-[#da591e] text-white active:scale-95",
              ].join(" ")}
            >
              {isLoading ? (
                <span className="flex items-center gap-3">
                  <svg className="w-4 h-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
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
              <div className="flex justify-center items-center gap-3 text-xs">
                <span className={state.step === "scraping" ? "text-[#F26522] font-medium" : "text-neutral-700"}>
                  1. Extract product
                </span>
                <span className="text-neutral-800">→</span>
                <span className={state.step === "generating" ? "text-[#F26522] font-medium" : "text-neutral-700"}>
                  2. Generate try-on
                </span>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {state.step === "done" && state.resultImage && (
          <div className="space-y-8">
            <h2 className="text-center text-2xl font-bold text-white tracking-tight">Your Try-On Result</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center space-y-2">
                <p className="text-xs text-neutral-500 uppercase tracking-widest">You</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.selfiePreview!}
                  alt="Your selfie"
                  className="w-full aspect-square object-cover rounded-xl"
                />
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-neutral-500 uppercase tracking-widest">Product</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.productImageUrl!}
                  alt={state.productName}
                  className="w-full aspect-square object-contain bg-white rounded-xl p-4"
                />
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-[#F26522] uppercase tracking-widest font-semibold">Result</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${state.resultImage}`}
                  alt="Virtual try-on result"
                  className="w-full aspect-square object-cover rounded-xl ring-2 ring-[#F26522]"
                />
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <a
                href={`data:image/png;base64,${state.resultImage}`}
                download="tryon-result.png"
                className="px-5 py-2.5 bg-[#F26522] hover:bg-[#da591e] rounded-lg text-white text-sm font-medium transition-colors"
              >
                Download
              </a>
              <button
                onClick={reset}
                className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-white text-sm font-medium transition-colors"
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
