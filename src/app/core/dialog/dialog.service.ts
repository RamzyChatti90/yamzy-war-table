// WAR TABLE ⚔ — Dialog service unifié (alert / confirm / prompt) au style studio.
// Remplace les popups natifs du browser par un panel custom (WtDialogComponent).
//
// Usage :
//   await dialog.alert({ title: 'Sprint lancé', message: '...', kind: 'success' });
//   const ok = await dialog.confirm({ title: '...', message: '...' });
//   const choice = await dialog.prompt({ title: '...', message: '...', choices: [...] });

import { Injectable, signal } from '@angular/core';

export type DialogKind = 'info' | 'success' | 'warning' | 'error' | 'question';

export interface DialogChoice {
  value: string;
  label: string;
  hint?: string;
  /** Variant visuel : primary (doré), danger (rouge), neutral (gris). */
  kind?: 'primary' | 'danger' | 'neutral';
}

export interface DialogState {
  open: boolean;
  type: 'alert' | 'confirm' | 'prompt';
  kind: DialogKind;
  title: string;
  message: string;
  /** Pour confirm. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pour prompt. */
  choices?: DialogChoice[];
  /** Pour input texte. */
  inputType?: 'choices' | 'text';
  inputPlaceholder?: string;
  inputDefaultValue?: string;
  /** Lignes de détails sous le message (optionnel — affiché en mini-cards Yamzy-style). */
  details?: { label: string; value: string }[];
}

@Injectable({ providedIn: 'root' })
export class WtDialogService {
  /** État courant du dialog (un seul à la fois). */
  state = signal<DialogState>({ open: false, type: 'alert', kind: 'info', title: '', message: '' });

  /** Résolveur de la promise courante. */
  private resolver: ((v: any) => void) | null = null;

  /** Affiche un alert simple (style success / error / info / warning). */
  alert(opts: { title: string; message: string; kind?: DialogKind; details?: { label: string; value: string }[] }): Promise<void> {
    return new Promise(resolve => {
      this.resolver = () => resolve();
      this.state.set({
        open: true,
        type: 'alert',
        kind: opts.kind ?? 'info',
        title: opts.title,
        message: opts.message,
        details: opts.details,
        confirmLabel: 'OK',
      });
    });
  }

  /** Confirm Oui/Non. Renvoie true si confirmé, false sinon. */
  confirm(opts: {
    title: string;
    message: string;
    kind?: DialogKind;
    confirmLabel?: string;
    cancelLabel?: string;
    details?: { label: string; value: string }[];
  }): Promise<boolean> {
    return new Promise(resolve => {
      this.resolver = (v: boolean) => resolve(v);
      this.state.set({
        open: true,
        type: 'confirm',
        kind: opts.kind ?? 'question',
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? 'Confirmer',
        cancelLabel: opts.cancelLabel ?? 'Annuler',
        details: opts.details,
      });
    });
  }

  /** Prompt avec choix multiples (mini-cards Yamzy). Renvoie le value choisi ou null. */
  prompt(opts: {
    title: string;
    message: string;
    choices: DialogChoice[];
    kind?: DialogKind;
    details?: { label: string; value: string }[];
  }): Promise<string | null> {
    return new Promise(resolve => {
      this.resolver = (v: string | null) => resolve(v);
      this.state.set({
        open: true,
        type: 'prompt',
        kind: opts.kind ?? 'question',
        title: opts.title,
        message: opts.message,
        choices: opts.choices,
        inputType: 'choices',
        details: opts.details,
        cancelLabel: 'Annuler',
      });
    });
  }

  /** Appelé par le component quand l'utilisateur valide. */
  _resolve(value: any): void {
    if (this.resolver) this.resolver(value);
    this.resolver = null;
    this.state.update(s => ({ ...s, open: false }));
  }
}
