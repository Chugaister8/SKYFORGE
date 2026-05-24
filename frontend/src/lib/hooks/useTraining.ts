import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store/auth.store";

export interface CourseModule {
  id:string; title:string; type:"theory"|"simulator"|"quiz"|"practical";
  duration_min:number; pass_score?:number;
}

export interface Course {
  id:string; title:string; description:string; category:string;
  difficulty:"BEGINNER"|"INTERMEDIATE"|"ADVANCED"|"EXPERT";
  duration_min:number; uav_class?:string; modules:CourseModule[];
}

export interface Certificate {
  id:string; course_id:string; cert_number:string; score:number;
  grade:string; issued_at:string; expires_at:string|null; valid:boolean;
}

export function useCourses(category?:string){
  const token=useAuthStore(s=>s.accessToken);
  const path=category?`/training/courses?category=${category}`:"/training/courses";
  return useQuery<{courses:Course[]}>({queryKey:["courses",category],queryFn:()=>api.get(path,token??undefined),enabled:!!token});
}

export function useCourse(id:string|null){
  const token=useAuthStore(s=>s.accessToken);
  return useQuery<{course:Course;progress:any}>({queryKey:["course",id],queryFn:()=>api.get(`/training/courses/${id}`,token??undefined),enabled:!!token&&!!id});
}

export function useCertificates(){
  const token=useAuthStore(s=>s.accessToken);
  return useQuery<{certificates:Certificate[]}>({queryKey:["certificates"],queryFn:()=>api.get("/training/certificates",token??undefined),enabled:!!token});
}

export function useLeaderboard(courseId?:string){
  const token=useAuthStore(s=>s.accessToken);
  const path=courseId?`/training/leaderboard?course_id=${courseId}`:"/training/leaderboard";
  return useQuery<{leaderboard:any[]}>({queryKey:["leaderboard",courseId],queryFn:()=>api.get(path,token??undefined),enabled:!!token,staleTime:30_000});
}

export function useStartCourse(){
  const token=useAuthStore(s=>s.accessToken);
  const qc=useQueryClient();
  return useMutation({mutationFn:(cid:string)=>api.post(`/training/courses/${cid}/start`,{},token??undefined),onSuccess:()=>qc.invalidateQueries({queryKey:["course"]})});
}
