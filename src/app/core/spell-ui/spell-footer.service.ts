// ════════════════════════════════════════════════════════════════════
// 🎚 SPELL FOOTER SERVICE — Source unique du footer global
//
// Chaque room déclare ses actions/hint via setSlots() dans ngOnInit
// et clearSlots() dans ngOnDestroy. Le SpellFooterComponent (injecté
// globalement dans app.component.html) lit ce service et rend les
// actions de la room courante.
//
// USAGE dans une room :
//   constructor(private spellFooter: SpellFooterService) {}
//   ngOnInit() {
//     this.spellFooter.setSlots({
//       controls: [
//         { icon: '🎬', label: 'Demo',    action: () => this.loadDemo() },
//         { icon: '🎥', label: 'Reset',   action: () => this.resetCamera() },
//       ],
//       hint: 'Drag = orbit · molette = zoom',
//       accent: '#67e8f9',
//     });
//   }
//   ngOnDestroy() { this.spellFooter.clearSlots(); }
// ════════════════════════════════════════════════════════════════════
import { Injectable, signal } from '@angular/core';

export interface FooterControl {
  /** Texte du bouton */
  label: string;
  /** Icône emoji optionnel (ex: '🎬', '🎥') */
  icon?: string;
  /** Variant visuel : primary (accent fort) / secondary (par défaut) / danger (rouge) */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Callback exécuté au click */
  action: () => void;
  /** Tooltip optionnel */
  title?: string;
  /** Désactivé */
  disabled?: boolean;
}

export interface FooterSlots {
  controls: FooterControl[];
  /** Texte d'aide affiché à droite/dessous */
  hint?: string;
  /** Couleur d'accent (matche celle de la room) */
  accent?: string;
}

const EMPTY_SLOTS: FooterSlots = { controls: [], hint: '', accent: '#d54adf' };

@Injectable({ providedIn: 'root' })
export class SpellFooterService {
  /** Snapshot courant des slots (lu par SpellFooterComponent) */
  slots = signal<FooterSlots>(EMPTY_SLOTS);
  /** Vrai pendant que le room-splash est affiché → le footer reste caché pour ne pas dupliquer les actions. */
  splashActive = signal<boolean>(false);

  /** Définit les slots de la room courante. À appeler dans ngOnInit. */
  setSlots(slots: Partial<FooterSlots>): void {
    this.slots.set({
      controls: slots.controls || [],
      hint: slots.hint || '',
      accent: slots.accent || '#d54adf',
    });
  }

  /** Réinitialise les slots. À appeler dans ngOnDestroy ou au changement de route. */
  clearSlots(): void {
    this.slots.set(EMPTY_SLOTS);
  }
}
