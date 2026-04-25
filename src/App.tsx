/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, query, collection, where, getDocs, serverTimestamp } from "firebase/firestore";
import { auth, loginWithGoogle, db, OperationType, handleFirestoreError } from "./lib/firebase";
import { UserProfile, AgentMemory } from "./types";
import { GraduationCap, Brain, Trophy, ChevronRight, LogOut, Loader2, Sparkles, BookOpen, Target, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { TutorLesson } from "./components/TutorLesson";
import { AssessmentGrid } from "./components/AssessmentGrid";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memory, setMemory] = useState<AgentMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"dashboard" | "learn" | "practice">("dashboard");
  const [selectedTopic, setSelectedTopic] = useState("Algebra Fundamentals");
  const [intendedRole, setIntendedRole] = useState<"student" | "instructor" | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const profileRef = doc(db, "users", u.uid, "profile", "info");
          const profileSnap = await getDoc(profileRef);
          
          if (profileSnap.exists()) {
            setProfile(profileSnap.data() as UserProfile);
          } else {
            // Check if we have an intended role from the landing page
            const savedRole = sessionStorage.getItem("intendedRole") as "student" | "instructor" | null;
            if (savedRole) {
              await handleRoleSelection(u, savedRole);
              sessionStorage.removeItem("intendedRole");
            } else {
              setProfile(null);
            }
          }
        } catch (err) {
          console.error("Critical auth error:", err);
        }
      } else {
        setUser(null);
        setProfile(null);
        setMemory(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (profile && profile.role === "student") {
      const memoryRef = doc(db, "users", user!.uid, "memory", "current");
      const unsub = onSnapshot(memoryRef, (snap) => {
        if (snap.exists()) setMemory(snap.data() as AgentMemory);
      }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user!.uid}/memory/current`));
      return unsub;
    }
  }, [profile]);

  const handleRoleSelection = async (u: User, role: "student" | "instructor") => {
    setLoading(true);
    try {
      const profileRef = doc(db, "users", u.uid, "profile", "info");
      
      // Construct profile without undefined fields
      const newProfile: any = {
        displayName: u.displayName || "New User",
        email: u.email || "",
        role,
        totalPoints: 0,
        lastActive: new Date().toISOString(),
      };

      if (role === "student") {
        newProfile.level = "Beginner";
      }

      await setDoc(profileRef, newProfile);
      setProfile(newProfile as UserProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}/profile/info`);
    } finally {
      setLoading(false);
    }
  };

  const resetAccount = async () => {
    if (!user || !confirm("Are you sure you want to reset your account? This will delete your profile and progress.")) return;
    setLoading(true);
    try {
      // 1. Delete Memory if student
      if (profile?.role === "student") {
        try {
          await deleteDoc(doc(db, "users", user.uid, "memory", "current"));
        } catch (e) {
          console.warn("Could not delete memory document, might not exist.");
        }
      }
      
      // 2. Delete Profile
      await deleteDoc(doc(db, "users", user.uid, "profile", "info"));
      
      // 3. Clear caches
      sessionStorage.clear();
      localStorage.clear();
      
      // 4. Force reload and logout
      await auth.signOut();
      window.location.href = "/";
    } catch (err) {
      console.error("Reset failed:", err);
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/profile/info`);
    } finally {
      setLoading(false);
    }
  };

  const loginWithRole = (role: "student" | "instructor") => {
    sessionStorage.setItem("intendedRole", role);
    loginWithGoogle();
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Authenticating...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 overflow-hidden relative">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500 rounded-full blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-12 max-w-4xl w-full z-10"
        >
          <div className="space-y-4">
            <div className="bg-indigo-600 p-4 rounded-2xl inline-block shadow-2xl shadow-indigo-200">
              <Brain className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-slate-900">MathMentor AI</h1>
            <p className="text-slate-500 text-xl max-w-xl mx-auto leading-relaxed">
              The world's most intuitive AI-powered LMS for mathematical discovery and mastery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Instructor Path */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 text-left group transition-all hover:border-amber-400"
            >
              <div className="bg-amber-100 p-4 rounded-2xl inline-block group-hover:bg-amber-600 transition-colors">
                <Brain className="w-10 h-10 text-amber-600 group-hover:text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Instructor Portal</h3>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                  Design curricula, manage students, and use AI to draft intuitive lesson materials and insights.
                </p>
              </div>
              <button 
                onClick={() => loginWithRole("instructor")}
                className="w-full bg-amber-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all flex items-center justify-center gap-2 group/btn"
              >
                Enter as Instructor
                <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </motion.div>

            {/* Student Path */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 text-left group transition-all hover:border-indigo-400"
            >
              <div className="bg-indigo-100 p-4 rounded-2xl inline-block group-hover:bg-indigo-600 transition-colors">
                <GraduationCap className="w-10 h-10 text-indigo-600 group-hover:text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Student Portal</h3>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                  Learn with a personalized Agentic AI tutor, master complex concepts, and track your progress.
                </p>
              </div>
              <button 
                onClick={() => loginWithRole("student")}
                className="w-full bg-indigo-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group/btn"
              >
                Enter as Student
                <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </div>

          <p className="text-slate-400 text-sm font-medium">
            Powered by Gemini AI • Secure Firebase Authentication
          </p>
        </motion.div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-10 max-w-lg w-full shadow-xl border border-slate-200 text-center space-y-8">
          <h2 className="text-3xl font-bold text-slate-900">Final Step</h2>
          <p className="text-slate-500">We couldn't automatically determine your role. Please choose one to continue.</p>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => handleRoleSelection(user, "student")}
              className="p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
            >
              <div className="bg-indigo-100 p-3 rounded-xl inline-block mb-3 group-hover:bg-indigo-600 transition-colors">
                <GraduationCap className="w-8 h-8 text-indigo-600 group-hover:text-white" />
              </div>
              <p className="font-bold text-slate-900 text-lg">Student</p>
            </button>
            <button 
              onClick={() => handleRoleSelection(user, "instructor")}
              className="p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
            >
              <div className="bg-amber-100 p-3 rounded-xl inline-block mb-3 group-hover:bg-amber-600 transition-colors">
                <Brain className="w-8 h-8 text-amber-600 group-hover:text-white" />
              </div>
              <p className="font-bold text-slate-900 text-lg">Instructor</p>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView("dashboard")}>
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h2 className="font-bold text-xl text-slate-900">MathMentor</h2>
          </div>
          
          <div className="flex items-center gap-6">
            {profile.role === "student" && (
              <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-100">
                <Trophy className="w-4 h-4" />
                <span className="font-bold">{profile.totalPoints || 0}</span>
              </div>
            )}
            <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{profile.displayName}</p>
                <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
              </div>
              <button 
                onClick={resetAccount}
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                title="Reset Account & Start Fresh"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => auth.signOut()}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-6">
        {profile.role === "instructor" ? (
          <InstructorDashboard profile={profile} />
        ) : (
          <StudentView 
            profile={profile} 
            memory={memory} 
            view={view} 
            setView={setView} 
            selectedTopic={selectedTopic} 
            setSelectedTopic={setSelectedTopic}
            setProfile={setProfile}
          />
        )}
      </main>
    </div>
  );
}

// Sub-components to keep App cleaner
import { InstructorDashboard } from "./components/InstructorDashboard";
import { Enrollment, Course, Material } from "./types";
import { MathDisplay } from "./components/MathDisplay";

function StudentView({ profile, memory, view, setView, selectedTopic, setSelectedTopic, setProfile }: any) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    if (!auth.currentUser?.email) return;
    const q = query(collection(db, "enrollments"), where("studentEmail", "==", auth.currentUser.email.toLowerCase()));
    const snap = await getDocs(q);
    const enrols = snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));
    setEnrollments(enrols);

    if (enrols.length > 0) {
      const courseIds = enrols.map(e => e.courseId);
      // Firestore 'in' query has limit of 10, but good for MVP
      const cq = query(collection(db, "courses"), where("__name__", "in", courseIds));
      const csnap = await getDocs(cq);
      setCourses(csnap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
    }
    setLoading(false);
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Loading your courses...</div>;

  if (enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto space-y-6">
        <div className="bg-rose-100 p-6 rounded-3xl text-rose-600">
          <GraduationCap className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Enrollment Required</h2>
        <p className="text-slate-500 leading-relaxed">
          You are a registered student, but you aren't enrolled in any courses yet. 
          Please ask your instructor to add your email <span className="font-bold text-slate-900">{auth.currentUser?.email}</span> to their course.
        </p>
        <button onClick={() => auth.signOut()} className="text-indigo-600 font-bold hover:underline transition-all">
          Sign out and try another account
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <aside className="lg:col-span-1 space-y-6">
        <nav className="space-y-1">
          <SidebarLink active={view === "dashboard"} icon={<Sparkles className="w-4 h-4" />} label="Learning Path" onClick={() => setView("dashboard")} />
          <SidebarLink active={view === "courses"} icon={<BookOpen className="w-4 h-4" />} label="My Courses" onClick={() => setView("dashboard")} />
        </nav>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-indigo-900 flex items-center gap-2">
            <Brain className="w-4 h-4" /> AI Suggestion
          </h3>
          <p className="text-sm text-indigo-700 leading-relaxed">
            {memory?.recommendedTopics?.[0] 
              ? `Ready to master ${memory.recommendedTopics[0]}? It's the natural next step after your recent progress.`
              : "Select a topic from your enrolled courses to start learning with AI MathMentor."}
          </p>
        </div>
      </aside>

      <div className="lg:col-span-3">
        <AnimatePresence mode="wait">
          {view === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Your Math Journey</h1>
                <p className="text-slate-500 mt-1 uppercase text-xs font-bold tracking-widest">Enrolled in {courses.length} Course{courses.length > 1 ? 's' : ''}</p>
              </div>

              {courses.map(course => (
                <div key={course.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-indigo-600">{course.title}</h3>
                    <span className="text-[10px] bg-slate-100 px-2 py-1 rounded font-bold text-slate-500 uppercase">ACTIVE</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {course.topics.length > 0 ? (
                      course.topics.map(t => (
                        <button
                          key={t}
                          onClick={() => { setSelectedTopic(t); setView("learn"); }}
                          className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-600 hover:bg-white transition-all group"
                        >
                          <span className="font-semibold text-slate-700 group-hover:text-indigo-600">{t}</span>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))
                    ) : (
                      <div className="col-span-full">
                        <p className="text-sm text-slate-400 italic mb-4">No automated topics assigned yet.</p>
                      </div>
                    )}
                  </div>

                  <CourseMaterialsList courseId={course.id} />
                </div>
              ))}
            </motion.div>
          )}

          {view === "learn" && (
            <TutorLesson 
              topic={selectedTopic} 
              userProfile={profile} 
              memory={memory} 
              onComplete={() => setView("practice")} 
            />
          )}

          {view === "practice" && (
            <AssessmentGrid 
              topic={selectedTopic} 
              userProfile={profile} 
              memory={memory} 
              onFinished={(pts: number) => {
                setProfile((p: any) => ({ ...p, totalPoints: p.totalPoints + pts }));
                setView("dashboard");
              }} 
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SidebarLink({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${active ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-200"}`}>
      {icon} {label}
    </button>
  );
}

function CourseMaterialsList({ courseId }: { courseId: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterials();
  }, [courseId]);

  const fetchMaterials = async () => {
    const q = collection(db, "courses", courseId, "materials");
    const snap = await getDocs(q);
    setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    setLoading(false);
  };

  if (loading) return null;
  if (materials.length === 0) return null;

  return (
    <div className="pt-6 border-t border-slate-100">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Instructor Materials</h4>
      <div className="space-y-3">
        {materials.map(m => (
          <div key={m.id} className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-indigo-100 p-1.5 rounded-lg">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <p className="font-bold text-slate-800 text-sm">{m.title}</p>
            </div>
            <MathDisplay content={m.content} className="!prose-sm text-slate-600" />
          </div>
        ))}
      </div>
    </div>
  );
}
