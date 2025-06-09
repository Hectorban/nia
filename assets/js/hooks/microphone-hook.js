const MicrophoneHook = {
  mounted() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.uploadId = this.el.dataset.uploadId;

    this.el.addEventListener("mousedown", (event) => {
      event.preventDefault();
      if (this.el.disabled) return;
      this.startRecording();
      this.el.classList.add("ring-4", "ring-red-500");
    });

    this.el.addEventListener("mouseup", (event) => {
      event.preventDefault();
      if (this.el.disabled || !this.isRecording()) return;
      this.stopRecording();
      this.el.classList.remove("ring-4", "ring-red-500");
    });

    this.el.addEventListener("mouseleave", (event) => {
      if (this.el.disabled || !this.isRecording()) return;
      this.stopRecording();
      this.el.classList.remove("ring-4", "ring-red-500");
    });
  },

  startRecording() {
    this.audioChunks = [];
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        });
        this.mediaRecorder.start();
      })
      .catch(err => {
        console.error("Error accessing microphone:", err);
      });
  },

  stopRecording() {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.addEventListener("stop", () => {
      if (this.audioChunks.length === 0) return;

      const mimeType = this.mediaRecorder.mimeType || 'audio/wav';
      const audioBlob = new Blob(this.audioChunks, { type: mimeType });
      
      const uploaderElement = document.querySelector(`input[type="file"][name="${this.uploadId}"]`);

      if (uploaderElement && uploaderElement.__uploader) {
        const fileName = `audio_capture_${Date.now()}.${mimeType.split('/')[1] || 'wav'}`;
        uploaderElement.__uploader.addFiles([new File([audioBlob], fileName, { type: mimeType })]);
      } else {
        console.error("Could not find LiveView uploader instance for ref:", this.uploadId);
      }

      if (this.mediaRecorder && this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
      this.mediaRecorder = null;
    });
    this.mediaRecorder.stop();
  },

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === "recording";
  },

  destroyed() {
    if (this.isRecording()) {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }
  }
};

export default MicrophoneHook;
