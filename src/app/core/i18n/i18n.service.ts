// WAR TABLE — i18n runtime (FR / EN).
// Signal-based, localStorage-persistent, async JSON load via HttpClient.
// Usage : {{ 'cle.path' | t }}  ou  i18n.t('cle.path')  dans le TS.

import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Lang = 'fr' | 'en';

const STORAGE_KEY = 'wt_lang';
const DEFAULT_LANG: Lang = 'fr';

interface Dict { [key: string]: any; }

@Injectable({ providedIn: 'root' })
export class I18nService {
  private http = inject(HttpClient);

  /** Langue active (signal réactif — change ⇒ tous les pipes se re-render). */
  readonly lang = signal<Lang>(this.readStoredLang());

  /** Dictionnaires chargés en mémoire. */
  private dicts: Record<Lang, Dict> = { fr: {}, en: {} };

  /** Signal qui change quand un dico arrive — pipe impur s'auto-refresh. */
  readonly version = signal(0);

  /** Liste des langues supportées (pour le switcher). */
  readonly available: { code: Lang; label: string; flag: string }[] = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'en', label: 'English',  flag: '🇬🇧' },
  ];

  constructor() {
    // Charge les 2 langues en parallèle au démarrage.
    this.load('fr');
    this.load('en');
    // Persistence auto à chaque changement.
    effect(() => {
      try { localStorage.setItem(STORAGE_KEY, this.lang()); } catch {}
      try { document.documentElement.setAttribute('lang', this.lang()); } catch {}
    });
  }

  /** Bascule entre les langues disponibles. */
  setLang(l: Lang): void {
    if (l === this.lang()) return;
    this.lang.set(l);
  }

  /** Traduit une clé dot-path. Si manquante → renvoie la clé brute (pour debug). */
  t(key: string, params?: Record<string, string | number>): string {
    if (!key) return '';
    const dict = this.dicts[this.lang()];
    let val = this.dig(dict, key);
    if (val == null) {
      // fallback FR si l'autre langue n'a pas la clé
      val = this.dig(this.dicts['fr'], key);
    }
    if (val == null) return key;
    if (typeof val !== 'string') return String(val);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        val = (val as string).replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return val as string;
  }

  // ─────────────────────────────────────────────────────
  // Internes
  // ─────────────────────────────────────────────────────

  private dig(obj: Dict, path: string): any {
    if (!obj) return null;
    const parts = path.split('.');
    let cur: any = obj;
    for (const p of parts) {
      if (cur == null) return null;
      cur = cur[p];
    }
    return cur;
  }

  private readStoredLang(): Lang {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'fr' || v === 'en') return v;
      // Auto-detect navigator
      const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
      return nav === 'en' ? 'en' : 'fr';
    } catch { return DEFAULT_LANG; }
  }

  private load(l: Lang): void {
    this.http.get<Dict>(`/assets/i18n/${l}.json`).subscribe({
      next: (d) => {
        this.dicts[l] = d || {};
        this.version.update(v => v + 1);
      },
      error: () => {
        // silencieux : si dico manquant, on tombe sur la clé brute
        this.dicts[l] = {};
        this.version.update(v => v + 1);
      }
    });
  }
}
