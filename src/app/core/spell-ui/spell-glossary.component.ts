// ═══════════════════════════════════════════════════════════════════
// 📖 SPELL GLOSSARY — Panneau définitions au style spell-caster
//
// Liste structurée { icon, term, definition, cite? } façon dictionnaire
// magique. Utilisé pour expliquer les objets/cérémonies d'une room.
//
//   <wt-spell-glossary
//     [open]="showGlossary()"
//     title="Glossaire de la Forge"
//     accent="#67e8f9"
//     [entries]="glossaryEntries"
//     (close)="showGlossary.set(false)" />
//
// glossaryEntries: GlossaryEntry[] = [
//   { icon: '🥚', term: 'Œuf de phénix', definition: 'Une release en préparation.', cite: 'Yamzy le Conteur' },
//   ...
// ];
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpellPanelComponent } from './spell-panel.component';
import { SPELL_DEFAULT_ACCENT, SpellAccent } from './spell-tokens';

export interface GlossaryEntry {
  icon?: string;
  term: string;
  definition: string;
  cite?: string;
  /** Catégorie pour grouper (optionnel) */
  category?: string;
}

@Component({
  selector: 'wt-spell-glossary',
  standalone: true,
  imports: [CommonModule, SpellPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <wt-spell-panel
      [open]="open"
      [title]="title"
      [subtitle]="subtitle"
      icon="📖"
      [accent]="accent"
      [side]="side"
      [size]="size"
      (close)="close.emit()">
      <ul class="sg-list" [style.--accent]="accent">
        <li *ngFor="let e of entries; trackBy: trackByTerm" class="sg-entry">
          <div class="sg-head">
            <span *ngIf="e.icon" class="sg-icon">{{ e.icon }}</span>
            <span class="sg-term">{{ e.term }}</span>
            <span *ngIf="e.category" class="sg-cat">{{ e.category }}</span>
          </div>
          <p class="sg-def">{{ e.definition }}</p>
          <p *ngIf="e.cite" class="sg-cite">— {{ e.cite }}</p>
        </li>
        <li *ngIf="entries.length === 0" class="sg-empty">Aucune définition pour l'instant.</li>
      </ul>
    </wt-spell-panel>
  `,
  styles: [`
    .sg-list { list-style: none; margin: 0; padding: 0; --accent: ${SPELL_DEFAULT_ACCENT}; }
    .sg-entry {
      padding: 14px 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .sg-entry:last-child { border-bottom: none; }
    .sg-head {
      display: flex; align-items: baseline; gap: 10px;
      margin-bottom: 6px;
    }
    .sg-icon { font-size: 1.3em; }
    .sg-term {
      font-family: "Henny Penny", cursive;
      font-weight: 400;
      color: var(--accent);
      font-size: clamp(16px, 2.2vmin, 21px);
      letter-spacing: 0.02em;
    }
    .sg-cat {
      margin-left: auto;
      font-size: 0.7em;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      opacity: 0.55;
      border: 1px solid currentColor;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .sg-def {
      margin: 0;
      font-family: "Tinos", serif;
      font-size: clamp(14px, 1.85vmin, 17px);
      line-height: 1.55;
      opacity: 0.95;
    }
    .sg-cite {
      margin: 6px 0 0;
      font-style: italic;
      opacity: 0.65;
      font-size: 0.9em;
    }
    .sg-empty {
      text-align: center;
      opacity: 0.55;
      font-style: italic;
      padding: 30px 0;
    }
  `],
})
export class SpellGlossaryComponent {
  @Input() open = false;
  @Input() title = 'Glossaire';
  @Input() subtitle?: string;
  @Input() accent: SpellAccent = SPELL_DEFAULT_ACCENT;
  @Input() side: 'right' | 'left' = 'right';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() entries: GlossaryEntry[] = [];
  @Output() close = new EventEmitter<void>();

  trackByTerm = (_: number, e: GlossaryEntry) => e.term;
}
