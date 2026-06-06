// ═══════════════════════════════════════════════════════════════════
// 🏗 YAMZY STUDIO MAKER — L'Atelier Universel
//
// Application standalone pour CRÉER et ÉDITER les rooms de Yamzy World.
// Ultra-pro-max : reprend TOUTES les mécaniques génériques du projet :
//
//   ✦ Éditeur 3D Three.js (orbit/zoom/pan)
//   ✦ TransformControls Blender-way (G=translate R=rotate S=scale Esc=deselect)
//   ✦ Librairie 30+ templates (primitives + Yamzy iconic : Crystal, Tree, Mountain, Phoenix, ...)
//   ✦ Hierarchy panel (tree des objets de la scène)
//   ✦ Inspector (transform live + material color/emissive/metalness/roughness + tutorialId tag)
//   ✦ Import GLB (drag-drop sur le viewport)
//   ✦ Export GLB (current scene → fichier téléchargé)
//   ✦ Multi-scenes management (créer/switcher/dupliquer/supprimer)
//   ✦ Save/Load projet local (localStorage)
//   ✦ EDITER une room existante (charger sa scene 3D depuis assets)
//   ✦ Tutorial Builder form (génère le JSON narrator sans écrire de code)
//   ✦ Preview live du narrateur Yamzy
//   ✦ Snapshot caméra (capture pour les steps du tutorial)
//   ✦ Cérémonie tester (preview du flash overlay)
//
// Route : /yamzy-studio-maker
// ═══════════════════════════════════════════════════════════════════
import {
  ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject,
  OnDestroy, OnInit, signal, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NarratorService } from '../../core/narrator/narrator.service';
import { NarratorComponent } from '../../core/narrator/narrator.component';
import { TutorialGlossaryEntry, TutorialTourStep, RoomTutorial, NarratorMode, Vec3 } from '../../core/narrator/narrator.types';
import { SpellFooterService } from '../../core/spell-ui';

interface ObjectMeta {
  id: string;
  name: string;
  templateKey: string;
  tutorialId?: string;
  three: any;  // Three.js Object3D ref
}

interface SceneConfig {
  id: string;
  name: string;
  bgColor: string;
  fogDensity: number;
  objects: ObjectMeta[];
}

interface ProjectMeta {
  name: string;
  roomKey: string;
  scenes: SceneConfig[];
  tutorial: RoomTutorial;
  savedAt: number;
}

interface LibraryTemplate {
  key: string;
  category: 'primitive' | 'light' | 'yamzy';
  icon: string;
  name: string;
  /** Builder reçoit T (THREE) et retourne un Object3D */
  build: (T: any) => any;
}

@Component({
  selector: 'wt-yamzy-studio-maker',
  standalone: true,
  imports: [CommonModule, FormsModule, NarratorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ysm-host">
      <!-- ═══ TOPBAR ═══ -->
      <header class="ysm-topbar">
        <div class="ysm-brand">
          <span class="ysm-brand-icon">🏗</span>
          <span class="ysm-brand-text">YAMZY STUDIO MAKER</span>
        </div>
        <div class="ysm-scenes">
          <label>Scene :</label>
          <select [ngModel]="activeSceneId()" (ngModelChange)="switchScene($event)">
            @for (s of scenes(); track s.id) {
              <option [value]="s.id">{{ s.name }}</option>
            }
          </select>
          <button (click)="addScene()" title="Nouvelle scène">＋</button>
          <button (click)="duplicateScene()" title="Dupliquer la scène">⎘</button>
          <button (click)="deleteScene()" [disabled]="scenes().length <= 1" title="Supprimer la scène">🗑</button>
        </div>
        <div class="ysm-project">
          <input type="text" [ngModel]="projectName()" (ngModelChange)="projectName.set($event)"
                 placeholder="Mon Studio" class="ysm-project-name">
          <input type="text" [ngModel]="roomKey()" (ngModelChange)="roomKey.set($event)"
                 placeholder="room-key" class="ysm-room-key">
        </div>
        <div class="ysm-mode">
          <button [class.active]="mode() === 'edit'" (click)="mode.set('edit')">🔧 Edit 3D</button>
          <button [class.active]="mode() === 'tutorial'" (click)="mode.set('tutorial')">📜 Tutorial</button>
          <button [class.active]="mode() === 'preview'" (click)="mode.set('preview')">▶ Preview</button>
        </div>
        <div class="ysm-actions">
          <button (click)="saveProject()" title="Save localStorage (Ctrl+S)">💾 Save</button>
          <button (click)="exportGLB()" title="Export scene as GLB">📦 GLB</button>
          <button (click)="exportTutorialJSON()" title="Export tutorial.json">📜 JSON</button>
          <button class="ysm-import-btn" (click)="triggerImportFile()" title="Import GLB">📥 Import</button>
          <input #importInput type="file" accept=".glb,.gltf,.json" style="display:none"
                 (change)="onImportFile($event)">
        </div>
      </header>

      <!-- ═══ MAIN AREA (3-column layout en mode edit) ═══ -->
      <main class="ysm-main" [attr.data-mode]="mode()">

        <!-- ═══ LEFT SIDEBAR : Library + Hierarchy ═══ -->
        <aside class="ysm-left" *ngIf="mode() === 'edit'">
          <!-- LIBRARY -->
          <div class="ysm-panel">
            <div class="ysm-panel-title">📚 LIBRAIRIE</div>
            <div class="ysm-lib-tabs">
              <button [class.active]="libTab() === 'primitive'" (click)="libTab.set('primitive')">Primitives</button>
              <button [class.active]="libTab() === 'light'" (click)="libTab.set('light')">Lights</button>
              <button [class.active]="libTab() === 'yamzy'" (click)="libTab.set('yamzy')">🪶 Yamzy</button>
            </div>
            <div class="ysm-lib-grid">
              @for (t of libraryForTab(); track t.key) {
                <button class="ysm-lib-item" (click)="addFromTemplate(t)" [title]="t.name">
                  <span class="ysm-lib-icon">{{ t.icon }}</span>
                  <span class="ysm-lib-name">{{ t.name }}</span>
                </button>
              }
            </div>
          </div>

          <!-- HIERARCHY -->
          <div class="ysm-panel">
            <div class="ysm-panel-title">🌲 HIÉRARCHIE ({{ activeScene()?.objects?.length || 0 }})</div>
            <div class="ysm-hierarchy">
              @if (!activeScene()?.objects?.length) {
                <div class="ysm-hint">Scène vide. Clique un objet dans la Librairie ↑</div>
              }
              @for (o of activeScene()?.objects || []; track o.id) {
                <div class="ysm-hier-item" [class.is-selected]="selectedId() === o.id"
                     (click)="selectObject(o.id)">
                  <span class="ysm-hier-icon">{{ templateIcon(o.templateKey) }}</span>
                  <span class="ysm-hier-name">{{ o.name }}</span>
                  @if (o.tutorialId) {
                    <span class="ysm-hier-tag" title="tutorialId">🪶</span>
                  }
                  <button class="ysm-hier-del" (click)="deleteObject(o.id); $event.stopPropagation()">×</button>
                </div>
              }
            </div>
          </div>

          <!-- LOAD EXISTING ROOM -->
          <div class="ysm-panel">
            <div class="ysm-panel-title">🚪 ÉDITER UNE ROOM EXISTANTE</div>
            <select [ngModel]="loadRoomKey()" (ngModelChange)="loadRoomKey.set($event)">
              <option value="">— Choisir —</option>
              @for (r of existingRooms; track r.key) {
                <option [value]="r.key">{{ r.icon }} {{ r.name }}</option>
              }
            </select>
            <button class="ysm-load-room-btn" (click)="loadExistingRoom()" [disabled]="!loadRoomKey()">
              📥 Charger sa scène
            </button>
          </div>
        </aside>

        <!-- ═══ VIEWPORT 3D (au centre, toujours visible sauf en preview) ═══ -->
        <div class="ysm-viewport" #viewport
             (dragover)="onDragOver($event)"
             (drop)="onFileDrop($event)">
          <canvas #canvas></canvas>
          <div *ngIf="dragHover()" class="ysm-drag-overlay">📥 Drop GLB to import</div>
          <div class="ysm-viewport-hud">
            <div class="ysm-vp-info">
              <span>FPS {{ fps() }}</span>
              <span>Objects {{ activeScene()?.objects?.length || 0 }}</span>
              <span>Mode {{ mode() }}</span>
            </div>
            <div class="ysm-vp-shortcuts">
              <kbd>G</kbd> move <kbd>R</kbd> rot <kbd>S</kbd> scale
              <kbd>Esc</kbd> deselect <kbd>Del</kbd> delete <kbd>D</kbd> duplicate
              <kbd>F</kbd> focus
            </div>
          </div>
        </div>

        <!-- ═══ RIGHT SIDEBAR : Inspector OU Tutorial Form ═══ -->
        <aside class="ysm-right" *ngIf="mode() !== 'preview'">
          @if (mode() === 'edit') {
            <!-- INSPECTOR -->
            @if (selectedObject(); as sel) {
              <div class="ysm-panel">
                <div class="ysm-panel-title">🔧 INSPECTOR</div>
                <div class="ysm-insp-head">
                  <span class="ysm-insp-icon">{{ templateIcon(sel.templateKey) }}</span>
                  <input class="ysm-insp-name" type="text" [ngModel]="sel.name"
                         (ngModelChange)="renameObject(sel.id, $event)">
                </div>

                <!-- TutorialId Tag -->
                <div class="ysm-insp-field">
                  <label>🪶 Tutorial ID :</label>
                  <input type="text" [ngModel]="sel.tutorialId || ''"
                         (ngModelChange)="setTutorialId(sel.id, $event)"
                         placeholder="ex: crystal-central">
                  <small>Référencé par le tutorial.json (highlight)</small>
                </div>

                <!-- Transform (computed signals = re-render quand gizmo drag) -->
                <div class="ysm-insp-section">
                  <div class="ysm-section-title">📐 Transform</div>
                  <div class="ysm-vec3">
                    <label>Position</label>
                    <input type="number" step="0.1" [ngModel]="selectedPos().x" (ngModelChange)="updateTransform('position', 'x', $event)">
                    <input type="number" step="0.1" [ngModel]="selectedPos().y" (ngModelChange)="updateTransform('position', 'y', $event)">
                    <input type="number" step="0.1" [ngModel]="selectedPos().z" (ngModelChange)="updateTransform('position', 'z', $event)">
                  </div>
                  <div class="ysm-vec3">
                    <label>Rotation</label>
                    <input type="number" step="0.05" [ngModel]="selectedRot().x" (ngModelChange)="updateTransform('rotation', 'x', $event)">
                    <input type="number" step="0.05" [ngModel]="selectedRot().y" (ngModelChange)="updateTransform('rotation', 'y', $event)">
                    <input type="number" step="0.05" [ngModel]="selectedRot().z" (ngModelChange)="updateTransform('rotation', 'z', $event)">
                  </div>
                  <div class="ysm-vec3">
                    <label>Scale</label>
                    <input type="number" step="0.1" [ngModel]="selectedScl().x" (ngModelChange)="updateTransform('scale', 'x', $event)">
                    <input type="number" step="0.1" [ngModel]="selectedScl().y" (ngModelChange)="updateTransform('scale', 'y', $event)">
                    <input type="number" step="0.1" [ngModel]="selectedScl().z" (ngModelChange)="updateTransform('scale', 'z', $event)">
                  </div>
                </div>

                <!-- Material (si mesh) -->
                @if (selectedHasMaterial()) {
                  <div class="ysm-insp-section">
                    <div class="ysm-section-title">🎨 Material</div>
                    <div class="ysm-row">
                      <label>Color :</label>
                      <input type="color" [ngModel]="materialColor()" (ngModelChange)="updateMaterial('color', $event)">
                    </div>
                    <div class="ysm-row">
                      <label>Emissive :</label>
                      <input type="color" [ngModel]="materialEmissive()" (ngModelChange)="updateMaterial('emissive', $event)">
                    </div>
                    <div class="ysm-row">
                      <label>Glow :</label>
                      <input type="range" min="0" max="2" step="0.05" [ngModel]="materialEmissiveIntensity()" (ngModelChange)="updateMaterial('emissiveIntensity', $event)">
                      <span>{{ materialEmissiveIntensity() | number:'1.2-2' }}</span>
                    </div>
                    <div class="ysm-row">
                      <label>Metal :</label>
                      <input type="range" min="0" max="1" step="0.05" [ngModel]="materialMetalness()" (ngModelChange)="updateMaterial('metalness', $event)">
                      <span>{{ materialMetalness() | number:'1.2-2' }}</span>
                    </div>
                    <div class="ysm-row">
                      <label>Rough :</label>
                      <input type="range" min="0" max="1" step="0.05" [ngModel]="materialRoughness()" (ngModelChange)="updateMaterial('roughness', $event)">
                      <span>{{ materialRoughness() | number:'1.2-2' }}</span>
                    </div>
                    <div class="ysm-row">
                      <label>Opacity :</label>
                      <input type="range" min="0" max="1" step="0.05" [ngModel]="materialOpacity()" (ngModelChange)="updateMaterial('opacity', $event)">
                      <span>{{ materialOpacity() | number:'1.2-2' }}</span>
                    </div>
                  </div>
                }

                <div class="ysm-insp-actions">
                  <button (click)="duplicateObject(sel.id)">⎘ Duplicate</button>
                  <button (click)="focusObject(sel.id)">🎯 Focus</button>
                  <button class="danger" (click)="deleteObject(sel.id)">🗑 Delete</button>
                </div>
              </div>
            } @else {
              <div class="ysm-panel ysm-empty">
                <div class="ysm-empty-icon">🪶</div>
                <div>Clique un objet 3D pour l'éditer</div>
                <small>Tu peux aussi drag-drop un GLB sur le viewport</small>
              </div>
            }

            <!-- Scene settings -->
            <div class="ysm-panel">
              <div class="ysm-panel-title">🌌 SCÈNE — {{ activeScene()?.name }}</div>
              <div class="ysm-row">
                <label>Nom :</label>
                <input type="text" [ngModel]="activeScene()?.name" (ngModelChange)="updateSceneMeta('name', $event)">
              </div>
              <div class="ysm-row">
                <label>BG Color :</label>
                <input type="color" [ngModel]="activeScene()?.bgColor" (ngModelChange)="updateSceneMeta('bgColor', $event)">
              </div>
              <div class="ysm-row">
                <label>Fog :</label>
                <input type="range" min="0" max="0.1" step="0.005" [ngModel]="activeScene()?.fogDensity"
                       (ngModelChange)="updateSceneMeta('fogDensity', +$event)">
                <span>{{ activeScene()?.fogDensity | number:'1.3-3' }}</span>
              </div>
            </div>
          }

          @if (mode() === 'tutorial') {
            <!-- TUTORIAL FORM BUILDER -->
            <div class="ysm-panel">
              <div class="ysm-panel-title">📜 META</div>
              <div class="ysm-row"><label>Name :</label><input type="text" [ngModel]="tutorial().meta.name" (ngModelChange)="updateTutorialMeta('name', $event)"></div>
              <div class="ysm-row"><label>Lore Name :</label><input type="text" [ngModel]="tutorial().meta.loreName" (ngModelChange)="updateTutorialMeta('loreName', $event)"></div>
              <div class="ysm-row"><label>Icon :</label><input type="text" [ngModel]="tutorial().meta.icon" (ngModelChange)="updateTutorialMeta('icon', $event)"></div>
              <div class="ysm-row"><label>Color :</label><input type="color" [ngModel]="tutorial().meta.color" (ngModelChange)="updateTutorialMeta('color', $event)"></div>
              <div class="ysm-row col"><label>Summary :</label><textarea rows="2" [ngModel]="tutorial().meta.summary" (ngModelChange)="updateTutorialMeta('summary', $event)"></textarea></div>
              <div class="ysm-row col"><label>Intro lore :</label><textarea rows="3" [ngModel]="tutorial().meta.introLore" (ngModelChange)="updateTutorialMeta('introLore', $event)"></textarea></div>
            </div>

            <div class="ysm-panel">
              <div class="ysm-panel-title">
                🧰 GLOSSARY ({{ tutorial().glossary.length }})
                <button class="ysm-mini-add" (click)="addGlossaryEntry()">＋</button>
              </div>
              @for (g of tutorial().glossary; track g.tutorialId; let i = $index) {
                <details class="ysm-glos-entry">
                  <summary>
                    <span class="ysm-glos-id">{{ g.tutorialId || 'NEW' }}</span>
                    <span class="ysm-glos-name">{{ g.name }}</span>
                    <button class="ysm-mini-del" (click)="removeGlossaryEntry(i); $event.stopPropagation()">×</button>
                  </summary>
                  <div class="ysm-row"><label>tutorialId :</label>
                    <select [ngModel]="g.tutorialId" (ngModelChange)="updateGlossary(i, 'tutorialId', $event)">
                      <option value="">— Choisir un objet tagué —</option>
                      @for (t of taggedTutorialIds(); track t) {
                        <option [value]="t">{{ t }}</option>
                      }
                    </select>
                  </div>
                  <div class="ysm-row"><label>Name :</label><input type="text" [ngModel]="g.name" (ngModelChange)="updateGlossary(i, 'name', $event)"></div>
                  <div class="ysm-row"><label>Lore name :</label><input type="text" [ngModel]="g.loreName" (ngModelChange)="updateGlossary(i, 'loreName', $event)"></div>
                  <div class="ysm-row"><label>Scrum name :</label><input type="text" [ngModel]="g.scrumName" (ngModelChange)="updateGlossary(i, 'scrumName', $event)"></div>
                  <div class="ysm-row col"><label>Desc :</label><textarea rows="2" [ngModel]="g.desc" (ngModelChange)="updateGlossary(i, 'desc', $event)"></textarea></div>
                  <div class="ysm-row col"><label>🪄 Yamzy explain :</label><textarea rows="3" [ngModel]="g.yamzyExplain" (ngModelChange)="updateGlossary(i, 'yamzyExplain', $event)"></textarea></div>
                  <div class="ysm-row col"><label>📋 Scrum explain :</label><textarea rows="3" [ngModel]="g.scrumExplain" (ngModelChange)="updateGlossary(i, 'scrumExplain', $event)"></textarea></div>
                </details>
              }
            </div>

            <div class="ysm-panel">
              <div class="ysm-panel-title">
                🎬 TOUR STEPS ({{ tutorial().tour.length }})
                <button class="ysm-mini-add" (click)="addTourStep()">＋</button>
              </div>
              @for (s of tutorial().tour; track s.step; let i = $index) {
                <details class="ysm-tour-step">
                  <summary>
                    <span class="ysm-step-num">{{ s.step }}</span>
                    <span class="ysm-step-text">{{ s.text | slice:0:50 }}…</span>
                    <button class="ysm-mini-del" (click)="removeTourStep(i); $event.stopPropagation()">×</button>
                  </summary>
                  <div class="ysm-row col"><label>Text :</label><textarea rows="3" [ngModel]="s.text" (ngModelChange)="updateTourStep(i, 'text', $event)"></textarea></div>
                  <div class="ysm-row"><label>Mode :</label>
                    <select [ngModel]="s.narratorMode" (ngModelChange)="updateTourStep(i, 'narratorMode', $event)">
                      <option value="yamzy">🪄 Yamzy</option>
                      <option value="scrum">📋 Scrum</option>
                    </select>
                  </div>
                  <div class="ysm-row"><label>Highlight :</label>
                    <select [ngModel]="s.highlight" (ngModelChange)="updateTourStep(i, 'highlight', $event)">
                      <option [ngValue]="null">— Aucun —</option>
                      @for (t of taggedTutorialIds(); track t) {
                        <option [value]="t">{{ t }}</option>
                      }
                    </select>
                  </div>
                  <div class="ysm-row"><label>Wait (s) :</label><input type="number" step="0.5" [ngModel]="s.wait" (ngModelChange)="updateTourStep(i, 'wait', +$event)"></div>
                  <div class="ysm-row">
                    <button class="ysm-snap-cam" (click)="captureCameraForStep(i)" title="Capture position caméra actuelle">📸 Capture cam</button>
                    @if (s.camera) {
                      <small>📍 ({{ s.camera.position?.[0] | number:'1.1-1' }}, {{ s.camera.position?.[1] | number:'1.1-1' }}, {{ s.camera.position?.[2] | number:'1.1-1' }})</small>
                    }
                  </div>
                </details>
              }
            </div>

            <div class="ysm-panel">
              <div class="ysm-panel-title">📺 PLAY EXAMPLE</div>
              <div class="ysm-row"><label>Duration (s) :</label><input type="number" min="5" max="120" [ngModel]="tutorial().playExample.duration" (ngModelChange)="updatePlayExample('duration', +$event)"></div>
              <div class="ysm-row col"><label>Description :</label><textarea rows="2" [ngModel]="tutorial().playExample.description" (ngModelChange)="updatePlayExample('description', $event)"></textarea></div>
              <button class="ysm-test-tour" (click)="testTutorial()">🎓 Tester le tour avec Yamzy</button>
            </div>

            <div class="ysm-panel">
              <button class="ysm-export-json" (click)="exportTutorialJSON()">📥 Export tutorial.json</button>
            </div>
          }
        </aside>
      </main>

      <!-- Narrator overlay (preview live) -->
      <wt-narrator></wt-narrator>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100vh; padding-top: 60px; box-sizing: border-box; overflow: hidden; }
    .ysm-host { display: flex; flex-direction: column; width: 100%; height: 100%; background: #0a0e1c; color: #e8eaf6; font-family: system-ui, sans-serif; font-size: 13px; }

    /* ═══ TOPBAR — flex-wrap pour pas déborder sur petit viewport ═══ */
    .ysm-topbar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: transparent; border-bottom: 1px solid #2a3055; flex: 0 0 auto; min-height: 48px; flex-wrap: wrap; }
    .ysm-brand { display: flex; align-items: center; gap: 8px; }
    .ysm-brand-icon { font-size: 24px; }
    .ysm-brand-text { font-weight: 800; letter-spacing: 1.5px; color: #fbbf24; }
    .ysm-scenes, .ysm-project, .ysm-mode, .ysm-actions { display: flex; align-items: center; gap: 4px; }
    .ysm-scenes label { font-size: 11px; opacity: 0.7; }
    .ysm-scenes select, .ysm-project input { background: #0d1226; color: #e8eaf6; border: 1px solid #3a4070; padding: 4px 8px; border-radius: 6px; font-size: 12px; }
    .ysm-project-name { width: 130px; }
    .ysm-room-key { width: 110px; font-family: monospace; color: #86efac; }
    .ysm-scenes button { background: #1a2040; color: #e8eaf6; border: 1px solid #3a4070; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
    .ysm-scenes button:hover:not(:disabled) { background: #2a3070; }
    .ysm-scenes button:disabled { opacity: 0.4; cursor: not-allowed; }
    .ysm-mode { margin-left: auto; }
    .ysm-mode button { background: rgba(20,25,50,0.7); color: #e8eaf6; border: 1px solid #3b3f55; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; }
    .ysm-mode button.active { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .ysm-actions button { background: rgba(40,30,5,0.7); color: #fbbf24; border: 1px solid #b89240; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; }
    .ysm-actions button:hover { background: rgba(251,191,36,0.3); }
    .ysm-import-btn { background: rgba(20,80,40,0.7) !important; color: #86efac !important; border-color: #15803d !important; }

    /* ═══ MAIN AREA — Grid 3 cols ═══ */
    .ysm-main { flex: 1; display: grid; grid-template-columns: 280px 1fr 340px; min-height: 0; }
    .ysm-main[data-mode="preview"] { grid-template-columns: 1fr; }

    /* ═══ SIDEBARS ═══ */
    .ysm-left, .ysm-right { background: #0c1224; overflow-y: auto; padding: 10px; border-right: 1px solid #1f2540; }
    .ysm-right { border-right: none; border-left: 1px solid #1f2540; }
    .ysm-panel { background: rgba(20,25,50,0.6); border: 1px solid #2a3055; border-radius: 10px; padding: 10px; margin-bottom: 10px; }
    .ysm-panel-title { font-size: 10px; font-weight: 800; letter-spacing: 1.5px; color: #fbbf24; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }

    /* Library */
    .ysm-lib-tabs { display: flex; gap: 2px; margin-bottom: 8px; }
    .ysm-lib-tabs button { flex: 1; background: rgba(0,0,0,0.4); color: #e8eaf6; border: 1px solid #2a3055; padding: 4px; border-radius: 6px; cursor: pointer; font-size: 11px; }
    .ysm-lib-tabs button.active { background: #fbbf24; color: #1a1500; border-color: #fbbf24; }
    .ysm-lib-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
    .ysm-lib-item { background: rgba(30,40,80,0.4); color: #e8eaf6; border: 1px solid #2a3055; padding: 6px 4px; border-radius: 8px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .ysm-lib-item:hover { background: rgba(60,80,150,0.5); transform: scale(1.05); }
    .ysm-lib-icon { font-size: 22px; }
    .ysm-lib-name { font-size: 9px; text-align: center; opacity: 0.85; }

    /* Hierarchy */
    .ysm-hierarchy { max-height: 240px; overflow-y: auto; }
    .ysm-hint { font-size: 11px; opacity: 0.6; text-align: center; padding: 12px; }
    .ysm-hier-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; cursor: pointer; margin-bottom: 2px; font-size: 12px; }
    .ysm-hier-item:hover { background: rgba(60,80,150,0.3); }
    .ysm-hier-item.is-selected { background: rgba(251,191,36,0.2); border: 1px solid #fbbf24; }
    .ysm-hier-icon { font-size: 14px; }
    .ysm-hier-name { flex: 1; }
    .ysm-hier-tag { font-size: 12px; opacity: 0.8; }
    .ysm-hier-del { background: transparent; border: none; color: #ef4444; cursor: pointer; opacity: 0.6; padding: 0 4px; }
    .ysm-hier-del:hover { opacity: 1; }

    /* Load room */
    .ysm-load-room-btn { width: 100%; background: rgba(20,80,40,0.7); color: #86efac; border: 1px solid #15803d; padding: 6px; border-radius: 6px; margin-top: 6px; cursor: pointer; font-size: 12px; font-weight: 600; }
    .ysm-load-room-btn:hover:not(:disabled) { background: rgba(20,128,61,0.6); }
    .ysm-load-room-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ═══ VIEWPORT ═══ */
    .ysm-viewport { position: relative; background: #06091a; }
    .ysm-viewport canvas { display: block; width: 100%; height: 100%; }
    .ysm-drag-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #86efac; background: rgba(20,80,40,0.4); border: 3px dashed #15803d; pointer-events: none; }
    .ysm-viewport-hud { position: absolute; top: 8px; left: 8px; right: 8px; display: flex; justify-content: space-between; pointer-events: none; }
    .ysm-vp-info, .ysm-vp-shortcuts { background: rgba(0,0,0,0.6); padding: 4px 10px; border-radius: 6px; font-size: 10px; display: flex; gap: 10px; }
    .ysm-vp-shortcuts kbd { background: rgba(255,255,255,0.15); padding: 1px 5px; border-radius: 3px; font-family: monospace; }

    /* ═══ INSPECTOR ═══ */
    .ysm-empty { text-align: center; padding: 30px 16px; opacity: 0.7; }
    .ysm-empty-icon { font-size: 48px; margin-bottom: 8px; }
    .ysm-empty small { display: block; margin-top: 8px; opacity: 0.7; font-size: 11px; }
    .ysm-insp-head { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; }
    .ysm-insp-icon { font-size: 20px; }
    .ysm-insp-name { flex: 1; background: rgba(0,0,0,0.4); color: #e8eaf6; border: 1px solid #2a3055; padding: 4px 8px; border-radius: 6px; font-weight: 700; }
    .ysm-insp-field { margin-bottom: 12px; padding: 8px; background: rgba(0,0,0,0.3); border-left: 2px solid #fbbf24; border-radius: 6px; }
    .ysm-insp-field label { font-size: 11px; font-weight: 700; color: #fbbf24; display: block; margin-bottom: 4px; }
    .ysm-insp-field input { width: 100%; background: rgba(0,0,0,0.4); color: #86efac; border: 1px solid #2a3055; padding: 4px 8px; border-radius: 6px; font-family: monospace; }
    .ysm-insp-field small { display: block; margin-top: 4px; opacity: 0.6; font-size: 10px; }
    .ysm-insp-section { margin-bottom: 12px; }
    .ysm-section-title { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #93c5fd; margin-bottom: 6px; }
    .ysm-vec3 { display: grid; grid-template-columns: 50px 1fr 1fr 1fr; gap: 4px; margin-bottom: 4px; align-items: center; }
    .ysm-vec3 label { font-size: 10px; opacity: 0.7; }
    .ysm-vec3 input { background: rgba(0,0,0,0.4); color: #e8eaf6; border: 1px solid #2a3055; padding: 3px 5px; border-radius: 4px; font-family: monospace; font-size: 11px; width: 100%; }
    .ysm-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
    .ysm-row label { font-size: 11px; opacity: 0.8; min-width: 60px; }
    .ysm-row input[type="text"], .ysm-row textarea, .ysm-row select { flex: 1; background: rgba(0,0,0,0.4); color: #e8eaf6; border: 1px solid #2a3055; padding: 3px 6px; border-radius: 4px; font-size: 12px; font-family: inherit; }
    .ysm-row.col { flex-direction: column; align-items: stretch; }
    .ysm-row.col label { min-width: auto; margin-bottom: 4px; }
    .ysm-row textarea { resize: vertical; min-height: 50px; }
    .ysm-row input[type="range"] { flex: 1; }
    .ysm-row input[type="color"] { width: 40px; height: 24px; border: 1px solid #2a3055; border-radius: 4px; }
    .ysm-row span { font-size: 11px; opacity: 0.7; font-family: monospace; }
    .ysm-insp-actions { display: flex; gap: 4px; margin-top: 10px; }
    .ysm-insp-actions button { flex: 1; background: rgba(40,30,5,0.7); color: #fbbf24; border: 1px solid #b89240; padding: 5px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; }
    .ysm-insp-actions button.danger { background: rgba(80,20,20,0.6); color: #fca5a5; border-color: #991b1b; }
    .ysm-insp-actions button:hover { background: rgba(251,191,36,0.3); }

    /* ═══ TUTORIAL BUILDER ═══ */
    .ysm-mini-add, .ysm-mini-del { background: transparent; border: 1px solid currentColor; border-radius: 4px; cursor: pointer; padding: 0 6px; font-weight: 700; }
    .ysm-mini-add { color: #86efac; }
    .ysm-mini-del { color: #ef4444; }
    .ysm-glos-entry, .ysm-tour-step { background: rgba(0,0,0,0.3); border: 1px solid #2a3055; border-radius: 8px; padding: 8px; margin-bottom: 6px; }
    .ysm-glos-entry summary, .ysm-tour-step summary { display: flex; gap: 6px; align-items: center; cursor: pointer; padding: 4px; }
    .ysm-glos-id, .ysm-step-num { background: #fbbf24; color: #1a1500; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; font-weight: 700; }
    .ysm-glos-name, .ysm-step-text { flex: 1; font-size: 11px; opacity: 0.85; }
    .ysm-snap-cam { background: rgba(20,40,80,0.7); color: #93c5fd; border: 1px solid #60a5fa; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; }
    .ysm-test-tour, .ysm-export-json { width: 100%; background: #fbbf24; color: #1a1500; border: 1px solid #fbbf24; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 800; }
    .ysm-test-tour:hover, .ysm-export-json:hover { background: #f5b923; }

  `]
})
export class YamzyStudioMakerComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('importInput') importInputEl?: ElementRef<HTMLInputElement>;

  // ═══════════════════════════════════════════════════════════════════
  // STATE signals
  // ═══════════════════════════════════════════════════════════════════
  mode = signal<'edit' | 'tutorial' | 'preview'>('edit');
  libTab = signal<'primitive' | 'light' | 'yamzy'>('yamzy');
  projectName = signal<string>('Mon Yamzy Studio');
  roomKey = signal<string>('my-room');
  loadRoomKey = signal<string>('');
  scenes = signal<SceneConfig[]>([]);
  activeSceneId = signal<string>('');
  selectedId = signal<string | null>(null);
  dragHover = signal<boolean>(false);
  fps = signal<number>(0);
  status = signal<string>('Prêt');
  tutorial = signal<RoomTutorial>(this.makeEmptyTutorial());

  activeScene = computed(() => this.scenes().find(s => s.id === this.activeSceneId()));
  selectedObject = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.activeScene()?.objects.find(o => o.id === id) || null;
  });

  // 🔧 FIX BUG #2 : Pour les Groups (Crystal, Tree, etc.), on cherche le premier Mesh enfant avec un material
  // 🔧 FIX BUG #3 : refreshTick incremented quand transform change → forces re-computation des computed signals
  refreshTick = signal<number>(0);

  private findMeshWithMaterial(obj: any): any {
    if (!obj) return null;
    if (obj.isMesh && obj.material?.color) return obj;
    if (obj.children) {
      for (const c of obj.children) {
        const found = this.findMeshWithMaterial(c);
        if (found) return found;
      }
    }
    return null;
  }

  selectedHasMaterial = computed(() => {
    this.refreshTick();  // dependency for re-computation
    return !!this.findMeshWithMaterial(this.selectedObject()?.three);
  });
  materialColor = computed(() => {
    this.refreshTick();
    const m = this.findMeshWithMaterial(this.selectedObject()?.three);
    return m?.material?.color ? '#' + m.material.color.getHexString() : '#ffffff';
  });
  materialEmissive = computed(() => {
    this.refreshTick();
    const m = this.findMeshWithMaterial(this.selectedObject()?.three);
    return m?.material?.emissive ? '#' + m.material.emissive.getHexString() : '#000000';
  });
  materialEmissiveIntensity = computed(() => {
    this.refreshTick();
    return this.findMeshWithMaterial(this.selectedObject()?.three)?.material?.emissiveIntensity ?? 0;
  });
  materialMetalness = computed(() => {
    this.refreshTick();
    return this.findMeshWithMaterial(this.selectedObject()?.three)?.material?.metalness ?? 0;
  });
  materialRoughness = computed(() => {
    this.refreshTick();
    return this.findMeshWithMaterial(this.selectedObject()?.three)?.material?.roughness ?? 0.5;
  });
  materialOpacity = computed(() => {
    this.refreshTick();
    return this.findMeshWithMaterial(this.selectedObject()?.three)?.material?.opacity ?? 1;
  });

  // Computed pour transform reactif au drag du gizmo
  selectedPos = computed(() => {
    this.refreshTick();
    const o = this.selectedObject()?.three;
    return { x: o?.position?.x ?? 0, y: o?.position?.y ?? 0, z: o?.position?.z ?? 0 };
  });
  selectedRot = computed(() => {
    this.refreshTick();
    const o = this.selectedObject()?.three;
    return { x: o?.rotation?.x ?? 0, y: o?.rotation?.y ?? 0, z: o?.rotation?.z ?? 0 };
  });
  selectedScl = computed(() => {
    this.refreshTick();
    const o = this.selectedObject()?.three;
    return { x: o?.scale?.x ?? 1, y: o?.scale?.y ?? 1, z: o?.scale?.z ?? 1 };
  });

  taggedTutorialIds = computed(() => {
    const set = new Set<string>();
    this.activeScene()?.objects.forEach(o => { if (o.tutorialId) set.add(o.tutorialId); });
    return Array.from(set);
  });

  // Liste des rooms existantes éditables
  existingRooms = [
    { key: 'conclave',           name: 'Conclave VESPER',     icon: '💎' },
    { key: 'git-tree-room',      name: 'Git Tree Room',        icon: '🌳' },
    { key: 'kanban-island',      name: 'Kanban Island',        icon: '🏝' },
    { key: 'pr-mirror-hall',     name: 'PR Mirror Hall',       icon: '🪞' },
    { key: 'phoenix-forge',      name: 'Phoenix Forge',        icon: '🔥' },
    { key: 'okr-mountain',       name: 'OKR Mountain',         icon: '⛰' },
    { key: 'library-cathedral',  name: 'Library Cathedral',    icon: '🏛' },
    { key: 'star-map-risks',     name: 'Star Map Risks',       icon: '🌌' },
    { key: 'oracle-aquarium',    name: 'Oracle Aquarium',      icon: '🐠' },
    { key: 'alchemist-cellar',   name: 'Alchemist Cellar',     icon: '⚗' },
    { key: 'card-tavern',        name: 'Card Tavern',          icon: '🎴' },
  ];

  // ═══════════════════════════════════════════════════════════════════
  // THREE.js refs
  // ═══════════════════════════════════════════════════════════════════
  private THREE: any;
  private GLTFLoader: any;
  private GLTFExporter: any;
  private scene: any;
  private camera: any;
  private renderer: any;
  private controls: any;
  private transformControls: any;
  private raycaster: any;
  private mouse: any;
  private gridHelper: any;
  private axesHelper: any;
  private clock: any;
  private rafId: number = 0;
  private disposed = false;
  private clickHandler: any;
  private keyHandler: any;
  private fpsTimer = 0;
  private fpsFrames = 0;
  private nextId = 1;

  narrator = inject(NarratorService);
  private spellFooter = inject(SpellFooterService);

  constructor() {
    // 🪄 Footer global : reflète status + mode courant (drag-drop GLB + raccourcis G/R/S)
    effect(() => {
      const m = this.mode();
      const st = this.status();
      this.spellFooter.setSlots({
        accent: '#fbbf24',
        controls: [],
        hint: `${st} · Drag-drop GLB${m === 'edit' ? ' · G/R/S = move/rot/scale' : ''}`,
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════
  ngOnInit() {
    // Init scene par défaut
    const s = this.makeEmptyScene();
    this.scenes.set([s]);
    this.activeSceneId.set(s.id);
    // Try to load previously saved project
    this.loadProject();
    // Boot Three.js
    this.bootstrap();
  }

  ngOnDestroy() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.renderer) this.renderer.dispose();
    if (this.clickHandler && this.canvasEl?.nativeElement) {
      this.canvasEl.nativeElement.removeEventListener('click', this.clickHandler);
    }
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('resize', this.onResize);
    this.spellFooter.clearSlots();
  }

  private async bootstrap() {
    await this.ensureThreeJS();
    if (this.disposed) return;
    this.init3D();
    this.rebuildSceneObjects();
  }

  private async ensureThreeJS() {
    if (!(window as any).THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    if (!(window as any).THREE?.OrbitControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
    if (!(window as any).THREE?.TransformControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js');
    }
    if (!(window as any).THREE?.GLTFLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    }
    if (!(window as any).THREE?.GLTFExporter) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js');
    }
    this.THREE = (window as any).THREE;
    this.GLTFLoader = (window as any).THREE.GLTFLoader;
    this.GLTFExporter = (window as any).THREE.GLTFExporter;
  }
  private loadScript(src: string): Promise<void> {
    return new Promise(r => {
      const s = document.createElement('script'); s.src = src;
      s.onload = () => r(); s.onerror = () => r();
      document.head.appendChild(s);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3D SCENE INIT
  // ═══════════════════════════════════════════════════════════════════
  private init3D() {
    const T = this.THREE;
    const canvas = this.canvasEl.nativeElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x06091a);
    this.scene.fog = new T.FogExp2(0x06091a, 0.012);

    this.camera = new T.PerspectiveCamera(45, w / h, 0.1, 200);
    this.camera.position.set(8, 8, 12);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lights de base
    this.scene.add(new T.AmbientLight(0xffffff, 0.4));
    const dir = new T.DirectionalLight(0xffffff, 0.7);
    dir.position.set(10, 14, 8);
    this.scene.add(dir);

    // Grid + axes
    this.gridHelper = new T.GridHelper(30, 30, 0x3a4080, 0x1f2540);
    this.scene.add(this.gridHelper);
    this.axesHelper = new T.AxesHelper(3);
    this.scene.add(this.axesHelper);

    // OrbitControls
    if (T.OrbitControls) {
      this.controls = new T.OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
    }

    // TransformControls
    if (T.TransformControls) {
      this.transformControls = new T.TransformControls(this.camera, canvas);
      this.transformControls.addEventListener('dragging-changed', (e: any) => {
        if (this.controls) this.controls.enabled = !e.value;
      });
      // 🔧 FIX BUG #3 : sync inputs Position/Rotation/Scale pendant drag gizmo
      this.transformControls.addEventListener('change', () => {
        this.refreshTick.update(n => n + 1);
      });
      this.scene.add(this.transformControls);
    }

    // Raycaster pour clic
    this.raycaster = new T.Raycaster();
    this.mouse = new T.Vector2();
    this.clickHandler = (e: MouseEvent) => this.onCanvasClick(e);
    canvas.addEventListener('click', this.clickHandler);

    // Keyboard shortcuts
    this.keyHandler = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('keydown', this.keyHandler);

    this.clock = new T.Clock();
    window.addEventListener('resize', this.onResize);

    console.log('[StudioMaker] 🏗 Three.js init done');
    this.animate();
  }

  // ═══════════════════════════════════════════════════════════════════
  // LIBRARY of templates (primitives + lights + yamzy iconic)
  // ═══════════════════════════════════════════════════════════════════
  templates: LibraryTemplate[] = [
    // Primitives
    { key: 'sphere',       category: 'primitive', icon: '🔵', name: 'Sphère',     build: T => new T.Mesh(new T.SphereGeometry(1, 32, 24), this.std(T, 0x60a5fa)) },
    { key: 'cube',         category: 'primitive', icon: '🟦', name: 'Cube',       build: T => new T.Mesh(new T.BoxGeometry(1.5, 1.5, 1.5), this.std(T, 0x86efac)) },
    { key: 'cone',         category: 'primitive', icon: '🔺', name: 'Cône',       build: T => new T.Mesh(new T.ConeGeometry(0.8, 1.6, 16), this.std(T, 0xfbbf24)) },
    { key: 'cylinder',     category: 'primitive', icon: '⚪', name: 'Cylindre',   build: T => new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1.5, 16), this.std(T, 0xf472b6)) },
    { key: 'torus',        category: 'primitive', icon: '⭕', name: 'Tore',       build: T => new T.Mesh(new T.TorusGeometry(1, 0.25, 12, 24), this.std(T, 0xa855f7)) },
    { key: 'icosa',        category: 'primitive', icon: '💠', name: 'Icosaèdre',  build: T => new T.Mesh(new T.IcosahedronGeometry(1, 0), this.std(T, 0xea580c)) },
    { key: 'plane',        category: 'primitive', icon: '▭', name: 'Plan',       build: T => { const m = new T.Mesh(new T.PlaneGeometry(2, 2), this.std(T, 0x6b7280)); m.rotation.x = -Math.PI / 2; return m; } },
    { key: 'ring',         category: 'primitive', icon: '⭘', name: 'Anneau',     build: T => { const m = new T.Mesh(new T.RingGeometry(0.8, 1.2, 32), this.std(T, 0x84cc16)); m.rotation.x = -Math.PI / 2; return m; } },
    // Lights
    { key: 'pointlight',   category: 'light', icon: '💡', name: 'Point Light',   build: T => { const l = new T.PointLight(0xffffff, 1, 10); l.position.y = 2; return l; } },
    { key: 'dirlight',     category: 'light', icon: '☀',  name: 'Direct. Light', build: T => { const l = new T.DirectionalLight(0xffffff, 1); l.position.set(5, 8, 3); return l; } },
    { key: 'ambient',      category: 'light', icon: '🌤', name: 'Ambient Light', build: T => new T.AmbientLight(0xffffff, 0.6) },
    { key: 'spotlight',    category: 'light', icon: '🔦', name: 'Spot Light',    build: T => { const l = new T.SpotLight(0xffffff, 1, 15, 0.4); l.position.y = 5; return l; } },
    // Yamzy iconic templates
    { key: 'crystal',      category: 'yamzy', icon: '💎', name: 'Crystal',       build: T => this.buildCrystal(T) },
    { key: 'tree',         category: 'yamzy', icon: '🌳', name: 'Arbre',         build: T => this.buildTree(T) },
    { key: 'mountain',     category: 'yamzy', icon: '⛰', name: 'Montagne',      build: T => this.buildMountain(T) },
    { key: 'flame',        category: 'yamzy', icon: '🔥', name: 'Flamme',        build: T => this.buildFlame(T) },
    { key: 'mushroom',     category: 'yamzy', icon: '🍄', name: 'Champignon',    build: T => this.buildMushroom(T) },
    { key: 'fish',         category: 'yamzy', icon: '🐠', name: 'Poisson',       build: T => this.buildFish(T) },
    { key: 'star-burst',   category: 'yamzy', icon: '⭐', name: 'Étoile',        build: T => this.buildStarBurst(T) },
    { key: 'mirror',       category: 'yamzy', icon: '🪞', name: 'Miroir',        build: T => this.buildMirror(T) },
    { key: 'fiole',        category: 'yamzy', icon: '⚗', name: 'Fiole',         build: T => this.buildFiole(T) },
    { key: 'card',         category: 'yamzy', icon: '🎴', name: 'Carte',         build: T => this.buildCard(T) },
    { key: 'book',         category: 'yamzy', icon: '📖', name: 'Livre',         build: T => this.buildBook(T) },
    { key: 'ring-orbit',   category: 'yamzy', icon: '🪐', name: 'Anneau orbital',build: T => this.buildOrbitalRing(T) },
  ];

  libraryForTab() { return this.templates.filter(t => t.category === this.libTab()); }

  templateIcon(key: string): string {
    return this.templates.find(t => t.key === key)?.icon || '◾';
  }

  private std(T: any, color: number) {
    return new T.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  }

  // ─── Yamzy iconic builders (mini versions des rooms) ───
  private buildCrystal(T: any): any {
    const g = new T.Group();
    const c = new T.Mesh(new T.IcosahedronGeometry(0.9, 0), new T.MeshStandardMaterial({ color: 0xe0115f, emissive: 0xff3366, emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.15 }));
    g.add(c);
    return g;
  }
  private buildTree(T: any): any {
    const g = new T.Group();
    const trunk = new T.Mesh(new T.CylinderGeometry(0.18, 0.22, 1.6, 8), new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.95 }));
    trunk.position.y = 0.8;
    g.add(trunk);
    const leaves = new T.Mesh(new T.IcosahedronGeometry(0.7, 0), new T.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x4ade80, emissiveIntensity: 0.2 }));
    leaves.position.y = 1.8;
    g.add(leaves);
    return g;
  }
  private buildMountain(T: any): any {
    const g = new T.Group();
    const peak = new T.Mesh(new T.ConeGeometry(1.2, 2, 8), new T.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.95 }));
    peak.position.y = 1;
    g.add(peak);
    const snow = new T.Mesh(new T.ConeGeometry(0.4, 0.6, 8), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2 }));
    snow.position.y = 1.9;
    g.add(snow);
    return g;
  }
  private buildFlame(T: any): any {
    const g = new T.Group();
    const flame = new T.Mesh(new T.ConeGeometry(0.4, 1.2, 8), new T.MeshStandardMaterial({ color: 0xea580c, emissive: 0xea580c, emissiveIntensity: 1 }));
    flame.position.y = 0.6;
    g.add(flame);
    const tip = new T.Mesh(new T.ConeGeometry(0.2, 0.5, 8), new T.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.2 }));
    tip.position.y = 1.3;
    g.add(tip);
    return g;
  }
  private buildMushroom(T: any): any {
    const g = new T.Group();
    const stem = new T.Mesh(new T.CylinderGeometry(0.1, 0.13, 0.4, 8), new T.MeshStandardMaterial({ color: 0xfae6c0 }));
    stem.position.y = 0.2;
    g.add(stem);
    const cap = new T.Mesh(new T.SphereGeometry(0.3, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x551111, emissiveIntensity: 0.3 }));
    cap.position.y = 0.4;
    g.add(cap);
    return g;
  }
  private buildFish(T: any): any {
    const g = new T.Group();
    const body = new T.Mesh(new T.ConeGeometry(0.2, 0.7, 8), new T.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.6 }));
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const tail = new T.Mesh(new T.ConeGeometry(0.18, 0.25, 6), new T.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.6 }));
    tail.rotation.z = -Math.PI / 2;
    tail.position.x = -0.4;
    g.add(tail);
    return g;
  }
  private buildStarBurst(T: any): any {
    const g = new T.Group();
    const core = new T.Mesh(new T.SphereGeometry(0.3, 16, 12), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 }));
    g.add(core);
    for (let i = 0; i < 6; i++) {
      const ray = new T.Mesh(new T.ConeGeometry(0.05, 0.6, 4), new T.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.9 }));
      const a = (i / 6) * Math.PI * 2;
      ray.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
      ray.lookAt(Math.cos(a) * 2, 0, Math.sin(a) * 2);
      g.add(ray);
    }
    return g;
  }
  private buildMirror(T: any): any {
    const g = new T.Group();
    const frame = new T.Mesh(new T.BoxGeometry(0.7, 1.1, 0.08), new T.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.95, roughness: 0.15 }));
    g.add(frame);
    const surface = new T.Mesh(new T.PlaneGeometry(0.55, 0.95), new T.MeshStandardMaterial({ color: 0xa3e9ff, emissive: 0xa3e9ff, emissiveIntensity: 0.4, metalness: 0.9, roughness: 0.05 }));
    surface.position.z = 0.045;
    g.add(surface);
    return g;
  }
  private buildFiole(T: any): any {
    const g = new T.Group();
    const glass = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.7, 16), new T.MeshPhysicalMaterial({ color: 0xa3e9ff, transmission: 0.85, transparent: true, opacity: 0.4, metalness: 0.1, roughness: 0.05 }));
    glass.position.y = 0.35;
    g.add(glass);
    const liquid = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.4, 16), new T.MeshStandardMaterial({ color: 0x84cc16, emissive: 0x84cc16, emissiveIntensity: 0.6 }));
    liquid.position.y = 0.2;
    g.add(liquid);
    const cork = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.12, 12), new T.MeshStandardMaterial({ color: 0x6b4423 }));
    cork.position.y = 0.76;
    g.add(cork);
    return g;
  }
  private buildCard(T: any): any {
    const card = new T.Mesh(new T.BoxGeometry(0.7, 1, 0.04), new T.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.3 }));
    return card;
  }
  private buildBook(T: any): any {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(0.4, 0.6, 0.12), new T.MeshStandardMaterial({ color: 0x0891b2 }));
    g.add(body);
    const pages = new T.Mesh(new T.BoxGeometry(0.36, 0.56, 0.13), new T.MeshStandardMaterial({ color: 0xfaf0e6 }));
    g.add(pages);
    return g;
  }
  private buildOrbitalRing(T: any): any {
    const g = new T.Group();
    const ring = new T.Mesh(new T.TorusGeometry(1.5, 0.04, 8, 64), new T.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.5, metalness: 0.8 }));
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    const planet = new T.Mesh(new T.SphereGeometry(0.18, 16, 12), new T.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x60a5fa, emissiveIntensity: 0.6 }));
    planet.position.set(1.5, 0, 0);
    g.add(planet);
    return g;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ADD / SELECT / DELETE / DUPLICATE
  // ═══════════════════════════════════════════════════════════════════
  addFromTemplate(t: LibraryTemplate) {
    const T = this.THREE;
    if (!T) return;
    const three = t.build(T);
    three.position.y = three.position.y || 0;
    this.scene.add(three);
    const id = 'obj-' + (this.nextId++);
    const meta: ObjectMeta = {
      id, name: `${t.icon} ${t.name} ${this.nextId}`,
      templateKey: t.key,
      three,
    };
    three.userData.metaId = id;
    this.scenes.update(arr => {
      const s = arr.find(s => s.id === this.activeSceneId());
      if (s) s.objects = [...s.objects, meta];
      return [...arr];
    });
    this.selectObject(id);
    this.status.set(`+ ${t.name} ajouté`);
  }

  selectObject(id: string) {
    this.selectedId.set(id);
    const obj = this.activeScene()?.objects.find(o => o.id === id);
    if (obj?.three && this.transformControls) {
      this.transformControls.attach(obj.three);
    }
  }

  deleteObject(id: string) {
    const s = this.activeScene();
    if (!s) return;
    const obj = s.objects.find(o => o.id === id);
    if (obj) {
      this.scene.remove(obj.three);
      this.disposeObject(obj.three);
    }
    s.objects = s.objects.filter(o => o.id !== id);
    this.scenes.set([...this.scenes()]);
    if (this.selectedId() === id) {
      this.selectedId.set(null);
      this.transformControls?.detach();
    }
    this.status.set('Objet supprimé');
  }
  private disposeObject(obj: any) {
    obj.traverse?.((c: any) => {
      if (c.geometry) c.geometry.dispose?.();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach((m: any) => m.dispose?.());
        else c.material.dispose?.();
      }
    });
  }

  duplicateObject(id: string) {
    const o = this.activeScene()?.objects.find(x => x.id === id);
    if (!o) return;
    const clone = o.three.clone(true);
    clone.position.x += 1.5;
    this.scene.add(clone);
    const nid = 'obj-' + (this.nextId++);
    const meta: ObjectMeta = { id: nid, name: o.name + ' copy', templateKey: o.templateKey, three: clone, tutorialId: o.tutorialId };
    clone.userData.metaId = nid;
    this.scenes.update(arr => {
      const s = arr.find(s => s.id === this.activeSceneId());
      if (s) s.objects = [...s.objects, meta];
      return [...arr];
    });
    this.selectObject(nid);
  }

  focusObject(id: string) {
    const obj = this.activeScene()?.objects.find(x => x.id === id);
    if (!obj || !this.controls) return;
    this.controls.target.copy(obj.three.position);
    this.camera.position.set(obj.three.position.x + 5, obj.three.position.y + 4, obj.three.position.z + 5);
  }

  renameObject(id: string, name: string) {
    this.scenes.update(arr => {
      const s = arr.find(s => s.id === this.activeSceneId());
      if (s) {
        const o = s.objects.find(o => o.id === id);
        if (o) o.name = name;
      }
      return [...arr];
    });
  }

  setTutorialId(id: string, tid: string) {
    this.scenes.update(arr => {
      const s = arr.find(s => s.id === this.activeSceneId());
      if (s) {
        const o = s.objects.find(o => o.id === id);
        if (o) {
          o.tutorialId = tid;
          o.three.userData.tutorialId = tid;
        }
      }
      return [...arr];
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // TRANSFORM + MATERIAL updates depuis inspector
  // ═══════════════════════════════════════════════════════════════════
  updateTransform(prop: 'position' | 'rotation' | 'scale', axis: 'x' | 'y' | 'z', value: any) {
    const obj = this.selectedObject()?.three;
    if (!obj) return;
    obj[prop][axis] = +value;
    this.refreshTick.update(n => n + 1);
  }

  updateMaterial(prop: string, value: any) {
    // 🔧 FIX : trouve le Mesh enfant qui a un material (cas des Groups Yamzy)
    const mesh = this.findMeshWithMaterial(this.selectedObject()?.three);
    if (!mesh?.material) return;
    if (prop === 'color' || prop === 'emissive') {
      const T = this.THREE;
      mesh.material[prop] = new T.Color(value);
    } else {
      mesh.material[prop] = +value;
      if (prop === 'opacity') {
        mesh.material.transparent = +value < 1;
      }
    }
    mesh.material.needsUpdate = true;
    this.refreshTick.update(n => n + 1);
  }

  updateSceneMeta(prop: string, value: any) {
    const s = this.activeScene();
    if (!s) return;
    (s as any)[prop] = value;
    if (prop === 'bgColor' && this.scene) {
      this.scene.background = new this.THREE.Color(value);
    }
    if (prop === 'fogDensity' && this.scene?.fog) {
      this.scene.fog.density = +value;
    }
    this.scenes.set([...this.scenes()]);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SCENES MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════
  private makeEmptyScene(): SceneConfig {
    return {
      id: 'scene-' + Math.random().toString(36).slice(2, 8),
      name: 'Scene ' + (this.scenes?.()?.length + 1 || 1),
      bgColor: '#06091a',
      fogDensity: 0.012,
      objects: [],
    };
  }

  addScene() {
    const s = this.makeEmptyScene();
    this.scenes.update(arr => [...arr, s]);
    this.switchScene(s.id);
  }
  duplicateScene() {
    const cur = this.activeScene();
    if (!cur) return;
    const newScene: SceneConfig = {
      ...cur,
      id: 'scene-' + Math.random().toString(36).slice(2, 8),
      name: cur.name + ' copy',
      objects: [],  // les Three objects seront recréés via switchScene → rebuildSceneObjects
    };
    this.scenes.update(arr => [...arr, newScene]);
    this.switchScene(newScene.id);
  }
  deleteScene() {
    if (this.scenes().length <= 1) return;
    const id = this.activeSceneId();
    const cur = this.activeScene();
    if (cur) {
      for (const o of cur.objects) {
        this.scene.remove(o.three);
        this.disposeObject(o.three);
      }
    }
    const remaining = this.scenes().filter(s => s.id !== id);
    this.scenes.set(remaining);
    this.switchScene(remaining[0].id);
  }
  switchScene(id: string) {
    // Remove current scene objects from Three.scene
    const cur = this.activeScene();
    if (cur) {
      for (const o of cur.objects) this.scene.remove(o.three);
    }
    this.activeSceneId.set(id);
    this.selectedId.set(null);
    this.transformControls?.detach();
    this.rebuildSceneObjects();
  }
  private rebuildSceneObjects() {
    const s = this.activeScene();
    if (!s || !this.scene) return;
    for (const o of s.objects) this.scene.add(o.three);
    if (this.scene) {
      this.scene.background = new this.THREE.Color(s.bgColor);
      if (this.scene.fog) this.scene.fog.density = s.fogDensity;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GLB IMPORT (drag-drop OR file picker)
  // ═══════════════════════════════════════════════════════════════════
  onDragOver(e: DragEvent) { e.preventDefault(); this.dragHover.set(true); }
  onFileDrop(e: DragEvent) {
    e.preventDefault();
    this.dragHover.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.importFile(file);
  }
  triggerImportFile() {
    this.importInputEl?.nativeElement?.click();
  }
  onImportFile(e: any) {
    const file = e.target?.files?.[0];
    if (file) this.importFile(file);
    e.target.value = '';
  }

  async importFile(file: File) {
    this.status.set(`Import ${file.name}...`);
    const reader = new FileReader();
    if (file.name.endsWith('.json')) {
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (data.tour && data.glossary) {
            this.tutorial.set(data);
            this.status.set('Tutorial JSON importé');
            this.mode.set('tutorial');
          } else {
            this.status.set('Format JSON inconnu');
          }
        } catch (err) {
          this.status.set('Erreur JSON');
        }
      };
      reader.readAsText(file);
    } else {
      // GLB / GLTF
      const url = URL.createObjectURL(file);
      const loader = new this.GLTFLoader();
      loader.load(url, (gltf: any) => {
        const root = gltf.scene;
        this.scene.add(root);
        const id = 'obj-' + (this.nextId++);
        const meta: ObjectMeta = { id, name: '📦 ' + file.name, templateKey: 'glb-import', three: root };
        root.userData.metaId = id;
        this.scenes.update(arr => {
          const s = arr.find(s => s.id === this.activeSceneId());
          if (s) s.objects = [...s.objects, meta];
          return [...arr];
        });
        this.selectObject(id);
        this.status.set(`GLB ${file.name} importé`);
        URL.revokeObjectURL(url);
      }, undefined, () => this.status.set(`Erreur import ${file.name}`));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GLB EXPORT
  // ═══════════════════════════════════════════════════════════════════
  exportGLB() {
    if (!this.GLTFExporter) { this.status.set('GLTFExporter non chargé'); return; }
    const exporter = new this.GLTFExporter();
    const exportRoot = new this.THREE.Group();
    for (const o of (this.activeScene()?.objects || [])) {
      exportRoot.add(o.three.clone(true));
    }
    exporter.parse(exportRoot, (result: any) => {
      const blob = new Blob([result], { type: 'application/octet-stream' });
      this.downloadBlob(blob, `${this.roomKey()}-scene.glb`);
      this.status.set('✓ GLB exporté');
    }, { binary: true });
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SAVE / LOAD project localStorage
  // ═══════════════════════════════════════════════════════════════════
  saveProject() {
    // Serialize each scene (only positions/material params, NOT THREE objects)
    const serialScenes = this.scenes().map(s => ({
      id: s.id, name: s.name, bgColor: s.bgColor, fogDensity: s.fogDensity,
      objects: s.objects.map(o => ({
        id: o.id, name: o.name, templateKey: o.templateKey, tutorialId: o.tutorialId,
        pos: [o.three.position.x, o.three.position.y, o.three.position.z],
        rot: [o.three.rotation.x, o.three.rotation.y, o.three.rotation.z],
        scl: [o.three.scale.x, o.three.scale.y, o.three.scale.z],
        col: o.three.material?.color ? o.three.material.color.getHex() : null,
        emi: o.three.material?.emissive ? o.three.material.emissive.getHex() : null,
        ei:  o.three.material?.emissiveIntensity ?? null,
        met: o.three.material?.metalness ?? null,
        rou: o.three.material?.roughness ?? null,
      })),
    }));
    const proj: any = {
      name: this.projectName(), roomKey: this.roomKey(),
      scenes: serialScenes, tutorial: this.tutorial(), savedAt: Date.now(),
    };
    localStorage.setItem('yamzy-studio-maker', JSON.stringify(proj));
    this.status.set('💾 Projet sauvegardé (' + serialScenes.reduce((n,s)=>n+s.objects.length,0) + ' objets)');
  }

  loadProject() {
    const raw = localStorage.getItem('yamzy-studio-maker');
    if (!raw) return;
    try {
      const proj = JSON.parse(raw);
      this.projectName.set(proj.name || 'Mon Studio');
      this.roomKey.set(proj.roomKey || 'my-room');
      if (proj.tutorial) this.tutorial.set(proj.tutorial);
      // Reconstruct scenes (THREE objects from templates)
      this.scenes.set(proj.scenes.map((s: any) => ({
        id: s.id, name: s.name, bgColor: s.bgColor, fogDensity: s.fogDensity,
        objects: [],  // filled below after THREE.js ready
      })));
      this.activeSceneId.set(proj.scenes[0]?.id || '');
      // Defer rebuilding until THREE is loaded
      const tryRebuild = () => {
        if (!this.THREE) { setTimeout(tryRebuild, 100); return; }
        for (let i = 0; i < proj.scenes.length; i++) {
          const ss = proj.scenes[i];
          const target = this.scenes()[i];
          for (const o of ss.objects) {
            const tpl = this.templates.find(t => t.key === o.templateKey);
            if (!tpl) continue;
            const three = tpl.build(this.THREE);
            three.position.set(o.pos[0], o.pos[1], o.pos[2]);
            three.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
            three.scale.set(o.scl[0], o.scl[1], o.scl[2]);
            if (three.material && o.col != null) three.material.color = new this.THREE.Color(o.col);
            if (three.material && o.emi != null) three.material.emissive = new this.THREE.Color(o.emi);
            if (three.material && o.ei != null) three.material.emissiveIntensity = o.ei;
            if (three.material && o.met != null) three.material.metalness = o.met;
            if (three.material && o.rou != null) three.material.roughness = o.rou;
            three.userData.metaId = o.id;
            three.userData.tutorialId = o.tutorialId;
            target.objects.push({ id: o.id, name: o.name, templateKey: o.templateKey, tutorialId: o.tutorialId, three });
            const num = parseInt((o.id.match(/\d+/) || ['0'])[0], 10);
            if (num >= this.nextId) this.nextId = num + 1;
          }
        }
        this.scenes.set([...this.scenes()]);
        this.rebuildSceneObjects();
        this.status.set('✓ Projet chargé (' + proj.scenes.reduce((n: number, s: any) => n + s.objects.length, 0) + ' objets)');
      };
      tryRebuild();
    } catch (e) {
      console.error('[StudioMaker] Load project error:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOAD existing room (basic — placeholder qui pourrait fetch des .room.json)
  // ═══════════════════════════════════════════════════════════════════
  async loadExistingRoom() {
    const key = this.loadRoomKey();
    if (!key) return;
    this.status.set(`Loading ${key}...`);
    // Pour MVP : on charge le tutorial JSON associé pour pré-remplir le builder
    const t = await this.narrator.loadTutorial(key);
    if (t) {
      this.tutorial.set(t);
      this.roomKey.set(key);
      this.status.set(`✓ Tutorial chargé pour ${key}. Édite-le dans l'onglet 📜 Tutorial.`);
      this.mode.set('tutorial');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // TUTORIAL form builder
  // ═══════════════════════════════════════════════════════════════════
  private makeEmptyTutorial(): RoomTutorial {
    return {
      roomKey: 'my-room',
      meta: {
        name: 'My Room',
        loreName: 'Le Nom Lore Yamzy',
        icon: '🎯',
        color: '#fbbf24',
        summary: '1 phrase qui résume.',
        introLore: '🪶 Bienvenue, jeune Mage. ...',
      },
      glossary: [],
      tour: [],
      playExample: { duration: 30, description: '📜 Démo en 30s', steps: [] },
      closingMessage: '🪶 Que ton chemin soit lumineux.',
    };
  }

  updateTutorialMeta(prop: string, value: any) {
    const t = this.tutorial();
    (t.meta as any)[prop] = value;
    this.tutorial.set({ ...t });
  }

  addGlossaryEntry() {
    const t = this.tutorial();
    t.glossary.push({
      tutorialId: '', name: 'Nouveau', scrumName: '',
      desc: '', yamzyExplain: '', scrumExplain: '',
    });
    this.tutorial.set({ ...t });
  }
  removeGlossaryEntry(i: number) {
    const t = this.tutorial();
    t.glossary.splice(i, 1);
    this.tutorial.set({ ...t });
  }
  updateGlossary(i: number, prop: string, value: any) {
    const t = this.tutorial();
    (t.glossary[i] as any)[prop] = value;
    this.tutorial.set({ ...t });
  }

  addTourStep() {
    const t = this.tutorial();
    t.tour.push({
      step: t.tour.length + 1, narratorMode: 'yamzy',
      text: 'Nouvelle étape...', wait: 5,
    });
    this.tutorial.set({ ...t });
  }
  removeTourStep(i: number) {
    const t = this.tutorial();
    t.tour.splice(i, 1);
    t.tour.forEach((s, idx) => s.step = idx + 1);
    this.tutorial.set({ ...t });
  }
  updateTourStep(i: number, prop: string, value: any) {
    const t = this.tutorial();
    (t.tour[i] as any)[prop] = value;
    this.tutorial.set({ ...t });
  }
  captureCameraForStep(i: number) {
    if (!this.camera) return;
    const t = this.tutorial();
    t.tour[i].camera = {
      position: [+this.camera.position.x.toFixed(2), +this.camera.position.y.toFixed(2), +this.camera.position.z.toFixed(2)] as Vec3,
      lookAt: this.controls?.target ? [+this.controls.target.x.toFixed(2), +this.controls.target.y.toFixed(2), +this.controls.target.z.toFixed(2)] as Vec3 : [0, 0, 0] as Vec3,
      duration: 2,
    };
    this.tutorial.set({ ...t });
    this.status.set(`📸 Caméra capturée pour step ${i + 1}`);
  }

  updatePlayExample(prop: string, value: any) {
    const t = this.tutorial();
    (t.playExample as any)[prop] = value;
    this.tutorial.set({ ...t });
  }

  testTutorial() {
    // Attach narrator to current 3D scene for live preview
    this.narrator.attach({
      camera: this.camera, controls: this.controls,
      scene: this.scene, clock: this.clock,
      roomComponent: this, roomKey: this.tutorial().roomKey || 'test',
    });
    // Override the tutorial avec celui en cours d'édition
    this.narrator.tutorial.set(this.tutorial());
    this.narrator.totalSteps.set(this.tutorial().tour.length);
    this.narrator.startTour();
    this.status.set('🎓 Tour démarré — Yamzy parle');
  }

  exportTutorialJSON() {
    const t = this.tutorial();
    t.roomKey = this.roomKey() || 'my-room';
    const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, `${t.roomKey}.tutorial.json`);
    this.status.set('✓ tutorial.json exporté');
  }

  // ═══════════════════════════════════════════════════════════════════
  // CLICK handler + Keyboard shortcuts
  // ═══════════════════════════════════════════════════════════════════
  private onCanvasClick(e: MouseEvent) {
    if (this.transformControls?.dragging) return;
    const canvas = this.canvasEl.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const objs = (this.activeScene()?.objects || []).map(o => o.three);
    const intersects = this.raycaster.intersectObjects(objs, true);
    if (intersects.length > 0) {
      let cur = intersects[0].object;
      while (cur && !cur.userData?.metaId) cur = cur.parent;
      if (cur?.userData?.metaId) this.selectObject(cur.userData.metaId);
    }
  }

  private onKey(e: KeyboardEvent) {
    // Ignore si focus dans un input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!this.transformControls) return;
    if (e.key === 'g' || e.key === 'G') this.transformControls.setMode('translate');
    if (e.key === 'r' || e.key === 'R') this.transformControls.setMode('rotate');
    if (e.key === 's' && !e.ctrlKey) this.transformControls.setMode('scale');
    if (e.key === 'Escape') { this.transformControls.detach(); this.selectedId.set(null); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const id = this.selectedId();
      if (id) this.deleteObject(id);
    }
    if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey) {
      const id = this.selectedId();
      if (id) { e.preventDefault(); this.duplicateObject(id); }
    }
    if (e.key === 'f' || e.key === 'F') {
      const id = this.selectedId();
      if (id) this.focusObject(id);
    }
    if ((e.key === 's' || e.key === 'S') && e.ctrlKey) {
      e.preventDefault(); this.saveProject();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════
  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
    // FPS counter
    this.fpsTimer += dt;
    this.fpsFrames++;
    if (this.fpsTimer >= 1) {
      this.fps.set(this.fpsFrames);
      this.fpsTimer = 0;
      this.fpsFrames = 0;
    }
  };

  private onResize = () => {
    if (!this.camera || !this.renderer || !this.canvasEl?.nativeElement) return;
    const canvas = this.canvasEl.nativeElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
}
