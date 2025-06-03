const MicrophoneHook = {
    mounted() {
        this.mediaRecorder = null;

        this.el.addEventListener("mousedown", (event) => {
            this.startRecording();
        });

        this.el.addEventListener("mouseup", (event) => {
            this.stopRecording();
        });
    },

    startRecording() {
        this.audioChunks = [];

        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            this.mediaRecorder = new MediaRecorder(stream);

            this.mediaRecorder.addEventListener("dataavailable", (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            });

            this.mediaRecorder.start();
        });
    },

    stopRecording() {
        if (this) {
            this.mediaRecorder.addEventListener("stop", (event) => {
                if (this.audioChunks.length === 0) return;

                const audioBlob = new Blob(this.audioChunks);

                audioBlob.arrayBuffer().then((buffer) => {
                    this.upload("audio", [new Blob([buffer])]);
                });
            });

            this.mediaRecorder.stop();
        }
    },

    isRecording() {
        return this.mediaRecorder && this.mediaRecorder.state === "recording";
    },
};

export default MicrophoneHook;