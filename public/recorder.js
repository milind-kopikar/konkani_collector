/**
 * Recorder Page Logic
 * Handles recording workflow: story selection → record → playback → submit → next sentence
 */

class RecorderApp {
    constructor() {
        this.storyId = null;
        this.userId = null;
        this.currentSentence = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordedBlob = null;
        this.audioStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.visualizerAnimationId = null;
        
        this.initElements();
        this.initUserId();
        this.loadStoryId();
    }
    
    initElements() {
        // UI elements
        this.loadingEl = document.getElementById('loading');
        this.recorderSection = document.getElementById('recorder-section');
        this.completionSection = document.getElementById('completion-section');
        this.errorSection = document.getElementById('error-section');
        this.errorMessage = document.getElementById('error-message');
        this.errorRetryBtn = document.getElementById('error-retry-btn');
        this.errorBackLink = document.getElementById('error-back-link');
        this.statusMessage = document.getElementById('status-message');
        
        // Sentence display
        this.storyTitleEl = document.getElementById('story-title');
        this.progressText = document.getElementById('progress-text');
        this.remainingText = document.getElementById('remaining-text');
        this.sentenceDevanagari = document.getElementById('sentence-devanagari');
        this.sentenceIast = document.getElementById('sentence-iast');
        this.recordingIndicator = document.getElementById('recording-indicator');
        
        // Buttons
        this.btnRecord = document.getElementById('btn-record');
        this.btnStop = document.getElementById('btn-stop');
        this.btnPlay = document.getElementById('btn-play');
        this.btnRerecord = document.getElementById('btn-rerecord');
        this.btnSubmit = document.getElementById('btn-submit');
        this.btnEnd = document.getElementById('btn-end');
        
        // Visualizer
        this.visualizerCanvas = document.getElementById('visualizer');
        this.visualizerCtx = this.visualizerCanvas.getContext('2d');
        
        // Event listeners
        this.btnRecord.addEventListener('click', () => this.startRecording());
        this.btnStop.addEventListener('click', () => this.stopRecording());
        this.btnPlay.addEventListener('click', () => this.playRecording());
        this.btnRerecord.addEventListener('click', () => this.rerecord());
        this.btnSubmit.addEventListener('click', () => this.submitRecording());
        this.btnEnd.addEventListener('click', () => this.endSession());
        if (this.errorRetryBtn) this.errorRetryBtn.addEventListener('click', () => this.handleErrorRetry());
    }
    
    initUserId() {
        // Get or create user session ID
        this.userId = sessionStorage.getItem('userId');
        if (!this.userId) {
            this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('userId', this.userId);
        }
    }
    
    loadStoryId() {
        this.storyId = sessionStorage.getItem('selectedStoryId');
        if (!this.storyId) {
            this.showError('No story selected. Please select a story from the home page.');
            return;
        }
        
        this.loadNextSentence();
    }
    
    async loadNextSentence() {
        try {
            this.showStatus('Loading next sentence...', 'info');
            
            const response = await fetch(`/api/sentences/${this.storyId}/next?userId=${encodeURIComponent(this.userId)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.completed) {
                this.showCompletion();
                return;
            }
            
            this.currentSentence = data;
            this.displaySentence();
            this.hideStatus();
            
        } catch (error) {
            console.error('Failed to load sentence:', error);
            this.showError('Failed to load sentence. Please try again.');
        }
    }
    
    displaySentence() {
        this.loadingEl.style.display = 'none';
        this.recorderSection.style.display = 'block';
        
        this.storyTitleEl.textContent = this.currentSentence.story_title || 'Recording';
        this.sentenceDevanagari.textContent = this.currentSentence.text_devanagari;
        this.sentenceIast.textContent = this.currentSentence.text_iast || '';
        
        const currentNum = this.currentSentence.order;
        const total = this.currentSentence.total;
        const remaining = this.currentSentence.remaining;
        
        this.progressText.textContent = `Sentence ${currentNum} of ${total}`;
        this.remainingText.textContent = `${remaining} remaining`;
        
        // Reset recording state
        this.resetRecordingState();
    }
    
    resetRecordingState() {
        this.recordedBlob = null;
        this.audioChunks = [];
        
        this.btnRecord.disabled = false;
        this.btnStop.disabled = true;
        this.btnPlay.disabled = true;
        this.btnRerecord.disabled = true;
        this.btnSubmit.disabled = true;
        this.btnSubmit.textContent = '✓ Submit & Next';
        
        this.recordingIndicator.classList.remove('active');
        this.btnRecord.classList.remove('recording');
        
        this.clearVisualizer();
    }
    
    async startRecording() {
        try {
            // Request microphone access
            this.audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            // Setup audio context for visualization
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            source.connect(this.analyser);
            
            // Start visualization
            this.visualize();
            
            // Setup MediaRecorder
            const options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'audio/webm';
            }
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = '';
            }
            
            this.mediaRecorder = new MediaRecorder(this.audioStream, options);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.onRecordingComplete();
            };
            
            // Start recording
            this.audioChunks = [];
            this.mediaRecorder.start();
            
            // Update UI
            this.btnRecord.disabled = true;
            this.btnStop.disabled = false;
            this.btnRecord.classList.add('recording');
            this.recordingIndicator.classList.add('active');
            
            this.showStatus('Recording... Speak now!', 'info');
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.showError('Failed to access microphone. Please allow microphone access and try again.');
            this.stopMediaStream();
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        this.stopMediaStream();
        
        // Update UI
        this.btnStop.disabled = true;
        this.btnRecord.classList.remove('recording');
        this.recordingIndicator.classList.remove('active');
        
        if (this.visualizerAnimationId) {
            cancelAnimationFrame(this.visualizerAnimationId);
            this.visualizerAnimationId = null;
        }
    }
    
    stopMediaStream() {
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
    
    onRecordingComplete() {
        console.debug('onRecordingComplete: audioChunks length=', this.audioChunks.length, 'blob size=', this.recordedBlob ? this.recordedBlob.size : 0);
        this.btnPlay.disabled = false;
        this.btnRerecord.disabled = false;
        this.btnSubmit.disabled = false;
        
        this.showStatus('Recording complete! You can play it back, re-record, or submit.', 'success');
    }
    
    playRecording() {
        if (!this.recordedBlob) return;
        
        const audioUrl = URL.createObjectURL(this.recordedBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            this.btnPlay.textContent = '▶️ Play';
        };
        
        this.btnPlay.textContent = '⏸️ Playing...';
        this.btnPlay.disabled = true;
        
        audio.play();
        
        audio.onended = () => {
            this.btnPlay.textContent = '▶️ Play';
            this.btnPlay.disabled = false;
        };
    }
    
    rerecord() {
        if (this.errorSection) this.errorSection.style.display = 'none';
        this.resetRecordingState();
        this.hideStatus();
    }
    
    async submitRecording() {
        console.debug('submitRecording called');
        if (!this.recordedBlob || !this.currentSentence) return;
        
        try {
            this.btnSubmit.disabled = true;
            this.btnSubmit.textContent = '⏳ Uploading...';
            console.debug('submitRecording: preparing formData');
            this.showStatus('Uploading recording...', 'info');
            
            // Create form data
            const formData = new FormData();
            formData.append('audio', this.recordedBlob, 'recording.webm');
            formData.append('sentence_id', this.currentSentence.sentence_id);
            formData.append('user_id', this.userId);
            
            // Upload
            // Debug: print FormData entries (can't directly stringify FormData)
            for (const pair of formData.entries()) {
                console.debug('FormData entry', pair[0], pair[1] instanceof Blob ? `[Blob ${pair[1].size} bytes]` : pair[1]);
            }
            console.debug('submitRecording: sending XHR to /api/recordings');
            const result = await this.uploadFormDataWithProgress(formData, ({ loaded, total }) => {
                if (total > 0) {
                    const pct = Math.round((loaded / total) * 100);
                    this.showStatus(`Uploading: ${pct}%`, 'info');
                    this.btnSubmit.textContent = `⏳ Uploading ${pct}%`;
                } else {
                    this.showStatus('Uploading... (unable to compute size)', 'info');
                }
            });
            console.debug('submitRecording: upload finished', result);
            
            if (result.status === 'warning') {
                this.showStatus('⚠️ Recording saved but failed validation', 'warning');
                console.warn('Validation errors:', result.validation && result.validation.errors);
            } else {
                this.showStatus('✓ Recording saved successfully!', 'success');
            }
            
            // Wait a moment, then load next sentence
            setTimeout(() => {
                this.loadNextSentence();
            }, 1000);
            
        } catch (error) {
            console.error('Failed to submit recording:', error);
            // Handle validation errors from server (HTTP 422)
            if (error && error.status === 422 && error.body && error.body.validation) {
                // Show user-friendly message and a single Retry button
                this.showValidationError();
                this.btnSubmit.disabled = false;
                this.btnSubmit.textContent = '✓ Submit & Next';
                return; // do not proceed to next
            }
            this.showError('Failed to upload recording. Please try again.');
            this.btnSubmit.disabled = false;
            this.btnSubmit.textContent = '✓ Submit & Next';
        }
    }

    uploadFormDataWithProgress(formData, onProgress) {
        return new Promise((resolve, reject) => {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/recordings');
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const resJson = JSON.parse(xhr.responseText);
                            resolve(resJson);
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        try {
                            const body = JSON.parse(xhr.responseText);
                            const err = new Error(body.error || `HTTP ${xhr.status}`);
                            err.status = xhr.status;
                            err.body = body;
                            reject(err);
                        } catch (e) {
                            const err = new Error(`HTTP ${xhr.status}`);
                            err.status = xhr.status;
                            reject(err);
                        }
                    }
                };
                xhr.onerror = () => reject(new Error('Network error while uploading'));
                if (xhr.upload && onProgress) {
                    xhr.upload.onprogress = (event) => {
                        onProgress({ loaded: event.loaded, total: event.total });
                    };
                }
                xhr.send(formData);
            } catch (err) {
                reject(err);
            }
        });
    }
    
    visualize() {
        if (!this.analyser) return;
        
        const canvas = this.visualizerCanvas;
        const ctx = this.visualizerCtx;
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            this.visualizerAnimationId = requestAnimationFrame(draw);
            
            this.analyser.getByteTimeDomainData(dataArray);
            
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, width, height);
            
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#16a34a';
            ctx.beginPath();
            
            const sliceWidth = width / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * height / 2;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                
                x += sliceWidth;
            }
            
            ctx.lineTo(width, height / 2);
            ctx.stroke();
        };
        
        draw();
    }
    
    clearVisualizer() {
        const canvas = this.visualizerCanvas;
        const ctx = this.visualizerCtx;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    showStatus(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = 'status-message status-' + type;
        this.statusMessage.style.display = 'block';
    }
    
    hideStatus() {
        this.statusMessage.style.display = 'none';
    }
    
    showCompletion() {
        this.recorderSection.style.display = 'none';
        this.completionSection.style.display = 'block';
    }
    
    showError(message) {
        this.loadingEl.style.display = 'none';
        this.recorderSection.style.display = 'none';
        this.errorSection.style.display = 'block';
        this.errorMessage.textContent = message;
        // Show both Retry and Back buttons for general errors
        if (this.errorBackLink) this.errorBackLink.style.display = 'inline-block';
        if (this.errorRetryBtn) this.errorRetryBtn.style.display = 'inline-block';
    }

    showValidationError() {
        const msg = 'Hmm. It seems like the recording was either too short or too long for the sentence it was meant for. Would you mind recording again?';
        this.loadingEl.style.display = 'none';
        this.recorderSection.style.display = 'none';
        this.errorSection.style.display = 'block';
        this.errorMessage.textContent = msg;
        // For validation error, show only a Retry button
        if (this.errorBackLink) this.errorBackLink.style.display = 'none';
        if (this.errorRetryBtn) this.errorRetryBtn.style.display = 'inline-block';
    }

    handleErrorRetry() {
        // Hide error and go back to recording UI with re-record state
        this.errorSection.style.display = 'none';
        this.recorderSection.style.display = 'block';
        this.rerecord();
    }
    
    endSession() {
        if (confirm('Are you sure you want to end this recording session?')) {
            window.location.href = 'index.html';
        }
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new RecorderApp();
});
