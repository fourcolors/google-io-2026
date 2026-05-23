// ==========================================================================
// GemmaQuest Entry Point - Orchestrating Game Loop, UI, Engines & Audio Synth
// ==========================================================================

import { GameEngine } from './game/engine.js';
import { GameRenderer } from './game/renderer.js';
import { LocalWorkerEngine, ApiEngine } from './inference/engine.js';

// --- Web Audio API retro 8-bit sound generator ---
let audioCtx = null;
let isMuted = false;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 8-Bit Walking Sound
function playWalkSound() {
  if (isMuted || !audioCtx) return;
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(90, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.08);
  
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

// 8-Bit Dialogue blip
function playTextBlip() {
  if (isMuted || !audioCtx) return;
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'square';
  osc.frequency.setValueAtTime(500 + Math.random() * 200, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.04);
}

// 8-Bit Ascending Fanfare
function playFanfareSound() {
  if (isMuted || !audioCtx) return;
  initAudio();
  const notes = [261.63, 329.63, 392.00, 523.25]; // C, E, G, C (Ascending chord)
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.07);
    
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime + i * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.07 + 0.12);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(audioCtx.currentTime + i * 0.07);
    osc.stop(audioCtx.currentTime + i * 0.07 + 0.12);
  });
}

// --- Initialize Unified Inference Engines ---
const localEngine = new LocalWorkerEngine();
const apiEngine = new ApiEngine();
let activeEngine = localEngine;

// UI State & Elements
const ui = {
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  modelSelect: document.getElementById('modelSelect'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  loadModelBtn: document.getElementById('loadModelBtn'),
  gpuBadge: document.getElementById('gpuBadge'),
  loaderPanel: document.getElementById('loaderPanel'),
  progressContainer: document.getElementById('progressContainer'),
  progressBar: document.getElementById('progressBar'),
  progressLabel: document.getElementById('progressLabel'),
  startGameBtn: document.getElementById('startGameBtn'),
  loreLogPanel: document.getElementById('loreLogPanel'),
  loreEntries: document.getElementById('loreEntries'),
  dialogPanel: document.getElementById('dialogPanel'),
  npcPortraitCanvas: document.getElementById('npcPortraitCanvas'),
  npcName: document.getElementById('npcName'),
  npcTitle: document.getElementById('npcTitle'),
  chatHistory: document.getElementById('chatHistory'),
  npcDialogueText: document.getElementById('npcDialogueText'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  sendChatBtn: document.getElementById('sendChatBtn'),
  closeDialogBtn: document.getElementById('closeDialogBtn'),
  audioIndicator: document.getElementById('audioIndicator')
};

let engine = null;
let renderer = null;
let isAIReady = false;
let isGenerating = false;
let activeNPCHistory = [];
let accumulatedResponseText = '';

// Toggle sound
function toggleMute() {
  isMuted = !isMuted;
  if (isMuted) {
    ui.audioIndicator.innerHTML = '🔇 Sound OFF';
    ui.audioIndicator.classList.add('muted');
  } else {
    initAudio();
    ui.audioIndicator.innerHTML = '🔊 Sound ON';
    ui.audioIndicator.classList.remove('muted');
  }
}
ui.audioIndicator.addEventListener('click', toggleMute);
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm') {
    toggleMute();
  }
});

// Dynamic UI events for Cloud key input toggling
ui.modelSelect.addEventListener('change', () => {
  if (ui.modelSelect.value === 'cloud-gemini') {
    ui.apiKeyInput.classList.remove('hidden');
    ui.apiKeyInput.value = localStorage.getItem('GEMMAQUEST_API_KEY') || '';
  } else {
    ui.apiKeyInput.classList.add('hidden');
  }
});

// Pre-populate stored key if cloud fallback was active
if (ui.modelSelect.value === 'cloud-gemini') {
  ui.apiKeyInput.classList.remove('hidden');
  ui.apiKeyInput.value = localStorage.getItem('GEMMAQUEST_API_KEY') || '';
}

// --- Load Model Request ---
function loadAIModel() {
  const selectedModel = ui.modelSelect.value;
  ui.progressContainer.classList.remove('hidden');
  ui.progressBar.style.width = '0%';
  ui.progressLabel.innerText = 'Initializing WebGPU / API...';
  
  ui.statusDot.className = 'indicator-dot loading';
  ui.statusText.innerText = 'AI Status: Initializing...';

  if (selectedModel === 'cloud-gemini') {
    const key = ui.apiKeyInput.value.trim();
    if (!key) {
      alert('Please enter a Google Gemini API Key to use Cloud fallback.');
      ui.statusDot.className = 'indicator-dot idle';
      ui.statusText.innerText = 'AI Error';
      ui.progressContainer.classList.add('hidden');
      return;
    }
    apiEngine.setApiKey(key);
    activeEngine = apiEngine;
  } else {
    activeEngine = localEngine;
  }

  activeEngine.load(
    selectedModel,
    ({ status, message }) => {
      ui.statusText.innerText = `AI Status: ${message}`;
      if (status === 'loading' || status === 'downloading') {
        ui.statusDot.className = 'indicator-dot loading';
      }
    },
    ({ file, progress }) => {
      ui.progressContainer.classList.remove('hidden');
      const roundedProgress = Math.round(progress);
      ui.progressBar.style.width = `${roundedProgress}%`;
      ui.progressLabel.innerText = `Downloading ${file.split('/').pop()}: ${roundedProgress}%`;
    }
  ).then(({ device, modelId }) => {
    isAIReady = true;
    ui.statusDot.className = 'indicator-dot active';
    ui.statusText.innerText = `AI Ready (${device.toUpperCase()})`;
    ui.progressContainer.classList.add('hidden');
    ui.loadModelBtn.innerText = 'Loaded';
    ui.loadModelBtn.disabled = true;
    ui.modelSelect.disabled = true;
    ui.apiKeyInput.disabled = true;
    
    // Toggle LOCAL · GPU Badge based on the physical engine device
    if (device === 'webgpu') {
      ui.gpuBadge.classList.remove('hidden');
    } else {
      ui.gpuBadge.classList.add('hidden');
    }

    // Allow Chat interactions
    ui.chatInput.disabled = false;
    ui.sendChatBtn.disabled = false;
    
    console.log(`Model ${modelId} ready on ${device}`);
  }).catch((error) => {
    isAIReady = false;
    isGenerating = false;
    ui.statusDot.className = 'indicator-dot idle';
    ui.statusText.innerText = 'AI Error';
    alert(`Model loading error: ${error.message || error}\n\nFalling back to procedural mode.`);
    ui.progressContainer.classList.add('hidden');
  });
}

ui.loadModelBtn.addEventListener('click', loadAIModel);

// --- Biome Discovery Lore Trigger ---
function generateBiomeLore(gridX, gridY, biome) {
  // Add direct entry immediately in offline mode
  const entry = document.createElement('div');
  entry.className = 'lore-entry biome-entry';
  entry.innerHTML = `
    <span class="entry-coord">[X: ${gridX}, Y: ${gridY}]</span>
    <h4 class="pixel-font" style="color:var(--accent-cyan)">${biome.name}</h4>
    <p id="lore-${gridX}-${gridY}">Scanning coordinates...</p>
  `;
  ui.loreEntries.insertBefore(entry, ui.loreEntries.firstChild);

  // If AI is ready, overwrite with high-quality generated lore!
  if (isAIReady) {
    const prompt = `Write a brief, mysterious sentence describing the land at X:${gridX}, Y:${gridY}. It is a ${biome.name}.`;
    const system = "You are an ancient mystical fantasy chronicler. Write a single poetic sentence under 20 words describing the coordinates and the biome. Keep it very short, mysterious, and atmospheric.";
    
    const loreEl = document.getElementById(`lore-${gridX}-${gridY}`);
    if (loreEl) {
      loreEl.innerText = '';
    }

    activeEngine.generate(system, prompt, 30, 0.7, (token) => {
      const liveLoreEl = document.getElementById(`lore-${gridX}-${gridY}`);
      if (liveLoreEl) {
        liveLoreEl.innerText += token;
        playTextBlip();
      }
    }).then((fullText) => {
      const finalLoreEl = document.getElementById(`lore-${gridX}-${gridY}`);
      if (finalLoreEl) {
        finalLoreEl.innerText = fullText.trim();
      }
    }).catch((err) => {
      console.error('Biome lore generation failed:', err);
      const fallbackLoreEl = document.getElementById(`lore-${gridX}-${gridY}`);
      if (fallbackLoreEl) {
        fallbackLoreEl.innerText = biome.lore;
      }
    });
  } else {
    // If AI is not ready, write procedural default lore immediately
    const el = document.getElementById(`lore-${gridX}-${gridY}`);
    if (el) {
      el.innerText = biome.lore;
    }
  }
}

// --- NPC Dialogue Dialog Trigger ---
function initiateNPCDialogue(npc) {
  playFanfareSound();
  ui.dialogPanel.classList.remove('hidden');
  ui.npcName.innerText = npc.name;
  ui.npcTitle.innerText = npc.title;
  
  // Clear old chat logs
  ui.chatHistory.innerHTML = '';
  activeNPCHistory = [];

  // Draw procedural portrait
  drawNPCPortrait(npc);

  // introductory dialogue bubble
  const bubble = document.createElement('div');
  // Add 'thinking' class for premium pulsing until the first token streams!
  bubble.className = 'chat-bubble npc-bubble thinking';
  bubble.innerHTML = `<p id="npcDialogueText">...</p>`;
  ui.chatHistory.appendChild(bubble);

  // Generate customized greeting from Gemma
  if (isAIReady) {
    isGenerating = true;
    accumulatedResponseText = '';
    ui.statusDot.className = 'indicator-dot loading';
    ui.statusText.innerText = 'AI Status: Thinking...';

    const system = `You are ${npc.name}, a wise, enigmatic ${npc.title} located in the ${npc.tileType}. Backstory: ${npc.backstory}. You speak retro-fantasy English. Keep answers under 25 words.`;
    const prompt = `Introduce yourself to the adventurer who just walked up to you.`;

    let isFirstToken = true;

    ui.chatInput.disabled = true;
    ui.chatInput.placeholder = `Summoning ${npc.name}'s thoughts...`;
    ui.sendChatBtn.disabled = true;

    activeEngine.generate(system, prompt, 40, 0.7, (token) => {
      if (isFirstToken) {
        bubble.classList.remove('thinking');
        isFirstToken = false;
      }
      accumulatedResponseText += token;
      const dialogueTextEl = document.getElementById('npcDialogueText');
      if (dialogueTextEl) {
        dialogueTextEl.innerText = accumulatedResponseText;
        ui.chatHistory.scrollTop = ui.chatHistory.scrollHeight;
        playTextBlip();
      }
    }).then((fullText) => {
      isGenerating = false;
      ui.statusDot.className = 'indicator-dot active';
      ui.statusText.innerText = 'AI Ready';
      ui.chatInput.disabled = false;
      ui.chatInput.placeholder = "Ask the NPC anything...";
      ui.sendChatBtn.disabled = false;
      ui.chatInput.focus();
      
      activeNPCHistory.push({ role: 'assistant', content: fullText });
    }).catch((err) => {
      isGenerating = false;
      bubble.classList.remove('thinking');
      ui.statusDot.className = 'indicator-dot active';
      ui.statusText.innerText = 'AI Ready';
      ui.chatInput.disabled = false;
      ui.chatInput.placeholder = "Ask the NPC anything...";
      ui.sendChatBtn.disabled = false;
      ui.chatInput.focus();
      document.getElementById('npcDialogueText').innerText = `Greetings, traveler. I am ${npc.name}, the ${npc.title}. I seek relics in this grid.`;
    });
  } else {
    // Offline / Fallback greeting
    bubble.classList.remove('thinking');
    document.getElementById('npcDialogueText').innerText = `Greetings, traveler. I am ${npc.name}, the ${npc.title}. I seek relics in this grid at [${npc.gridX}, ${npc.gridY}]. (Enable WebGPU AI to chat freely!)`;
  }
}

// Submit Chat Question to NPC
ui.chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!isAIReady || isGenerating || !engine.activeNPC) return;

  const query = ui.chatInput.value.trim();
  if (!query) return;

  ui.chatInput.value = '';
  ui.chatInput.disabled = true;
  ui.chatInput.placeholder = `${engine.activeNPC.name} is thinking...`;
  ui.sendChatBtn.disabled = true;

  // Add player message bubble
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble user-bubble';
  userBubble.innerHTML = `<p>${query}</p>`;
  ui.chatHistory.appendChild(userBubble);
  ui.chatHistory.scrollTop = ui.chatHistory.scrollHeight;

  // Create NPC response bubble (pulsing with thinking glow until loaded)
  const npcBubble = document.createElement('div');
  npcBubble.className = 'chat-bubble npc-bubble thinking';
  npcBubble.innerHTML = `<p id="npcDialogueText">...</p>`;
  ui.chatHistory.appendChild(npcBubble);
  ui.chatHistory.scrollTop = ui.chatHistory.scrollHeight;

  // AI Inference Post
  isGenerating = true;
  accumulatedResponseText = '';
  ui.statusDot.className = 'indicator-dot loading';
  ui.statusText.innerText = 'AI Status: Thinking...';

  // Construct chat history context for the LLM
  let historyContext = '';
  activeNPCHistory.slice(-4).forEach(h => {
    historyContext += `${h.role === 'user' ? 'Adventurer' : engine.activeNPC.name}: ${h.content}\n`;
  });

  const npc = engine.activeNPC;
  const system = `You are ${npc.name}, a wise, enigmatic ${npc.title} located in the ${npc.tileType}. Backstory: ${npc.backstory}. Speak in retro-fantasy RPG dialog style. Keep answers under 30 words.`;
  const prompt = `${historyContext}Adventurer: ${query}\n${npc.name}:`;

  activeNPCHistory.push({ role: 'user', content: query });

  let isFirstToken = true;

  activeEngine.generate(system, prompt, 50, 0.7, (token) => {
    if (isFirstToken) {
      npcBubble.classList.remove('thinking');
      isFirstToken = false;
    }
    accumulatedResponseText += token;
    const dialogueTextEl = document.getElementById('npcDialogueText');
    if (dialogueTextEl) {
      dialogueTextEl.innerText = accumulatedResponseText;
      ui.chatHistory.scrollTop = ui.chatHistory.scrollHeight;
      playTextBlip();
    }
  }).then((fullText) => {
    isGenerating = false;
    ui.statusDot.className = 'indicator-dot active';
    ui.statusText.innerText = 'AI Ready';
    ui.chatInput.disabled = false;
    ui.chatInput.placeholder = 'Ask the NPC anything...';
    ui.sendChatBtn.disabled = false;
    ui.chatInput.focus();
    
    // Add model's reply to history
    activeNPCHistory.push({ role: 'assistant', content: fullText });
  }).catch((err) => {
    isGenerating = false;
    npcBubble.classList.remove('thinking');
    ui.statusDot.className = 'indicator-dot active';
    ui.statusText.innerText = 'AI Ready';
    ui.chatInput.disabled = false;
    ui.chatInput.placeholder = 'Ask the NPC anything...';
    ui.sendChatBtn.disabled = false;
    ui.chatInput.focus();
    document.getElementById('npcDialogueText').innerText = `Forgive me, my mind wanders. The energies of this place block my thoughts...`;
  });
});

// Close dialogue box
ui.closeDialogBtn.addEventListener('click', () => {
  if (engine) {
    engine.closeDialog();
  }
});

// Draw 16x16 pixelated avatar procedurally on chat header
function drawNPCPortrait(npc) {
  const ctx = ui.npcPortraitCanvas.getContext('2d');
  ctx.fillStyle = '#0f0c1b';
  ctx.fillRect(0, 0, 48, 48);

  ctx.imageSmoothingEnabled = false;

  // Draw scaled custom face
  ctx.fillStyle = '#ebe5fc'; // skin
  ctx.fillRect(8, 12, 32, 28);
  
  // Hair / Accents based on skin color
  const colors = ['#b83030', '#305cb8', '#30b88d', '#d99723'];
  ctx.fillStyle = colors[npc.skinColor % colors.length];
  ctx.fillRect(8, 4, 32, 12);
  
  // Eyes
  ctx.fillStyle = '#000000';
  ctx.fillRect(14, 20, 6, 6);
  ctx.fillRect(28, 20, 6, 6);
}

// --- Start Game Logic ---
ui.startGameBtn.addEventListener('click', () => {
  initAudio();
  ui.loaderPanel.classList.add('hidden');
  ui.loreLogPanel.classList.remove('hidden');
  
  // Setup Game loop
  const canvas = document.getElementById('gameCanvas');
  renderer = new GameRenderer(canvas);
  
  // Adjust sizing
  function resizeGame() {
    renderer.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resizeGame);
  resizeGame();

  // Initialize engine
  engine = new GameEngine(renderer, (event, data) => {
    if (event === 'biome_discover') {
      generateBiomeLore(data.gridX, data.gridY, data.biome);
    } else if (event === 'npc_talk') {
      initiateNPCDialogue(data);
    } else if (event === 'walk') {
      playWalkSound();
    } else if (event === 'dialog_close') {
      ui.dialogPanel.classList.add('hidden');
      ui.chatInput.blur();
    }
  });

  // Warmup first biome detection
  engine.checkBiomeChange();

  // Tick Game Loop
  function tick() {
    engine.update();
    renderer.render(engine.camera, engine.player, engine.getNPCList());
    requestAnimationFrame(tick);
  }
  
  requestAnimationFrame(tick);
});
