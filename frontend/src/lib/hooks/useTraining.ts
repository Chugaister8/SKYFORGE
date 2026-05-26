import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export interface CourseModule {
  id:           string;
  title:        string;
  type:         "theory"|"simulator"|"quiz"|"practical";
  duration_min: number;
  pass_score?:  number;
}

export interface Course {
  id:           string;
  title:        string;
  description:  string;
  category:     string;
  difficulty:   "BEGINNER"|"INTERMEDIATE"|"ADVANCED"|"EXPERT";
  duration_min: number;
  uav_class?:   string;
  modules:      CourseModule[];
}

export interface ModuleData {
  completed:    boolean;
  score:        number;
  passed:       boolean;
  time_spent_s: number;
  attempts:     number;
  last_attempt: string;
}

export interface Progress {
  progress_pct: number;
  completed:    boolean;
  score:        number;
  attempts:     number;
  module_data:  Record<string, ModuleData>;
  started_at:   string;
  completed_at: string | null;
}

export interface Certificate {
  id:         string;
  course_id:  string;
  cert_number:string;
  score:      number;
  grade:      string;
  issued_at:  string;
  expires_at: string | null;
  valid:      boolean;
}

export function useCourses(category?: string) {
  const token = useAuthStore(s => s.accessToken);
  const params = category ? `?category=${category}` : "";
  return useQuery<{ courses: Course[] }>({
    queryKey: ["courses", category],
    queryFn:  () => api.get(`/training/courses${params}`, token ?? undefined),
    enabled:  !!token,
    staleTime: 60_000,
  });
}

export function useCourse(courseId: string | null) {
  const token = useAuthStore(s => s.accessToken);
  return useQuery<{ course: Course; progress: Progress | null }>({
    queryKey: ["course", courseId],
    queryFn:  () => api.get(`/training/courses/${courseId}`, token ?? undefined),
    enabled:  !!token && !!courseId,
    staleTime: 30_000,
  });
}

export function useMyProgress() {
  const token = useAuthStore(s => s.accessToken);
  return useQuery<{ progress: Array<{
    course_id: string; progress_pct: number; score: number;
    completed: boolean; attempts: number;
  }> }>({
    queryKey: ["my-progress"],
    queryFn:  () => api.get("/training/my-progress", token ?? undefined),
    enabled:  !!token,
  });
}

export function useCertificates() {
  const token = useAuthStore(s => s.accessToken);
  return useQuery<{ certificates: Certificate[] }>({
    queryKey: ["certificates"],
    queryFn:  () => api.get("/training/certificates", token ?? undefined),
    enabled:  !!token,
  });
}

export function useLeaderboard(courseId?: string) {
  const token  = useAuthStore(s => s.accessToken);
  const params = courseId ? `?course_id=${courseId}` : "";
  return useQuery<{ leaderboard: Array<{
    rank: number; username: string; score: number; course_id: string; grade: string;
  }> }>({
    queryKey: ["leaderboard", courseId],
    queryFn:  () => api.get(`/training/leaderboard${params}`, token ?? undefined),
    enabled:  !!token,
    staleTime: 60_000,
  });
}

export function useStartCourse() {
  const token = useAuthStore(s => s.accessToken);
  const qc    = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) =>
      api.post(`/training/courses/${courseId}/start`, {}, token ?? undefined),
    onSuccess: (_, courseId) => {
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      qc.invalidateQueries({ queryKey: ["my-progress"] });
    },
  });
}

export function useCompleteModule() {
  const token = useAuthStore(s => s.accessToken);
  const qc    = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId, moduleId, score, timeSpentS,
    }: {
      courseId: string; moduleId: string; score: number; timeSpentS: number;
    }) =>
      api.post<{
        passed: boolean; score: number; progress_pct: number;
        overall_score: number; course_complete: boolean; can_certify: boolean;
      }>(`/training/courses/${courseId}/module`, {
        module_id:    moduleId,
        completed:    true,
        score,
        time_spent_s: timeSpentS,
        answers:      [],
      }, token ?? undefined),
    onSuccess: (_, { courseId }) => {
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      qc.invalidateQueries({ queryKey: ["my-progress"] });
      qc.invalidateQueries({ queryKey: ["certificates"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useCertify() {
  const token = useAuthStore(s => s.accessToken);
  const qc    = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) =>
      api.post<{ cert_number: string; grade: string; score: number }>(
        `/training/courses/${courseId}/certify`, {}, token ?? undefined,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      qc.invalidateQueries({ queryKey: ["my-progress"] });
    },
  });
}
