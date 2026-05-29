// Pipe {{ 'cle' | t }} — réactif au signal I18nService.lang() ET I18nService.version().
// Implémenté impur pour se ré-évaluer à chaque change detection (cheap : juste un dig dans un objet).

import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

@Pipe({
  name: 't',
  standalone: true,
  pure: false, // ré-évalue à chaque CD — nécessaire pour réagir au changement de langue runtime
})
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(key: string | null | undefined, params?: Record<string, string | number>): string {
    if (!key) return '';
    // touch les signaux pour que Angular re-render quand ils changent
    this.i18n.lang();
    this.i18n.version();
    return this.i18n.t(key, params);
  }
}
