const AudioPlayerHook = {
  mounted() {
    this.audioQueue = [];
    this.isPlaying = false;
    
    if (!window.niaAudioContext) {
      window.niaAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    this.audioContext = window.niaAudioContext;

    const resumeAudio = () => {
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(e => console.error("AudioContext resume failed", e));
      }
      document.body.removeEventListener('click', resumeAudio);
      document.body.removeEventListener('keydown', resumeAudio);
    };
    document.body.addEventListener('click', resumeAudio, { once: true });
    document.body.addEventListener('keydown', resumeAudio, { once: true });

    this.handleEvent("play_audio", ({ data }) => {
      let bufferToDecode;
      if (data instanceof ArrayBuffer) {
        bufferToDecode = data;
      } else if (data && data.buffer instanceof ArrayBuffer) {
        bufferToDecode = data.buffer;
      } else {
        console.error("Received data is not an ArrayBuffer:", data);
        return;
      }
      this.playAudioChunk(bufferToDecode);
    });
  },

  playAudioChunk(arrayBuffer) {
    this.audioQueue.push(arrayBuffer);
    if (!this.isPlaying) {
      this.processQueue();
    }
  },

  async processQueue() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const arrayBuffer = this.audioQueue.shift();

    if (this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.error("AudioContext resume failed during queue processing:", e);
        this.isPlaying = false; 
        return;
      }
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
      source.onended = () => {
        this.processQueue(); 
      };
    } catch (e) {
      console.error("Error decoding audio data", e);
      this.isPlaying = false; 
      if (this.audioQueue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }
};

export default AudioPlayerHook;
