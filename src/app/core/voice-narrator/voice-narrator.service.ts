// ═══════════════════════════════════════════════════════════════════
// 🎙 VOICE NARRATOR — TTS (Web Speech API) pour Yamzy le conteur
//
// Wrapper léger sur `window.speechSynthesis` qui :
//   ─ Parle un texte avec voix française configurable
//   ─ Retourne une Promise qui résout sur `onend` (= fin lecture vocale)
//   ─ Supporte interruption (cancel) propre
//   ─ Fallback gracieux si SpeechSynthesis non dispo (timer estimé sur longueur)
//
// Usage :
//   const voice = inject(VoiceNarratorService);
//   voice.setPersona('cute-creature');
//   await voice.speak("Bienvenue dans le royaume des Mages...");
//   // ← ici la voix a fini, on peut chaîner l'animation suivante
//
// Pattern inspiré du spell-caster (sequencer : voix → onend → next).
// ═══════════════════════════════════════════════════════════════════
import { Injectable, signal } from '@angular/core';

export type VoicePersona = 'cute-creature' | 'old-sage' | 'enthusiastic-elf';

export interface VoicePersonaProfile {
  pitch: number;   // 0..2 (1 = normal)
  rate: number;    // 0.5..2 (1 = normal)
  volume: number;  // 0..1
  voiceFilter: (v: SpeechSynthesisVoice) => boolean;
}

const PROFILES: Record<VoicePersona, VoicePersonaProfile> = {
  // 🐭 Petite créature mignonne au timbre haut perché, vive et enthousiaste
  'cute-creature': {
    pitch: 1.4,
    rate: 1.0,
    volume: 1.0,
    voiceFilter: (v) => v.lang.startsWith('fr'),
  },
  // 🧙 Vieux sage à la voix grave et lente, conteur classique
  'old-sage': {
    pitch: 0.85,
    rate: 0.85,
    volume: 1.0,
    voiceFilter: (v) => v.lang.startsWith('fr'),
  },
  // 🧚 Lutin facétieux, juste au-dessus du normal
  'enthusiastic-elf': {
    pitch: 1.15,
    rate: 1.05,
    volume: 1.0,
    voiceFilter: (v) => v.lang.startsWith('fr'),
  },
};

@Injectable({ providedIn: 'root' })
export class VoiceNarratorService {
  /** État réactif (utile pour l'UI : afficher waveform / badge "parlant…") */
  speaking = signal<boolean>(false);
  /** Phrase actuellement en cours de lecture */
  currentText = signal<string>('');
  /** Persona actuel (vieux/mignon/lutin) */
  persona = signal<VoicePersona>('cute-creature');
  /** Voix disponibles (peuplé après chargement async des voix) */
  availableVoices = signal<SpeechSynthesisVoice[]>([]);
  /** Voix française sélectionnée (cache) */
  private selectedVoice: SpeechSynthesisVoice | null = null;

  /** Référence à l'utterance en cours (pour cancel propre) */
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  /** Resolver de la promise en cours (utilisé par cancel pour resolve plutôt que pendre) */
  private currentResolver: (() => void) | null = null;

  private get hasSpeechAPI(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  constructor() {
    if (this.hasSpeechAPI) {
      this.refreshVoices();
      // Les voix sont chargées async sur certains navigateurs (Chrome)
      window.speechSynthesis.addEventListener('voiceschanged', () => this.refreshVoices());
    }
  }

  /** Met à jour le persona vocal (mignon, vieux, lutin…) */
  setPersona(p: VoicePersona): void {
    this.persona.set(p);
  }

  /**
   * Parle un texte et retourne une Promise qui résout quand la voix a fini.
   * Si une autre utterance est en cours, elle est annulée d'abord.
   *
   * @param text  Le texte à lire
   * @param opts.skipIfMuted  Si true et muted, retourne immédiatement sans lire
   */
  speak(text: string, opts?: { skipIfMuted?: boolean }): Promise<void> {
    if (!text || !text.trim()) return Promise.resolve();

    // Si pas d'API → fallback timer estimé (~ 60 mots/min lecture lente)
    if (!this.hasSpeechAPI) {
      return this.fallbackTimer(text);
    }

    // Cancel l'utterance précédente proprement
    this.cancel();

    return new Promise<void>((resolve) => {
      const profile = PROFILES[this.persona()];
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.pitch = profile.pitch;
      utterance.rate = profile.rate;
      utterance.volume = profile.volume;

      const voice = this.pickVoice(profile);
      if (voice) utterance.voice = voice;

      this.currentUtterance = utterance;
      this.currentResolver = resolve;
      this.speaking.set(true);
      this.currentText.set(text);

      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        this.speaking.set(false);
        this.currentText.set('');
        this.currentUtterance = null;
        this.currentResolver = null;
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = (e) => {
        console.warn('[VoiceNarrator] error', e);
        finish();
      };

      // Safety net : si onend ne se déclenche jamais (bugs Chrome connus),
      // on libère après un timeout proportionnel à la longueur du texte
      const safetyMs = Math.max(3000, text.length * 80);  // ~12 chars/seconde minimum
      setTimeout(() => {
        if (!resolved) {
          console.warn('[VoiceNarrator] safety timeout fired for:', text.slice(0, 40));
          try { window.speechSynthesis.cancel(); } catch {}
          finish();
        }
      }, safetyMs);

      try {
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('[VoiceNarrator] speak failed', e);
        finish();
      }
    });
  }

  /**
   * Annule la voix en cours (résout immédiatement la Promise pendante).
   */
  cancel(): void {
    if (!this.hasSpeechAPI) return;
    try { window.speechSynthesis.cancel(); } catch {}
    if (this.currentResolver) {
      const r = this.currentResolver;
      this.currentResolver = null;
      r();
    }
    this.speaking.set(false);
    this.currentText.set('');
    this.currentUtterance = null;
  }

  /** Test rapide : prononce un échantillon avec le persona courant */
  testVoice(): Promise<void> {
    return this.speak('Bonjour, je suis Yamzy, ton guide du Royaume.');
  }

  // ───────────────────────────────────────────────────────────────────
  // PRIVÉ
  // ───────────────────────────────────────────────────────────────────
  private refreshVoices(): void {
    if (!this.hasSpeechAPI) return;
    const voices = window.speechSynthesis.getVoices();
    this.availableVoices.set(voices);
    // Invalide le cache pour re-pick à la prochaine `speak()`
    this.selectedVoice = null;
  }

  private pickVoice(profile: VoicePersonaProfile): SpeechSynthesisVoice | null {
    if (this.selectedVoice && profile.voiceFilter(this.selectedVoice)) {
      return this.selectedVoice;
    }
    const voices = this.availableVoices();
    const matching = voices.filter(profile.voiceFilter);
    if (matching.length === 0) {
      // Fallback : prend la première voix dispo (mieux qu'aucune)
      this.selectedVoice = voices[0] ?? null;
      return this.selectedVoice;
    }
    // Préférence : voix françaises locales/serveur, exclut "Google" qui peut être bloquée
    const preferred =
      matching.find(v => /Hortense|Julie|Amélie/i.test(v.name)) ??
      matching.find(v => /Microsoft|Apple/i.test(v.name)) ??
      matching[0];
    this.selectedVoice = preferred;
    return preferred;
  }

  /**
   * Fallback timer si pas de Speech API (durée estimée sur longueur).
   * ~ 12 caractères par seconde (lecture lente, narratif).
   */
  private fallbackTimer(text: string): Promise<void> {
    const durationMs = Math.max(1500, text.length * 80);
    this.speaking.set(true);
    this.currentText.set(text);
    return new Promise(resolve => {
      setTimeout(() => {
        this.speaking.set(false);
        this.currentText.set('');
        resolve();
      }, durationMs);
    });
  }
}
