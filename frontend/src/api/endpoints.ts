import api from './axios';

// ── Projects ──
export interface Project {
  id: string;
  name: string;
  description?: string;
  adminId: string;
  createdAt: string;
}

export const getProjects = () => api.get<Project[]>('/api/projects');
export const createProject = (data: { name: string; description?: string }) =>
  api.post('/api/projects', data);

// ── Meetings ──
export interface Meeting {
  id: string;
  title: string;
  projectId: string;
  hostId: string;
  memberIds: string[];
  scheduledAt?: string | null;
  createdAt: string;
  meetingLink?: string | null;
  botStatus?: 'pending' | 'joining' | 'recording' | 'done' | 'failed' | null;
  meetingType: 'academic_gd' | 'industry';
}

export const getMeetings = () => api.get<Meeting[]>('/api/meetings');
export const getMeeting = (id: string) => api.get<Meeting>(`/api/meetings/${id}`);
export const createMeeting = (data: {
  title: string;
  projectId: string;
  memberIds?: string[];
  scheduledAt?: string;
  meetingLink?: string;
  meetingType?: 'academic_gd' | 'industry';
}) => api.post<Meeting>('/api/meetings', data);

// ── Users ──
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const getUsers = () => api.get<User[]>('/api/users');

// ── Transcripts ──
export interface Transcript {
  id: string;
  meetingId: string;
  rawText: string;
  segments: Array<Record<string, unknown>>;
  extractedTasks: unknown[];
  structuredExtraction?: Record<string, any> | null;
  createdAt: string;
}

export const getTranscripts = () => api.get<Transcript[]>('/api/transcripts');
export const getTranscript = (id: string) => api.get<Transcript>(`/api/transcripts/${id}`);
export const createTranscript = (data: { meetingId: string; rawText: string }) =>
  api.post('/api/transcripts', data);
export const extractTasks = (transcriptId: string) =>
  api.post(`/api/transcripts/${transcriptId}/extract`);
export const processTranscript = (transcriptId: string, meetingDate: string) =>
  api.post(`/api/transcripts/${transcriptId}/process`, null, {
    params: { meeting_date: meetingDate },
  });

// ── Tasks ──
export interface TaskPayload {
  title: string;
  description?: string;
  transcriptId: string;
  projectId: string;
  assignedTo?: { userId: string; name: string; email: string };
  deadline?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'todo' | 'in_progress' | 'done';
}

export interface Task extends Omit<TaskPayload, 'status' | 'priority' | 'assignedTo'> {
  id: string;
  assignedTo?: { userId: string; name: string; email: string };
  deadline?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'done';
  publicationStatus: 'draft' | 'published';
  createdAt: string;
}

export const getTasks = () => api.get<Task[]>('/api/tasks');
export const getTask = (id: string) => api.get<Task>(`/api/tasks/${id}`);
export const createTask = (data: TaskPayload) => api.post('/api/tasks', data);
export const updateTask = (id: string, data: Partial<TaskPayload>) =>
  api.patch(`/api/tasks/${id}`, data);
export const updateTaskStatus = (id: string, status: Task['status']) =>
  api.patch(`/api/tasks/${id}/status`, { status });
export const deleteTask = (id: string) => api.delete(`/api/tasks/${id}`);
export const publishTask = (id: string) => api.post<Task>(`/api/tasks/${id}/publish`);

// ── Academic GD ──
export interface AcademicCohort {
  id: string;
  name: string;
  grade: string;
  section: string;
  academicYear: string;
  description: string;
  createdAt?: string;
}

export interface AcademicStudent {
  id: string;
  studentId: string;
  name: string;
  email?: string;
  cohortId: string;
}

export interface AcademicRubricDimension {
  key: string;
  label: string;
  description: string;
  maxScore: number;
}

export interface AcademicRubric {
  id: string;
  name: string;
  description: string;
  dimensions: AcademicRubricDimension[];
}

export interface AcademicSession {
  id: string;
  title: string;
  topic: string;
  cohortId: string;
  rubricId?: string;
  rubricIds: string[];
  participantIds: string[];
  scheduledAt?: string;
  durationMinutes: number;
  meetingId?: string;
  evaluatorId: string;
  status: 'draft' | 'scheduled' | 'processing' | 'ready_for_review' | 'published';
}

export const getAcademicCohorts = () => api.get<AcademicCohort[]>('/api/academic/cohorts');
export const createAcademicCohort = (data: { name: string; grade: string; section: string; academicYear: string; description?: string }) =>
  api.post<AcademicCohort>('/api/academic/cohorts', data);
export const updateAcademicCohort = (id: string, data: { name: string; grade: string; section: string; academicYear: string; description?: string }) =>
  api.patch<AcademicCohort>(`/api/academic/cohorts/${id}`, data);
export const getAcademicStudents = (cohortId?: string) =>
  api.get<AcademicStudent[]>('/api/academic/students', { params: cohortId ? { cohortId } : undefined });
export const createAcademicStudent = (data: { studentId: string; name: string; email?: string; cohortId: string }) =>
  api.post<AcademicStudent>('/api/academic/students', data);
export const getAcademicRubrics = () => api.get<AcademicRubric[]>('/api/academic/rubrics');
export const createAcademicRubric = (data: { name: string; description?: string; dimensions: AcademicRubricDimension[] }) =>
  api.post<AcademicRubric>('/api/academic/rubrics', data);
export const createAcademicSession = (data: {
  title: string;
  topic: string;
  cohortId: string;
  rubricIds: string[];
  participantIds: string[];
  scheduledAt?: string;
  durationMinutes: number;
}) => api.post<AcademicSession>('/api/academic/sessions', data);
export const getAcademicSessions = () => api.get<AcademicSession[]>('/api/academic/sessions');

export interface AcademicTranscriptContext {
  transcriptId: string;
  meetingId: string;
  rawText: string;
  speakers: string[];
  students: Pick<AcademicStudent, 'id' | 'studentId' | 'name'>[];
  session: AcademicSession | null;
  mappings: Record<string, string>;
  finalized: boolean;
}

export const getAcademicTranscriptContext = (transcriptId: string) =>
  api.get<AcademicTranscriptContext>(`/api/academic/transcripts/${transcriptId}/context`);
export const updateAcademicTranscriptMapping = (transcriptId: string, data: { mappings: Record<string, string>; finalize: boolean }) =>
  api.patch(`/api/academic/transcripts/${transcriptId}/mapping`, data);

export interface AcademicAssessmentScore {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  rationale: string;
  evidence: { quote: string; timestamp: string }[];
}

export interface AcademicAssessment {
  id: string;
  transcriptId: string;
  sessionId: string;
  studentId: string;
  scores: AcademicAssessmentScore[];
  strengths: string[];
  improvements: string[];
  summary: string;
  status: 'ai_recommendation' | 'reviewed';
  generatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export const generateAcademicAssessments = (transcriptId: string) =>
  api.post<AcademicAssessment[]>(`/api/academic/transcripts/${transcriptId}/assess`);
export const getAcademicAssessments = (transcriptId?: string) =>
  api.get<AcademicAssessment[]>('/api/academic/assessments', { params: transcriptId ? { transcriptId } : undefined });
export const reviewAcademicAssessment = (assessmentId: string, data: { scores: AcademicAssessmentScore[]; reviewNote: string }) =>
  api.patch<AcademicAssessment>(`/api/academic/assessments/${assessmentId}/review`, data);
export interface AcademicReport extends Omit<AcademicAssessment, 'status' | 'generatedAt'> {
  assessmentId: string;
  publishedBy: string;
  publishedAt: string;
}
export const publishAcademicAssessment = (assessmentId: string) =>
  api.post<AcademicReport>(`/api/academic/assessments/${assessmentId}/publish`);
export const getAcademicReports = () => api.get<AcademicReport[]>('/api/academic/reports');
