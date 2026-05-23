// ==========================================================================
// GemmaQuest Inference Seam: Local WebGPU Worker & Cloud Fallback Engines
// ==========================================================================

export class InferenceEngine {
  async load(modelId, onStatus, onProgress) {
    throw new Error('Load method not implemented');
  }

  async generate(systemPrompt, userPrompt, maxTokens, temperature, onToken) {
    throw new Error('Generate method not implemented');
  }
}

// --------------------------------------------------------------------------
// LocalWorkerEngine: Single persistent worker, sequential GPU task queue
// --------------------------------------------------------------------------
export class LocalWorkerEngine extends InferenceEngine {
  constructor() {
    super();
    this.worker = null;
    this.queue = [];
    this.isGenerating = false;
    this.currentTask = null;
    this.isLoaded = false;
    this.onStatusCallback = null;
    this.onProgressCallback = null;
    this.loadResolve = null;
    this.loadReject = null;
  }

  async load(modelId, onStatus, onProgress) {
    if (this.isLoaded) {
      onStatus?.({ status: 'ready', message: 'AI Ready (Cached)' });
      return { device: this.device || 'webgpu', modelId };
    }

    this.onStatusCallback = onStatus;
    this.onProgressCallback = onProgress;

    // Lazily spawn the persistent Web Worker if it doesn't exist
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/ai.worker.js', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (event) => {
        const { type, status, message, file, progress, token, text, error, device } = event.data;

        switch (type) {
          case 'status':
            this.onStatusCallback?.({ status, message });
            break;

          case 'progress':
            this.onProgressCallback?.({ file, progress });
            break;

          case 'ready':
            this.isLoaded = true;
            this.device = device;
            this.onStatusCallback?.({ status: 'ready', message: `AI Ready (${device.toUpperCase()})` });
            if (this.loadResolve) {
              this.loadResolve({ device, modelId });
            }
            break;

          case 'error':
            if (this.isGenerating && this.currentTask) {
              this.currentTask.reject(new Error(error));
              this._finalizeTask();
            } else if (this.loadReject) {
              this.loadReject(new Error(error));
            } else {
              this.onStatusCallback?.({ status: 'error', message: `AI Error: ${error}` });
            }
            break;

          case 'token':
            if (this.isGenerating && this.currentTask) {
              this.currentTask.onToken?.(token);
            }
            break;

          case 'complete':
            if (this.isGenerating && this.currentTask) {
              this.currentTask.resolve(text);
              this._finalizeTask();
            }
            break;
        }
      };
    }

    return new Promise((resolve, reject) => {
      this.loadResolve = resolve;
      this.loadReject = reject;
      
      this.worker.postMessage({
        type: 'load',
        modelId
      });
    });
  }

  async generate(systemPrompt, userPrompt, maxTokens, temperature, onToken) {
    if (!this.worker) {
      throw new Error('AI Model has not been initialized. Please load the model first.');
    }

    return new Promise((resolve, reject) => {
      const task = {
        systemPrompt,
        userPrompt,
        maxTokens,
        temperature,
        onToken,
        resolve,
        reject
      };
      this.queue.push(task);
      this._processQueue();
    });
  }

  _processQueue() {
    if (this.isGenerating || this.queue.length === 0) return;

    this.isGenerating = true;
    this.currentTask = this.queue.shift();

    this.worker.postMessage({
      type: 'generate',
      systemPrompt: this.currentTask.systemPrompt,
      userPrompt: this.currentTask.userPrompt,
      maxTokens: this.currentTask.maxTokens,
      temperature: this.currentTask.temperature
    });
  }

  _finalizeTask() {
    this.isGenerating = false;
    this.currentTask = null;
    this._processQueue();
  }
}

// --------------------------------------------------------------------------
// ApiEngine: Direct REST client for Google Gemini 2.5 Flash API with stream deltas
// --------------------------------------------------------------------------
export class ApiEngine extends InferenceEngine {
  constructor() {
    super();
    this.apiKey = localStorage.getItem('GEMMAQUEST_API_KEY') || '';
  }

  setApiKey(key) {
    this.apiKey = key;
    localStorage.setItem('GEMMAQUEST_API_KEY', key);
  }

  async load(modelId, onStatus, onProgress) {
    onStatus?.({ status: 'ready', message: 'Cloud AI Enabled' });
    return { device: 'cloud', modelId: 'gemini-2.5-flash' };
  }

  async generate(systemPrompt, userPrompt, maxTokens, temperature, onToken) {
    if (!this.apiKey) {
      throw new Error('Gemini API Key is missing. Please add an API Key in the game settings to proceed in Cloud mode.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${this.apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt ? `[System Directive: ${systemPrompt}]\n\n` : ''}${userPrompt}` }]
        }
      ],
      generationConfig: {
        maxOutputTokens: maxTokens || 60,
        temperature: temperature || 0.7
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let parsedError = errorText;
      try {
        const parsed = JSON.parse(errorText);
        parsedError = parsed.error?.message || errorText;
      } catch (e) {}
      throw new Error(`Gemini API Request Failed: ${parsedError}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let emittedLength = 0;
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Scan buffer incrementally for "text" : "content" fields
      let tempText = '';
      const textRegex = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
      let match;
      while ((match = textRegex.exec(buffer)) !== null) {
        try {
          // Parse as complete JSON string literal to solve escape sequences (e.g. \n, \", etc.)
          tempText += JSON.parse(`"${match[1]}"`);
        } catch (e) {
          tempText += match[1];
        }
      }

      if (tempText.length > emittedLength) {
        const delta = tempText.slice(emittedLength);
        onToken?.(delta);
        emittedLength = tempText.length;
        fullText = tempText;
      }
    }

    return fullText;
  }
}
