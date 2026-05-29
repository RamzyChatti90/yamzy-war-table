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
}
