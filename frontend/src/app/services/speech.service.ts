import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { SnackbarService } from './snackbar.service';

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  isSpeaking = false;
  isPaused = false;
  activeSpeakerId: string | null = null;
  activeSpeakerId$ = new Subject<string | null>();
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  
  sentences: string[] = [];
  activeSentenceIndex = -1;
  activeSentenceIndex$ = new Subject<number>();
  private isHindi = false;

  isListening = false;
  isListening$ = new Subject<boolean>();

  private setListeningState(state: boolean) {
    this.isListening = state;
    this.isListening$.next(state);
  }

  private voiceRecognition: any = null;
  private voiceTimeout: any = null;

  voiceResult$ = new Subject<string>();

  constructor(private ngZone: NgZone, private snackbar: SnackbarService) {}

  speak(textToSpeak: string, isHindi: boolean, speakerId?: string) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      this.activeSpeakerId = speakerId || null;
      this.activeSpeakerId$.next(this.activeSpeakerId);
      this.isHindi = isHindi;
      const regex = isHindi ? /(?<=[।!?\.])\s+/ : /(?<=[.!?])\s+/;
      this.sentences = textToSpeak.split(regex).filter(s => s.trim().length > 0);
      this.activeSentenceIndex = 0;
      this.isSpeaking = true;
      this.isPaused = false;

      this.speakSentence(this.activeSpeakerId);
    } else {
      this.snackbar.show('Text-to-speech is not supported in this browser.', 'warning');
    }
  }

  private speakSentence(speakerId: string | null) {
    if (this.activeSentenceIndex < 0 || this.activeSentenceIndex >= this.sentences.length) {
      this.stop();
      return;
    }

    this.activeSentenceIndex$.next(this.activeSentenceIndex);

    const sentenceText = this.sentences[this.activeSentenceIndex];
    const utterance = new SpeechSynthesisUtterance(sentenceText);
    utterance.lang = this.isHindi ? 'hi-IN' : 'en-IN';

    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(this.isHindi ? 'hi' : 'en'));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => {
      this.ngZone.run(() => {
        if (this.activeSpeakerId !== speakerId) {
          return; // Ignore callbacks from interrupted speakers
        }
        if (this.isSpeaking && !this.isPaused) {
          this.activeSentenceIndex++;
          this.speakSentence(speakerId);
        }
      });
    };

    utterance.onerror = (e) => {
      this.ngZone.run(() => {
        if (this.activeSpeakerId !== speakerId) {
          return; // Ignore callbacks from interrupted speakers
        }
        if (e.error !== 'interrupted') {
          console.error('Speech error:', e);
        }
        this.stop();
      });
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
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
      // Re-trigger the active sentence if it didn't continue properly
      window.speechSynthesis.resume();
    }
  }

  stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.isPaused = false;
    this.activeSpeakerId = null;
    this.activeSpeakerId$.next(null);
    this.currentUtterance = null;
    this.sentences = [];
    this.activeSentenceIndex = -1;
    this.activeSentenceIndex$.next(-1);
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

    this.setListeningState(true);
    this.snackbar.show('Listening... Speak now.', 'info');

    this.voiceTimeout = setTimeout(() => {
      this.ngZone.run(() => {
        if (this.isListening) {
          this.stopVoiceSearch();
          this.snackbar.show('Voice search timed out.', 'info');
        }
      });
    }, 10000);

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
        this.setListeningState(false);
      });
    };

    this.voiceRecognition.onend = () => {
      if (this.voiceTimeout) {
        clearTimeout(this.voiceTimeout);
        this.voiceTimeout = null;
      }
      this.ngZone.run(() => {
        this.setListeningState(false);
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
      this.setListeningState(false);
      this.voiceRecognition = null;
      this.snackbar.show('Voice search stopped.', 'info');
    }
  }
}
