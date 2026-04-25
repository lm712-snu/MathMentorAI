export interface UserProfile {
  displayName: string;
  email: string;
  role: "student" | "instructor";
  level?: "Beginner" | "Intermediate" | "Advanced";
  totalPoints: number;
  lastActive: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  topics: string[];
  createdAt: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentEmail: string;
  status: "pending" | "active";
}

export interface Material {
  id: string;
  title: string;
  content: string; // Markdown/LaTeX
  type: "lesson" | "assignment";
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface AgentMemory {
  strengths: string[];
  weaknesses: string[];
  recommendedTopics: string[];
  tutoringStyle: string;
  updatedAt: string;
}

export interface AssessmentResult {
  topicId: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
  difficulty: string;
  feedback: string;
}
