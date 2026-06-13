import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { SnackbarService } from './snackbar.service';

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  isSpeaking = false;
  isPaused = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  isListening = false;
  private voiceRecognition: any = null;
  private voiceTimeout: any = null;

  voiceResult$ = new Subject<string>();

  constructor(private ngZone: NgZone, private snackbar: SnackbarService) {}

  speak(textToSpeak: string, isHindi: boolean) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = isHindi ? 'hi-IN' : 'en-IN';

      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find(v => v.lang.startsWith(isHindi ? 'hi' : 'en'));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onend = () => {
        this.ngZone.run(() => {
          this.isSpeaking = false;
          this.isPaused = false;
          this.currentUtterance = null;
        });
      };

      utterance.onerror = (e) => {
        console.error('Speech error:', e);
        this.ngZone.run(() => {
          this.isSpeaking = false;
          this.isPaused = false;
          this.currentUtterance = null;
        });
      };

      this.currentUtterance = utterance;
      this.isSpeaking = true;
      this.isPaused = false;
      window.speechSynthesis.speak(utterance);
    } else {
      this.snackbar.show('Text-to-speech is not supported in this browser.', 'warning');
    }
  }

  pause() {
    if (this.isSpeaking && !this.isPaused) {
      window.speechSynthesis.pause();
      this.isPaused = true;
    }
  }

  resume() {
    if (this.isSpeaking && this.isPaused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
    }
  }

  stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentUtterance = null;
  }

  startVoiceSearch() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.snackbar.show('Voice search is not supported in this browser.', 'warning');
      return;
    }
    if (this.isListening) {
      this.stopVoiceSearch();
      return;
    }

    if (this.voiceTimeout) {
      clearTimeout(this.voiceTimeout);
    }

    this.voiceRecognition = new SpeechRecognition();
    this.voiceRecognition.lang = 'en-IN';
    this.voiceRecognition.interimResults = false;
    this.voiceRecognition.maxAlternatives = 1;

    this.isListening = true;
    this.snackbar.show('Listening... Speak now.', 'info');

    this.voiceTimeout = setTimeout(() => {
      this.ngZone.run(() => {
        if (this.isListening) {
          this.stopVoiceSearch();
          this.snackbar.show('Voice search timed out.', 'info');
        }
      });
    }, 8000);

    this.voiceRecognition.onresult = (event: any) => {
      if (this.voiceTimeout) {
        clearTimeout(this.voiceTimeout);
        this.voiceTimeout = null;
      }
      const result = event.results[0][0].transcript;
      if (result) {
        this.ngZone.run(() => {
          this.voiceResult$.next(result);
          this.snackbar.show(`Voice search: "${result}"`, 'success');
        });
      }
    };

    this.voiceRecognition.onerror = (err: any) => {
      console.error('Speech recognition error', err);
      if (this.voiceTimeout) {
        clearTimeout(this.voiceTimeout);
        this.voiceTimeout = null;
      }
      this.ngZone.run(() => {
        this.isListening = false;
      });
    };

    this.voiceRecognition.onend = () => {
      if (this.voiceTimeout) {
        clearTimeout(this.voiceTimeout);
        this.voiceTimeout = null;
      }
      this.ngZone.run(() => {
        this.isListening = false;
        this.voiceRecognition = null;
      });
    };

    this.voiceRecognition.start();
  }

  stopVoiceSearch() {
    if (this.voiceTimeout) {
      clearTimeout(this.voiceTimeout);
      this.voiceTimeout = null;
    }
    if (this.voiceRecognition) {
      try {
        this.voiceRecognition.stop();
      } catch (e) {
        console.error('Error stopping voice search:', e);
      }
      this.isListening = false;
      this.voiceRecognition = null;
      this.snackbar.show('Voice search stopped.', 'info');
    }
  }
}
