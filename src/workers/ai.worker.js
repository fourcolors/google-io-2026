import { pipeline, env, TextStreamer } from '@huggingface/transformers';

// Configure environment
// Disable web worker proxying since we are ALREADY running in a web worker
env.backends.onnx.wasm.proxy = false;

let pipelineInstance = null;
let currentModelId = null;

// Surface any silent failure (unhandled rejection, ORT crash, WebGPU shader compile error)
// to the main thread instead of leaving the badge stuck on LOADING forever.
self.addEventListener("unhandledrejection", (e) => {
  const msg = (e && e.reason && (e.reason.message || e.reason.toString())) || "Unhandled worker rejection";
  self.postMessage({ type: "error", error: "Worker rejection: " + msg });
});
self.addEventListener("error", (e) => {
  self.postMessage({ type: "error", error: "Worker error: " + (e.message || "unknown") });
});

// Listen for messages from the main thread
self.onmessage = async (event) => {
  const { type, modelId, systemPrompt, userPrompt, maxTokens, temperature } = event.data;

  if (type === 'load') {
    try {
      if (pipelineInstance && currentModelId === modelId) {
        self.postMessage({ type: 'ready', modelId, cached: true });
        return;
      }

      self.postMessage({ type: 'status', status: 'initializing', message: 'Checking GPU capabilities...' });

      // Check for WebGPU support
      const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
      const device = hasWebGPU ? 'webgpu' : 'wasm';
      self.__device = device;
      
      self.postMessage({ 
        type: 'status', 
        status: 'loading', 
        message: `Loading model on ${device.toUpperCase()}...`, 
        device 
      });

      // Load pipeline with progress callbacks
      // Pinned to 'q4' (4-bit integer weights, 32-bit activations) to bypass WebGPU FP16 numeric overflow 
      // issues on certain platforms/GPUs (ONNX Runtime issue #26732).
      console.log(`[AI Worker] Pinning dtype to 'q4' for device: ${device}`);
      pipelineInstance = await pipeline('text-generation', modelId, {
        device: device,
        dtype: 'q4', 
        progress_callback: (data) => {
          if (data.status === 'downloading') {
            self.postMessage({
              type: 'progress',
              file: data.file,
              progress: data.progress || 0,
              loaded: data.loaded,
              total: data.total
            });
          } else if (data.status === 'initiate') {
            self.postMessage({
              type: 'status',
              status: 'downloading',
              message: `Downloading ${data.file.split('/').pop()}...`
            });
          } else if (data.status === 'done') {
            // Last file finished streaming; ONNX session compile is next and emits no callbacks.
            self.postMessage({
              type: 'status',
              status: 'compiling',
              message: `Compiling for ${(self.__device || 'webgpu').toUpperCase()}...`,
              device: self.__device
            });
          }
        }
      });

      currentModelId = modelId;
      self.postMessage({ type: 'ready', modelId, device });
      
    } catch (error) {
      console.error('AI Worker Load Error:', error);
      self.postMessage({ type: 'error', error: error.message || 'Unknown error occurred while loading the model.' });
    }
  }

  else if (type === 'generate') {
    if (!pipelineInstance) {
      self.postMessage({ type: 'error', error: 'AI Model not initialized. Please load the model first.' });
      return;
    }

    try {
      // Prepare Chat template
      const chat = [
        { 
          role: 'user', 
          content: `${systemPrompt ? `[System Directive: ${systemPrompt}]\n\n` : ''}${userPrompt}` 
        }
      ];

      // Format input text using model's chat template
      const formattedInput = pipelineInstance.tokenizer.apply_chat_template(chat, {
        tokenize: false,
        add_generation_prompt: true
      });

      // Create a streamer callback to emit tokens in real-time
      const streamer = new TextStreamer(pipelineInstance.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text) => {
          self.postMessage({ type: 'token', token: text });
        }
      });

      // Run generator
      const output = await pipelineInstance(formattedInput, {
        max_new_tokens: maxTokens || 60,
        temperature: temperature || 0.7,
        do_sample: true,
        streamer: streamer
      });

      // Send complete signal with full output text
      const fullText = output[0]?.generated_text || '';
      self.postMessage({ type: 'complete', text: fullText });

    } catch (error) {
      console.error('AI Worker Generation Error:', error);
      self.postMessage({ type: 'error', error: error.message || 'Generation failed.' });
    }
  }
};
