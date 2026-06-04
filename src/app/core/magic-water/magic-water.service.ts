// ═══════════════════════════════════════════════════════════════════
// 💧 MAGIC WATER ECONOMY — Le Royaume vit grâce à l'eau (= argent + IA)
//
// Chaque sort lancé dans le Royaume puise dans une réserve d'eau magique :
//   ─ Tokens consommés (Claude/GPT)
//   ─ Eau physique équivalente (cooling datacenter)
//   ─ Coût en dollars
//
// Singleton global. Tous les composants peuvent :
//   - publier une consommation : `magicWater.consume({tokens: 12480, action: 'tour-vocal'})`
//   - lire les compteurs : `magicWater.totalTokens()`, `totalWaterMl()`, `totalCostUsd()`
//   - définir un budget mensuel : `magicWater.setMonthlyBudget({usd: 10})`
// ═══════════════════════════════════════════════════════════════════
import { Injectable, signal, computed } from '@angular/core';

/** Constantes physiques (modèle pédagogique 2026) */
const COST_PER_TOKEN_USD = 0.000003;       // ≈ Claude Sonnet 3.5 input pricing
const WATER_ML_PER_1K_TOKENS = 2.5;        // Approx datacenter cooling (1k tokens ≈ 2.5 mL)
const CO2_G_PER_1K_TOKENS = 0.8;           // Approx grams CO₂ per 1k tokens

export interface WaterAction {
  /** Étiquette courte ('tour-vocal', 'refinement', 'retro-draft', etc.) */
  action: string;
  /** Tokens IN consommés */
  tokens: number;
  /** Tokens OUT optionnel (additionne si fourni) */
  tokensOut?: number;
  /** Room qui a déclenché l'action ('mana-fountain', 'phoenix-forge', etc.) */
  sourceRoom?: string;
  /** Timestamp ms (default Date.now()) */
  timestamp?: number;
}

export interface WaterStats {
  totalTokens: number;
  totalWaterMl: number;
  totalCostUsd: number;
  totalCo2G: number;
  actionCount: number;
}

@Injectable({ providedIn: 'root' })
export class MagicWaterService {
  // Compteurs réactifs
  private actions = signal<WaterAction[]>([]);
  totalTokens = computed(() => this.actions().reduce((s, a) => s + a.tokens + (a.tokensOut ?? 0), 0));
  totalWaterMl = computed(() => (this.totalTokens() / 1000) * WATER_ML_PER_1K_TOKENS);
  totalCostUsd = computed(() => this.totalTokens() * COST_PER_TOKEN_USD);
  totalCo2G = computed(() => (this.totalTokens() / 1000) * CO2_G_PER_1K_TOKENS);
  actionCount = computed(() => this.actions().length);

  // Budget mensuel
  monthlyBudgetUsd = signal<number>(10); // Par défaut $10/mois
  budgetRatio = computed(() => Math.min(1, this.totalCostUsd() / this.monthlyBudgetUsd()));
  budgetWarning = computed(() => this.budgetRatio() >= 0.8); // >= 80% → warning

  // Dernière action (pour feedback UI)
  lastAction = signal<WaterAction | null>(null);

  /**
   * Publie une consommation d'eau magique.
   * Notifie tous les abonnés (jauge UI, Mana Fountain, etc.)
   */
  consume(a: WaterAction): void {
    const action: WaterAction = {
      ...a,
      timestamp: a.timestamp ?? Date.now(),
    };
    this.actions.update(arr => {
      const next = [...arr, action];
      // Cap historique à 1000 pour éviter explosion mémoire
      if (next.length > 1000) next.splice(0, next.length - 1000);
      return next;
    });
    this.lastAction.set(action);
    this.persist();
  }

  /** Helper pour les actions Yamzy fréquentes (préset budgétaire) */
  consumePreset(preset: keyof typeof PRESETS, sourceRoom?: string): void {
    const p = PRESETS[preset];
    this.consume({
      action: preset,
      tokens: p.tokensIn,
      tokensOut: p.tokensOut,
      sourceRoom,
    });
  }

  /** Modifie le budget mensuel */
  setMonthlyBudget(usd: number): void {
    this.monthlyBudgetUsd.set(Math.max(0.1, usd));
    this.persist();
  }

  /** Reset (utile pour démarrer un nouveau sprint) */
  reset(): void {
    this.actions.set([]);
    this.lastAction.set(null);
    this.persist();
  }

  /** Stats courantes (snapshot) */
  getStats(): WaterStats {
    return {
      totalTokens: this.totalTokens(),
      totalWaterMl: this.totalWaterMl(),
      totalCostUsd: this.totalCostUsd(),
      totalCo2G: this.totalCo2G(),
      actionCount: this.actionCount(),
    };
  }

  /** Historique brut (pour la Mana Fountain qui affiche le timeline) */
  getHistory(): ReadonlyArray<WaterAction> {
    return this.actions();
  }

  /** Équivalences pédagogiques pour le bilan */
  equivalents(): { showers: number; bottles: number; pools: number } {
    const ml = this.totalWaterMl();
    return {
      showers: ml / 65_000,        // ≈ 65L par douche
      bottles: ml / 500,           // bouteille 50 cL
      pools: ml / 50_000_000,      // piscine moyenne 50 m³
    };
  }

  // ─── Persistance localStorage ───
  private STORAGE_KEY = 'yamzy-magic-water';
  constructor() {
    this.restore();
  }
  private persist(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        actions: this.actions(),
        monthlyBudgetUsd: this.monthlyBudgetUsd(),
      }));
    } catch {}
  }
  private restore(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.actions)) this.actions.set(data.actions);
      if (typeof data.monthlyBudgetUsd === 'number') this.monthlyBudgetUsd.set(data.monthlyBudgetUsd);
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════
// Préset budgétaire — actions Yamzy fréquentes (source : docs/SCRUM_WORKSHOP_ROOMS.md)
// ═══════════════════════════════════════════════════════════════════
export const PRESETS = {
  'tour-vocal-yamzy':    { tokensIn: 8000, tokensOut: 12000 },
  'audit-pr-mirror':     { tokensIn: 25000, tokensOut: 6000 },
  'refinement-ia':       { tokensIn: 3000, tokensOut: 1500 },
  'retro-draft':         { tokensIn: 6000, tokensOut: 3000 },
  'question-ad-hoc':     { tokensIn: 1500, tokensOut: 800 },
  'cosmos-orrery-anim':  { tokensIn: 0, tokensOut: 0 },      // 100% local 3D, 0 conso IA
  'phoenix-analyse':     { tokensIn: 10000, tokensOut: 4000 },
  'pre-mortem-genere':   { tokensIn: 8000, tokensOut: 5000 },
} as const;
