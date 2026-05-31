// WAR TABLE ⚔ — Client HTTP pour le Planning Organisator Studio (/api/pos/*).

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PosProject {
  id: number;
  code: string;
  name: string;
  description?: string;
  productGoal?: string;
  startDate?: string;
  endDate?: string;
  hoursPerDay?: number;
  daysPerSprint?: number;
  sprintCapacityHours?: number;
  allocatedDays?: number;
  consumedDays?: number;
  status?: string;
}

export interface PosTicket {
  id: number;
  projectId: number;
  ticketId: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  type?: string;
  component?: string;
  phase?: string;
  priority?: string;
  sprint?: string;
  status?: string;
  assignee?: string;
  estimationHours?: number;
  storyPoints?: number;
  startDate?: string;
  deliveryDate?: string;
  dependencies?: string;
  progressPercent?: number;
  spentHours?: number;
  remainingHours?: number;
  rankIndex?: number;
  delayDays?: number;
  state?: string;
  cycleTimeDays?: number;
  leadTimeDays?: number;
  reviewVerdict?: string;
  reviewerComment?: string;
  prLink?: string;
  // v1.0.103 — Chantier E : id de l'event Scrum d'origine (null = creation manuelle).
  sourceEventId?: number;
}

// v1.0.113 — Commentaire sur ticket
export interface PosTicketComment {
  id?: number;
  ticketId: number;
  author: string;
  body: string;
  createdAt?: string;
  editedAt?: string;
}

export interface PosSprint {
  id: number; number: number; name?: string; goal?: string;
  startDate?: string; endDate?: string; capacityHours?: number;
}

export interface ImportResult {
  projects: number; tickets: number; sprints: number; phases: number;
  risks: number; techDebt: number; lessons: number; adrs: number;
  glossary: number; capacity: number; quarters: number; milestones: number;
  overtime: number; projectCodes: string[]; warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class WarTableApi {
  private http = inject(HttpClient);
  private base = '/api/pos';

  selectedProjectId = signal<number | null>(null);
  projects = signal<PosProject[]>([]);

  importExcel(file: File): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportResult>(`${this.base}/import`, form);
  }

  listProjects(): Observable<PosProject[]> { return this.http.get<PosProject[]>(`${this.base}/projects`); }
  getProjectBundle(id: number): Observable<any> { return this.http.get<any>(`${this.base}/projects/${id}`); }
  deleteProject(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/projects/${id}`); }

  tickets(projectId: number): Observable<PosTicket[]> { return this.http.get<PosTicket[]>(`${this.base}/projects/${projectId}/tickets`); }
  updateTicket(ticketId: number, patch: Partial<PosTicket>): Observable<PosTicket> { return this.http.put<PosTicket>(`${this.base}/tickets/${ticketId}`, patch); }
  createTicket(projectId: number, body: Partial<PosTicket>): Observable<PosTicket> { return this.http.post<PosTicket>(`${this.base}/projects/${projectId}/tickets`, body); }
  deleteTicket(ticketId: number): Observable<void> { return this.http.delete<void>(`${this.base}/tickets/${ticketId}`); }

  sprints(projectId: number): Observable<PosSprint[]> { return this.http.get<PosSprint[]>(`${this.base}/projects/${projectId}/sprints`); }
  phases(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/phases`); }
  risks(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/risks`); }
  techDebt(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/tech-debt`); }
  lessons(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/lessons`); }
  adrs(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/adrs`); }
  glossary(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/glossary`); }
  capacity(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/capacity`); }
  quarters(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/quarters`); }
  milestones(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/milestones`); }
  overtime(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/overtime`); }
  retros(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/retrospectives`); }
  stakeholders(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/stakeholders`); }
  stakeholderFeedback(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/stakeholder-feedback`); }
  standups(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/daily-standups`); }

  exportExcel(projectId: number): Observable<Blob> {
    return this.http.get(`${this.base}/projects/${projectId}/export`, { responseType: 'blob' });
  }

  listVersions(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/versions`); }
  saveVersion(projectId: number, label: string): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/versions`, { label }); }
  restoreVersion(versionId: number): Observable<any> { return this.http.post<any>(`${this.base}/versions/${versionId}/restore`, {}); }
  deleteVersion(versionId: number): Observable<void> { return this.http.delete<void>(`${this.base}/versions/${versionId}`); }

  dodDor(projectId: number, type: string): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/dod-dor?type=${type}`); }
  toggleDodDor(checkId: number, validated: boolean): Observable<any> { return this.http.put<any>(`${this.base}/dod-dor/${checkId}/toggle`, { validated }); }
  checklist(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/checklist`); }
  toggleChecklist(itemId: number, checked: boolean): Observable<any> { return this.http.put<any>(`${this.base}/checklist/${itemId}/toggle`, { checked }); }

  dashboard(projectId: number): Observable<any> { return this.http.get<any>(`${this.base}/projects/${projectId}/dashboard`); }
  cfd(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/cfd`); }
  velocity(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/velocity`); }
  burndown(projectId: number): Observable<any> { return this.http.get<any>(`${this.base}/projects/${projectId}/burndown`); }
  dependencies(projectId: number): Observable<any[]> { return this.http.get<any[]>(`${this.base}/projects/${projectId}/dependencies`); }

  // ═══ CRUD COMPLET v1.0.4 — Excel auto-régénéré côté backend ═══
  createProject(body: Partial<PosProject>): Observable<PosProject> { return this.http.post<PosProject>(`${this.base}/projects`, body); }
  updateProject(id: number, body: Partial<PosProject>): Observable<PosProject> { return this.http.put<PosProject>(`${this.base}/projects/${id}`, body); }

  createSprint(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/sprints`, body); }
  updateSprint(sprintId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/sprints/${sprintId}`, body); }
  deleteSprint(sprintId: number): Observable<void> { return this.http.delete<void>(`${this.base}/sprints/${sprintId}`); }
  /** Renomme en masse les "Sprint N" existants → "{PROJ}-S{N}" (idempotent). */
  rebrandSprints(projectId: number): Observable<{ renamed: number; total: number }> {
    return this.http.post<{ renamed: number; total: number }>(`${this.base}/projects/${projectId}/sprints/rebrand`, {});
  }
  /** Reset complet : rebrand → export Excel archivé → suppression projet. Retourne le path. */
  resetAndArchive(projectId: number): Observable<{ projectCode: string; projectName: string; sprintsRenamed: number; archivePath: string; deleted: boolean }> {
    return this.http.post<any>(`${this.base}/projects/${projectId}/reset-and-archive`, {});
  }

  createPhase(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/phases`, body); }
  updatePhase(phaseId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/phases/${phaseId}`, body); }
  deletePhase(phaseId: number): Observable<void> { return this.http.delete<void>(`${this.base}/phases/${phaseId}`); }

  createRisk(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/risks`, body); }
  updateRisk(riskId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/risks/${riskId}`, body); }
  deleteRisk(riskId: number): Observable<void> { return this.http.delete<void>(`${this.base}/risks/${riskId}`); }

  createDebt(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/tech-debt`, body); }
  updateDebt(debtId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/tech-debt/${debtId}`, body); }
  deleteDebt(debtId: number): Observable<void> { return this.http.delete<void>(`${this.base}/tech-debt/${debtId}`); }

  createLesson(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/lessons`, body); }
  updateLesson(lessonId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/lessons/${lessonId}`, body); }
  deleteLesson(lessonId: number): Observable<void> { return this.http.delete<void>(`${this.base}/lessons/${lessonId}`); }

  createAdr(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/adrs`, body); }
  updateAdr(adrId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/adrs/${adrId}`, body); }
  deleteAdr(adrId: number): Observable<void> { return this.http.delete<void>(`${this.base}/adrs/${adrId}`); }

  createGlossary(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/glossary`, body); }
  updateGlossary(glossaryId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/glossary/${glossaryId}`, body); }
  deleteGlossary(glossaryId: number): Observable<void> { return this.http.delete<void>(`${this.base}/glossary/${glossaryId}`); }

  createCapacity(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/capacity`, body); }
  updateCapacity(capId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/capacity/${capId}`, body); }
  deleteCapacity(capId: number): Observable<void> { return this.http.delete<void>(`${this.base}/capacity/${capId}`); }

  createQuarter(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/quarters`, body); }
  updateQuarter(qId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/quarters/${qId}`, body); }
  deleteQuarter(qId: number): Observable<void> { return this.http.delete<void>(`${this.base}/quarters/${qId}`); }

  createMilestone(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/milestones`, body); }
  updateMilestone(mId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/milestones/${mId}`, body); }
  deleteMilestone(mId: number): Observable<void> { return this.http.delete<void>(`${this.base}/milestones/${mId}`); }

  createOvertime(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/overtime`, body); }
  updateOvertime(oId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/overtime/${oId}`, body); }
  deleteOvertime(oId: number): Observable<void> { return this.http.delete<void>(`${this.base}/overtime/${oId}`); }

  createRetro(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/retrospectives`, body); }
  updateRetro(rId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/retrospectives/${rId}`, body); }
  deleteRetro(rId: number): Observable<void> { return this.http.delete<void>(`${this.base}/retrospectives/${rId}`); }

  createStakeholder(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/stakeholders`, body); }
  updateStakeholder(sId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/stakeholders/${sId}`, body); }
  deleteStakeholder(sId: number): Observable<void> { return this.http.delete<void>(`${this.base}/stakeholders/${sId}`); }

  createFeedback(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/stakeholder-feedback`, body); }
  updateFeedback(fId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/stakeholder-feedback/${fId}`, body); }
  deleteFeedback(fId: number): Observable<void> { return this.http.delete<void>(`${this.base}/stakeholder-feedback/${fId}`); }

  createStandup(projectId: number, body: any): Observable<any> { return this.http.post<any>(`${this.base}/projects/${projectId}/daily-standups`, body); }
  updateStandup(sId: number, body: any): Observable<any> { return this.http.put<any>(`${this.base}/daily-standups/${sId}`, body); }
  deleteStandup(sId: number): Observable<void> { return this.http.delete<void>(`${this.base}/daily-standups/${sId}`); }

  /** Path absolu du dernier Excel régénéré (pour toast). */
  getLastExportPath(projectId: number): Observable<{ path: string }> {
    return this.http.get<{ path: string }>(`${this.base}/projects/${projectId}/auto-export-path`);
  }
  /** Force la régénération immédiate (bypass debounce). */
  regenerateExcel(projectId: number): Observable<{ path: string }> {
    return this.http.post<{ path: string }>(`${this.base}/projects/${projectId}/regenerate-excel`, {});
  }

  // ═══ SPRINT LAUNCH v1.0.7 ═══

  /** État sprint pour le dashboard : ACTIVE / LAUNCHABLE / IDLE. */
  launchableSprint(projectId: number): Observable<{
    state: 'ACTIVE' | 'LAUNCHABLE' | 'IDLE';
    launchable: boolean; interruptible: boolean;
    sprintId?: number; sprintName?: string; sprintNumber?: number;
    startDate?: string; endDate?: string; status?: string;
    daysUntilStart?: number; isToday?: boolean; isOverdue?: boolean;
    launchedAt?: string; dayIndex?: number; totalDays?: number;
    reason?: string;
  }> {
    return this.http.get<any>(`${this.base}/projects/${projectId}/sprints/launchable`);
  }

  /** Lance un sprint : status=EN_COURS + daily auto + ticketKeys YC-* + auto-export. */
  launchSprint(sprintId: number): Observable<{
    sprintId: number; sprintName: string; previousStatus: string; newStatus: string;
    launchedAt: string; dailyCreated: boolean; dailyId?: number;
    ticketKeysGenerated: number; keyPattern: string; excelAutoExportTriggered: boolean;
  }> {
    return this.http.post<any>(`${this.base}/sprints/${sprintId}/launch`, {});
  }

  /** Interrompt un sprint EN_COURS : status → PLANNED + launched_at = null. */
  interruptSprint(sprintId: number): Observable<{
    sprintId: number; sprintName: string; previousStatus: string; newStatus: string; interrupted: boolean;
  }> {
    return this.http.post<any>(`${this.base}/sprints/${sprintId}/interrupt`, {});
  }

  /** Termine un sprint EN_COURS : status → TERMINE + endDate=today si manquant. */
  completeSprint(sprintId: number): Observable<{
    sprintId: number; sprintName: string; previousStatus: string; newStatus: string; completed: boolean;
  }> {
    return this.http.post<any>(`${this.base}/sprints/${sprintId}/complete`, {});
  }

  // ═══ REMINDERS v1.0.10 ═══
  // ═══ BULK OPERATIONS v1.0.10 ═══
  /** Bulk patch sur N tickets : status, sprint, assignee, priority, phase, component, progressPercent. */
  bulkUpdateTickets(ids: number[], patch: Record<string, any>): Observable<{ updated: number; requested: number }> {
    return this.http.put<any>(`${this.base}/tickets/bulk`, { ids, patch });
  }
  /** Bulk delete N tickets. */
  bulkDeleteTickets(ids: number[]): Observable<{ deleted: number; requested: number }> {
    return this.http.post<any>(`${this.base}/tickets/bulk-delete`, { ids });
  }
  /** Reorder tickets (rankIndex = position dans le tableau ids). */
  bulkReorderTickets(ids: number[]): Observable<{ reordered: number }> {
    return this.http.post<any>(`${this.base}/tickets/bulk-reorder`, { ids });
  }

  // ═══ CALENDAR EVENTS v1.0.11 ═══
  listEvents(projectId: number, from?: string, to?: string): Observable<any[]> {
    let url = `${this.base}/projects/${projectId}/events`;
    if (from && to) url += `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    return this.http.get<any[]>(url);
  }
  upcomingEvents(projectId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/projects/${projectId}/events/upcoming`);
  }
  startingSoonEvents(projectId: number, windowMinutes = 5): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/projects/${projectId}/events/starting-soon?windowMinutes=${windowMinutes}`);
  }
  createEvent(projectId: number, body: any): Observable<any> {
    return this.http.post<any>(`${this.base}/projects/${projectId}/events`, body);
  }
  updateEvent(eventId: number, body: any): Observable<any> {
    return this.http.put<any>(`${this.base}/events/${eventId}`, body);
  }
  deleteEvent(eventId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/events/${eventId}`);
  }
  startEvent(eventId: number): Observable<any> {
    return this.http.post<any>(`${this.base}/events/${eventId}/start`, {});
  }
  endEvent(eventId: number, notes?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/events/${eventId}/end`, { notes: notes || '' });
  }
  /** v1.0.103 — Chantier E : tickets crees pendant cet event Scrum. */
  ticketsForEvent(eventId: number): Observable<PosTicket[]> {
    return this.http.get<PosTicket[]>(`${this.base}/calendar-events/${eventId}/tickets`);
  }

  // ═══ v1.0.113 — Ticket comments ═══
  ticketComments(ticketId: number): Observable<PosTicketComment[]> {
    return this.http.get<PosTicketComment[]>(`${this.base}/tickets/${ticketId}/comments`);
  }
  addTicketComment(ticketId: number, body: { author: string; body: string }): Observable<PosTicketComment> {
    return this.http.post<PosTicketComment>(`${this.base}/tickets/${ticketId}/comments`, body);
  }
  updateTicketComment(commentId: number, body: { body: string }): Observable<PosTicketComment> {
    return this.http.put<PosTicketComment>(`${this.base}/comments/${commentId}`, body);
  }
  deleteTicketComment(commentId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/comments/${commentId}`);
  }
  respondEvent(eventId: number, name: string, response: 'ACCEPTED'|'DECLINED'|'TENTATIVE'|'PENDING'): Observable<any> {
    return this.http.post<any>(`${this.base}/events/${eventId}/respond`, { name, response });
  }
  regenerateScrumCeremonies(projectId: number): Observable<{ created: number; sprintName?: string; sprintNames?: string[]; reason?: string }> {
    return this.http.post<any>(`${this.base}/projects/${projectId}/events/regenerate-scrum`, {});
  }
  /** v1.0.14 — Silent auto-generation for sprints missing events. */
  autoEnsureEvents(projectId: number): Observable<{ created: number; sprintsScanned: number }> {
    return this.http.post<any>(`${this.base}/projects/${projectId}/events/auto-ensure`, {});
  }
  icalUrl(projectId: number): string { return `${this.base}/projects/${projectId}/events/ical`; }

  /** v1.0.13 — Collisions d'events (paires qui se chevauchent). */
  eventCollisions(projectId: number): Observable<Array<{ eventA: any; eventB: any }>> {
    return this.http.get<any[]>(`${this.base}/projects/${projectId}/events/collisions`);
  }

  /** v1.0.13 — Time allocation : tickets vs events par sprint. */
  timeAllocation(projectId: number): Observable<{
    rows: Array<{ sprintId: number; sprintName: string; ticketHours: number; eventHours: number; totalHours: number; ticketPct: number; eventPct: number; }>;
    grand: { ticketHours: number; eventHours: number; totalHours: number; };
  }> {
    return this.http.get<any>(`${this.base}/projects/${projectId}/time-allocation`);
  }

  /** Récupère la liste des rappels/alertes pour ce projet. */
  reminders(projectId: number): Observable<{
    items: Array<{
      category: string; severity: 'HIGH' | 'MEDIUM' | 'LOW';
      title: string; description: string; page?: string;
      entityKey?: string; entityId?: number;
    }>;
    counts: { total: number; high: number; medium: number; low: number; };
  }> {
    return this.http.get<any>(`${this.base}/projects/${projectId}/reminders`);
  }
}
