import api from './axios';

// ── Projects ──
export const getProjects = () => api.get('/api/projects');
export const createProject = (data: { name: string; description?: string }) =>
  api.post('/api/projects', data);

// ── Meetings ──
export const getMeetings = () => api.get('/api/meetings');
export const getMeeting = (id: string) => api.get(`/api/meetings/${id}`);
export const createMeeting = (data: { title: string; projectId: string; memberIds?: string[] }) =>
  api.post('/api/meetings', data);

// ── Users ──
export const getUsers = () => api.get('/api/users');

// ── Transcripts ──
export const getTranscripts = () => api.get('/api/transcripts');
export const getTranscript = (id: string) => api.get(`/api/transcripts/${id}`);
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

export const getTasks = () => api.get('/api/tasks');
export const getTask = (id: string) => api.get(`/api/tasks/${id}`);
export const createTask = (data: TaskPayload) => api.post('/api/tasks', data);
export const updateTask = (id: string, data: Partial<TaskPayload>) =>
  api.patch(`/api/tasks/${id}`, data);
export const updateTaskStatus = (id: string, status: string) =>
  api.patch(`/api/tasks/${id}/status`, { status });
export const deleteTask = (id: string) => api.delete(`/api/tasks/${id}`);

// ── Academic GD ──
export interface AcademicCohort {
  id: string;
  name: string;
  grade: string;
  section: string;
  academicYear: string;
  description: string;
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
  rubricId: string;
  participantIds: string[];
  scheduledAt?: string;
  durationMinutes: number;
  meetingId?: string;
  evaluatorId: string;
  status: 'draft' | 'scheduled' | 'processing' | 'ready_for_review' | 'published';
}

export const getAcademicCohorts = () => api.get<AcademicCohort[]>('/api/academic/cohorts');
export const getAcademicStudents = (cohortId?: string) =>
  api.get<AcademicStudent[]>('/api/academic/students', { params: cohortId ? { cohortId } : undefined });
export const getAcademicRubrics = () => api.get<AcademicRubric[]>('/api/academic/rubrics');
export const createAcademicSession = (data: {
  title: string;
  topic: string;
  cohortId: string;
  rubricId: string;
  participantIds: string[];
  scheduledAt?: string;
  durationMinutes: number;
}) => api.post<AcademicSession>('/api/academic/sessions', data);
