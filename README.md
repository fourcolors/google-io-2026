# 🎮 GemmaQuest — Generative WebGPU RPG

> **Google I/O 2026 Hackathon Winner Design**
>
> Live Demo: [**Play GemmaQuest in the Browser 🚀**](https://fourcolors.github.io/google-io-2026/)
>
> Standalone Interactive Spec & Tests: [**Launch Single-File Runner 🧪**](https://fourcolors.github.io/google-io-2026/gemmaquest.html)

---

```
   ┌──────────────────────────────────────────────────────────┐
   │                                                          │
   │  G E M M A Q U E S T : Generative WebGPU Realms          │
   │                                                          │
   │  [X: -5, Y: 0] Verdant Steppes                           │
   │  LOCAL · GPU [🟢 READY]                                  │
   │                                                          │
   │  "The mists part as you arrive. Gemma writes the land."   │
   │                                                          │
   └──────────────────────────────────────────────────────────┘
```

**GemmaQuest** is a 100% serverless, client-side generative RPG. A 2.3B parameter **Google Gemma 4 E2B** model runs entirely on your machine's GPU via **WebGPU** (using `transformers.js` + ONNX Runtime Web). 

There is no cloud database, no central server, and no API key in the primary path. When you walk, Gemma generates NPC dialogues, coordinates-specific lore, and world history live and offline.

---

## 🌟 Key Features & Tech Superpowers

### 1. 100% On-Device WebGPU Inference
- **Gemma 4 E2B Inside**: Powered by `onnx-community/gemma-4-E2B-it-ONNX` (~1.5GB 4-bit quantized model).
- **WebGPU Acceleration**: Direct-to-silicon execution using WebGPU pipelines, bypassing API latency.
- **IndexedDB Pre-Caching**: Model weights are cached securely in browser storage. Subsequent launches load instantly and work completely offline (wifi disabled).
- **WebGPU Memory Guard**: Model weights are pinned to the `q4` format to prevent numerical floating-point overflows on specific device GPUs (onnxruntime #26732 protection).

### 2. Premium Architecture: Unified Inference Seam
- **Single Persistent Web Worker**: The core AI runtime lives in a dedicated background worker thread, shielding the main thread from canvas render lag or garbage collection spikes.
- **Sequential Task Queuing**: Multi-event requests (e.g. walk-based biome discovery vs NPC chat) are sequentially serialized through a token queue to guarantee race-free GPU schedules.
- **Deterministic API Fallback**: Behind an identical `InferenceEngine` interface is a 20-minute insurance fallback to **Google Gemini 2.5 Flash** (via Cloud API) for devices without WebGPU support.

### 3. Rich, Modern 8-Bit Aesthetics
- **Infinite Procedural World**: Infinite grid of rich biomes generated in real time using Fractional Brownian Motion (fBm) 2D noise.
- **Glassmorphic Retro UI**: Sleek dark mode using modern CSS glassmorphism, CRT scanline overlay filters, vignette effects, and glowing active status badges.
- **Fully Synthesized Sound Effects**: Retro 8-bit sound effects (walking clicks, speech blips, level-up fanfare) generated procedurally via the browser's **Web Audio API** — zero audio assets needed.

---

## 🎮 How to Play & Demo Script

> [!TIP]
> **"Prove Offline First" Rehearsal Script (3-Minute Demo)**
> 1. **Warm Up**: Load the page, hit `Load AI` to trigger cache and warm the GPU pipeline.
> 2. **Go Offline**: Open Chrome DevTools, go to the **Network** tab, and toggle **Offline** (or kill your physical wifi).
> 3. **Resident badge**: Reload the game. The `LOCAL · GPU` badge glows green.
> 4. **Explore**: Move around. As you discover new coordinates, the local Gemma model streams short poetic descriptions into your Journal.
> 5. **Chat**: Walk up to an NPC, press `Space` to initiate contact, and type free-form questions. The NPC responds in-character instantly while offline!

### Controls
* **W / A / S / D** or **Arrow Keys** — Move the adventurer
* **Space** — Interact / Initiate NPC chat
* **Escape** — Close NPC dialogue box
* **M** — Toggle Retro Audio Synthesis (On / Off)

---

## 🛠️ Development & Local Setup

GemmaQuest is built using modern **Vite** and standard HTML5/JS/CSS.

### Prerequisites
- Node.js (v18 or higher)
- A browser supporting WebGPU (Chrome, Edge, or Opera with active GPU support)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/fourcolors/google-io-2026.git
   cd google-io-2026
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   Open your browser to the local URL (usually `http://localhost:5173/`).

### Production Build & Deployment
To build for static hosting:
```bash
npm run build
```
This compiles the production assets into the `dist/` directory.

---

## 📁 Repository Structure

```
├── .github/workflows/deploy.yml  # Automated GitHub Pages CI/CD workflow
├── docs/superpowers/specs/       # Core game design specifications
├── public/                       # Pre-compiled local ONNX model config cache
├── src/
│   ├── game/
│   │   ├── engine.js             # Core game state, keys, collision, & loops
│   │   ├── renderer.js           # 2D canvas procedural renderer & lighting
│   │   └── tilemap.js            # FBM 2D procedural biome & NPC generation
│   ├── inference/
│   │   └── engine.js             # Local Worker / Cloud Gemini API wrappers
│   ├── workers/
│   │   └── ai.worker.js          # ONNX pipeline Web Worker
│   ├── main.js                   # Main application coordinator
│   └── style.css                 # Glassmorphic CSS design tokens
├── index.html                    # Main entry point template
├── gemmaquest.html               # Single-file standalone spec + test suite
├── package.json                  # Scripts & NPM package configuration
└── vite.config.js                # Vite relative-base build configuration
```

---

## 📋 Under the Hood: Single-File Interactive Spec & Tests
For deep inspection, explore `gemmaquest.html` directly in the live environment or locally. It is a single-file, zero-install masterpiece that bundles:
1. **The Game Engine**: Fully compiled and ready to play immediately.
2. **Interactive Specifications**: Direct reference to architectural designs and constraints.
3. **In-Browser Tests**: Executable test suites utilizing a deterministic `MockEngine` to validate logic, and live model verification pipelines once Gemma loads.

---

> Created for the Google I/O 2026 Hackathon. Built to showcase the power of on-device WebGPU generative AI.
