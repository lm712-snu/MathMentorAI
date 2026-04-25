import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, collectionGroup } from "firebase/firestore";
import { Course, Enrollment, Material, UserProfile } from "../types";
import { Plus, Users, BookOpen, Trash2, Send, CheckCircle, Loader2, Book, Sparkles, Brain, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { motion } from "motion/react";
import { MathDisplay } from "./MathDisplay";
import { plannerAgent } from "../services/aiService";
import { GoogleGenAI } from "@google/genai";

export function InstructorDashboard({ profile }: { profile: UserProfile }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showEditCourse, setShowEditCourse] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "courses"), where("instructorId", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
    setLoading(false);
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instructor Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage your virtual classrooms and students.</p>
        </div>
        <button 
          onClick={() => setShowAddCourse(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 font-bold"
        >
          <Plus className="w-4 h-4" /> Create Course
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {courses.map(c => (
          <div 
            key={c.id} 
            onClick={() => setActiveCourse(c)}
            className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${activeCourse?.id === c.id ? "border-indigo-600 bg-indigo-50 shadow-md" : "border-slate-200 bg-white hover:border-indigo-300"}`}
          >
            <div className="bg-indigo-100 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
              <Book className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="font-bold text-xl text-slate-900">{c.title}</h3>
            <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">{c.description}</p>
            <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Enrolled</span>
              <span className="flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Manage</span>
            </div>
          </div>
        ))}
        {courses.length === 0 && (
          <div className="md:col-span-3 py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl">
            <p className="text-slate-400 font-medium">You haven't created any courses yet.</p>
          </div>
        )}
      </div>

      {showAddCourse && <AddCourseModal onClose={() => setShowAddCourse(false)} onAdded={fetchCourses} />}

      {activeCourse && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-10 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">{activeCourse.title}</h2>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowEditCourse(true)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
              >
                Edit Details
              </button>
              <button 
                onClick={async () => {
                  if(confirm("Are you sure you want to delete this course?")) {
                    await deleteDoc(doc(db, "courses", activeCourse.id));
                    setActiveCourse(null);
                    fetchCourses();
                  }
                }}
                className="text-xs font-bold text-rose-500 hover:text-rose-700 uppercase tracking-wider"
              >
                Delete Course
              </button>
              <button 
                onClick={() => setActiveCourse(null)}
                className="text-sm font-bold text-slate-400 hover:text-slate-600"
              >
                CLOSE
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-8">
              <EnrollmentManager course={activeCourse} />
              <AICurriculumBuilder course={activeCourse} onUpdated={() => {
                fetchCourses();
                // Update local active course state
                const updated = courses.find(c => c.id === activeCourse.id);
                if (updated) setActiveCourse(updated);
              }} />
              <MathInsights course={activeCourse} />
            </div>
            <div className="lg:col-span-8">
              <MaterialManager course={activeCourse} />
            </div>
          </div>
        </motion.div>
      )}

      {showEditCourse && activeCourse && (
        <EditCourseModal 
          course={activeCourse} 
          onClose={() => setShowEditCourse(false)} 
          onUpdated={() => {
            fetchCourses();
            setShowEditCourse(false);
          }} 
        />
      )}
    </div>
  );
}

function EditCourseModal({ course, onClose, onUpdated }: { course: Course, onClose: () => void, onUpdated: () => void }) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [topics, setTopics] = useState<string[]>(course.topics || []);
  const [newTopic, setNewTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const courseRef = doc(db, "courses", course.id);
      await updateDoc(courseRef, {
        title,
        description,
        topics
      });
      onUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addTopic = () => {
    if (newTopic.trim()) {
      setTopics([...topics, newTopic.trim()]);
      setNewTopic("");
    }
  };

  const removeTopic = (index: number) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-2xl font-bold mb-6">Edit Course Details</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-bold mb-1">Course Title</label>
              <input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                required 
                className="w-full border rounded-lg px-3 py-2 bg-slate-50 focus:bg-white transition-colors" 
                placeholder="e.g. Advanced Calculus II" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Description</label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="w-full border rounded-lg px-3 py-2 h-24 bg-slate-50 focus:bg-white transition-colors" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Manage Curriculum (Topics)</label>
              <div className="flex gap-2 mb-3">
                <input 
                  value={newTopic} 
                  onChange={e => setNewTopic(e.target.value)} 
                  className="flex-1 border rounded-lg px-3 py-2 text-sm" 
                  placeholder="Add a new topic..." 
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTopic())}
                />
                <button 
                  type="button" 
                  onClick={addTopic}
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                {topics.length > 0 ? topics.map((t, i) => (
                  <span key={i} className="bg-white border px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                    {t}
                    <button type="button" onClick={() => removeTopic(i)} className="text-rose-500 hover:text-rose-700">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )) : (
                  <p className="text-xs text-slate-400 italic">No topics added yet.</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-6">
            <button type="button" onClick={onClose} className="flex-1 border py-3 rounded-xl font-bold hover:bg-slate-50">Cancel</button>
            <button disabled={loading} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function AICurriculumBuilder({ course, onUpdated }: { course: Course, onUpdated: () => void }) {
  const [loading, setLoading] = useState(false);

  const generateTopics = async () => {
    setLoading(true);
    try {
      const response = await plannerAgent.recommendNext(null, course.title);
      // In a real scenario, we'd generate a LIST of topics. 
      // For now, we'll append the recommended next topic.
      const courseRef = doc(db, "courses", course.id);
      await updateDoc(courseRef, {
        topics: [...(course.topics || []), response.nextTopic]
      });
      onUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-100 space-y-4 text-white">
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-indigo-200" />
        <h3 className="font-bold text-lg">AI Curriculum Planner</h3>
      </div>
      <p className="text-indigo-100 text-sm leading-relaxed">
        Let AI suggest mathematical topics and learning objectives based on your course title.
      </p>
      <button 
        disabled={loading}
        onClick={generateTopics}
        className="w-full bg-white text-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {loading ? "Generating..." : "Suggest Next Topic"}
      </button>

      {course.topics && course.topics.length > 0 && (
        <div className="pt-4 border-t border-indigo-500/30">
          <p className="text-xs font-bold text-indigo-300 uppercase mb-2">Current Curriculum</p>
          <div className="flex flex-wrap gap-2">
            {course.topics.map(t => (
              <span key={t} className="bg-indigo-500/50 px-2 py-1 rounded text-xs font-medium">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MathInsights({ course }: { course: Course }) {
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const getInsight = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `As a master mathematics instructor, provide 3 brief, intuitive, and high-impact pedagogical insights for a course titled "${course.title}". Focus on how to make complex concepts intuitive. Format as a simple list with headings. Use LaTeX for math.`;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      setInsight(response.text || "No insights found.");
    } catch (err) {
      console.error(err);
      setInsight("Unable to load insights at this time.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-600" /> 
          Teaching Insights
        </h3>
        <button 
          onClick={getInsight}
          disabled={loading}
          className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded"
        >
          {loading ? "THINKING..." : "GET NEW INSIGHTS"}
        </button>
      </div>
      
      {insight ? (
        <MathDisplay content={insight} className="!prose-sm text-slate-600" />
      ) : (
        <p className="text-xs text-slate-400 italic">Click to generate AI-powered teaching strategies for this course.</p>
      )}
    </div>
  );
}


function AddCourseModal({ onClose, onAdded }: { onClose: () => void, onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await addDoc(collection(db, "courses"), {
      title,
      description,
      instructorId: auth.currentUser?.uid,
      topics: [],
      createdAt: serverTimestamp()
    });
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold mb-4">Create Course</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Course Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Advanced Calculus II" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border rounded-lg px-3 py-2 h-24" />
          </div>
          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="flex-1 border py-2 rounded-lg font-bold">Cancel</button>
            <button disabled={loading} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold">
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function EnrollmentManager({ course }: { course: Course }) {
  const [email, setEmail] = useState("");
  const [enrollments, setEnrollments] = useState<(Enrollment & { profile?: UserProfile, userId?: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ email: string, userId: string, enrollmentId: string } | null>(null);

  useEffect(() => {
    fetchEnrollments();
  }, [course.id]);

  const fetchEnrollments = async () => {
    const q = query(collection(db, "enrollments"), where("courseId", "==", course.id));
    const snap = await getDocs(q);
    const enrols = snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));
    
    // Fetch profiles for enrolled students to show stats
    const enriched = await Promise.all(enrols.map(async (e) => {
      try {
        const profileQuery = query(collectionGroup(db, "info"), where("email", "==", e.studentEmail));
        const profileSnap = await getDocs(profileQuery);
        if (!profileSnap.empty) {
          const profileDoc = profileSnap.docs[0];
          const profileData = profileDoc.data() as UserProfile;
          // users/{uid}/profile/info -> parent is 'profile', parent.parent is 'users/{uid}'
          const userId = profileDoc.ref.parent.parent?.id;
          return { ...e, profile: profileData, userId };
        }
      } catch (err) {
        console.warn("Could not fetch profile for", e.studentEmail, err);
      }
      return { ...e };
    }));

    setEnrollments(enriched);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await addDoc(collection(db, "enrollments"), {
      courseId: course.id,
      studentEmail: email.toLowerCase().trim(),
      status: "pending",
      createdAt: serverTimestamp()
    });
    setEmail("");
    fetchEnrollments();
    setLoading(false);
  };

  const handleRemove = async (id: string) => {
    if (confirm("Are you sure you want to remove this student?")) {
      await deleteDoc(doc(db, "enrollments", id));
      fetchEnrollments();
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-xl flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" /> Students
        </h3>
        <span className="text-xs font-bold text-slate-400 uppercase">{enrollments.length} ENROLLED</span>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input 
          type="email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          placeholder="student@example.com"
          required
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
        />
        <button disabled={loading} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 transition-colors">
          Add
        </button>
      </form>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
        {enrollments.map(e => (
          <div key={e.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-all group">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800">{e.studentEmail}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{e.status}</span>
                {e.profile && (
                  <>
                    <span className="text-[10px] text-slate-300">•</span>
                    <span className="text-[10px] text-indigo-600 font-bold uppercase">{e.profile.level || "Beginner"}</span>
                    <span className="text-[10px] text-slate-300">•</span>
                    <span className="text-[10px] text-amber-600 font-bold uppercase">{e.profile.totalPoints} PTS</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {e.userId && (
                <button 
                  onClick={() => setSelectedStudent({ email: e.studentEmail, userId: e.userId!, enrollmentId: e.id })}
                  className="text-[10px] font-bold text-indigo-600 hover:bg-white px-2 py-1 rounded border border-indigo-100 transition-all"
                >
                  VIEW PROGRESS
                </button>
              )}
              <button 
                onClick={() => handleRemove(e.id)}
                className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition-all p-1"
                title="Remove Student"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {enrollments.length === 0 && (
          <p className="text-center py-6 text-sm text-slate-400 italic">No students enrolled yet.</p>
        )}
      </div>

      {selectedStudent && (
        <StudentProgressModal 
          student={selectedStudent} 
          onClose={() => setSelectedStudent(null)} 
          courseId={course.id}
        />
      )}
    </div>
  );
}

function StudentProgressModal({ student, onClose, courseId }: { student: { email: string, userId: string, enrollmentId: string }, onClose: () => void, courseId: string }) {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"progress" | "notes">("progress");

  useEffect(() => {
    fetchData();
  }, [student.userId, student.enrollmentId, courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Assessments
      const q = query(collection(db, "users", student.userId, "assessments")); 
      const snap = await getDocs(q);
      setAssessments(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a, b) => b.completedAt?.toMillis() - a.completedAt?.toMillis()));

      // Fetch Private Notes
      const notesQ = query(collection(db, "enrollments", student.enrollmentId, "notes"));
      const notesSnap = await getDocs(notesQ);
      setNotes(notesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      await addDoc(collection(db, "enrollments", student.enrollmentId, "notes"), {
        content: newNote,
        createdAt: serverTimestamp()
      });
      setNewNote("");
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm("Delete this note?")) return;
    try {
      await deleteDoc(doc(db, "enrollments", student.enrollmentId, "notes", noteId));
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Student Profile</h2>
            <p className="text-sm text-slate-500">{student.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <Trash2 className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="flex gap-4 mb-6 border-b border-slate-100">
          <button 
            onClick={() => setTab("progress")}
            className={`pb-2 px-1 text-sm font-bold transition-all ${tab === "progress" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
          >
            PROGRESS
          </button>
          <button 
            onClick={() => setTab("notes")}
            className={`pb-2 px-1 text-sm font-bold transition-all ${tab === "notes" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
          >
            PRIVATE NOTES
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {tab === "progress" ? (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assessment History</h3>
                {assessments.map(a => (
                  <div key={a.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800">{a.topicId}</h4>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
                        {a.completedAt?.toDate().toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-indigo-600">{a.score}/{a.totalQuestions}</div>
                    </div>
                  </div>
                ))}
                {assessments.length === 0 && <p className="py-10 text-center text-slate-400 text-sm italic">No assessments yet.</p>}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <textarea 
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a private note about this student's performance..."
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={addNote}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Save Note
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pb-10">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Past Notes</h3>
                  {notes.map(n => (
                    <div key={n.id} className="p-4 bg-amber-50 rounded-2xl border border-amber-100 relative group">
                      <p className="text-sm text-slate-800 leading-relaxed pb-6 whitespace-pre-wrap">{n.content}</p>
                      <div className="absolute bottom-4 left-4 text-[10px] text-amber-600 font-bold tracking-tighter flex items-center gap-2">
                        <Sparkles className="w-3 h-3" />
                        {n.createdAt?.toDate().toLocaleString()}
                      </div>
                      <button 
                        onClick={() => deleteNote(n.id)}
                        className="absolute bottom-4 right-4 text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {notes.length === 0 && <p className="py-10 text-center text-slate-400 text-sm italic">No private notes yet.</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function MaterialManager({ course }: { course: Course }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [drafts, setDrafts] = useState<{ title: string; content: string }[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);

  useEffect(() => {
    fetchMaterials();
  }, [course.id]);

  const fetchMaterials = async () => {
    const q = collection(db, "courses", course.id, "materials");
    const snap = await getDocs(q);
    setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
  };

  const suggestMaterial = async () => {
    setSuggesting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `As a master mathematics professor, draft 3 DIFFERENT versions of an intuitive lesson for "${course.title}". 
      Each version should focus on a unique pedagogical angle:
      1. Geometric/Visual Metaphors
      2. First Principles/Logical Rigor
      3. Practical/Real-world Applications
      
      Requirements:
      - Use LaTeX for ALL math ($...$).
      - Use clear Markdown.
      - Each lesson should have a descriptive sub-title.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              drafts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    content: { type: "string" }
                  },
                  required: ["title", "content"]
                }
              }
            },
            required: ["drafts"]
          }
        } as any
      });

      const result = JSON.parse(response.text || '{"drafts":[]}');
      setDrafts(result.drafts || []);
      setShowDrafts(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSuggesting(false);
    }
  };

  const commitDraft = async (title: string, content: string) => {
    await addDoc(collection(db, "courses", course.id, "materials"), {
      title,
      content,
      type: "lesson",
      createdAt: serverTimestamp()
    });
    fetchMaterials();
    setShowDrafts(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-xl flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-600" /> Course Materials</h3>
        <div className="flex gap-2">
          <button 
            disabled={suggesting}
            onClick={suggestMaterial}
            className="text-[10px] font-bold text-amber-600 hover:bg-amber-50 px-2 py-1 rounded border border-amber-200"
          >
            {suggesting ? "DRAFTING..." : "AI DRAFT"}
          </button>
          <button onClick={() => setShowAdd(true)} className="text-xs font-bold text-indigo-600 hover:underline">ADD MATERIAL</button>
        </div>
      </div>

      <div className="space-y-4">
        {materials.map(m => (
          <div key={m.id} className="p-4 bg-white border border-slate-100 rounded-xl hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-800">{m.title}</h4>
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded uppercase font-bold text-slate-500">{m.type}</span>
            </div>
            <div className="text-xs text-slate-500 line-clamp-2">
              <MathDisplay content={m.content} className="!prose-xs" />
            </div>
          </div>
        ))}
      </div>

      {showAdd && <AddMaterialModal courseId={course.id} onClose={() => setShowAdd(false)} onAdded={fetchMaterials} />}

      {showDrafts && (
        <DraftsModal 
          drafts={drafts} 
          onClose={() => setShowDrafts(false)} 
          onConfirm={commitDraft} 
        />
      )}
    </div>
  );
}

function DraftsModal({ drafts, onClose, onConfirm }: { drafts: { title: string; content: string }[], onClose: () => void, onConfirm: (title: string, content: string) => void }) {
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [editedTitle, setEditedTitle] = useState("");

  useEffect(() => {
    if (drafts[index]) {
      setEditedContent(drafts[index].content);
      setEditedTitle(drafts[index].title);
    }
  }, [index, drafts]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-8 w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 p-2.5 rounded-xl">
              <Sparkles className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Review AI Drafts</h2>
              <p className="text-sm text-slate-500 font-medium">Version {index + 1} of {drafts.length}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <Trash2 className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 rounded-2xl border border-slate-100 mb-6">
          <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between">
            {editing ? (
              <input 
                value={editedTitle} 
                onChange={e => setEditedTitle(e.target.value)} 
                className="font-bold text-xl text-slate-800 bg-slate-50 px-2 py-1 rounded w-full outline-none focus:ring-2 focus:ring-indigo-500" 
              />
            ) : (
              <h3 className="font-bold text-xl text-slate-800">{editedTitle}</h3>
            )}
            <button 
              onClick={() => setEditing(!editing)}
              className="text-xs font-bold text-indigo-600 hover:underline uppercase p-2"
            >
              {editing ? "Preview Mode" : "Edit Mode"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {editing ? (
              <textarea 
                value={editedContent} 
                onChange={e => setEditedContent(e.target.value)} 
                className="w-full h-full bg-slate-50 font-mono text-sm leading-relaxed p-4 rounded-xl outline-none border-0 resize-none" 
              />
            ) : (
              <MathDisplay content={editedContent} />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          <div className="flex gap-3">
            <button 
              disabled={index === 0}
              onClick={() => setIndex(i => i - 1)}
              className="p-4 border border-slate-200 rounded-2xl disabled:opacity-30 hover:bg-slate-50 transition-all flex items-center gap-2 font-bold text-slate-600"
            >
              <ChevronLeft className="w-5 h-5" /> Prev
            </button>
            <button 
              disabled={index === drafts.length - 1}
              onClick={() => setIndex(i => i + 1)}
              className="p-4 border border-slate-200 rounded-2xl disabled:opacity-30 hover:bg-slate-50 transition-all flex items-center gap-2 font-bold text-slate-600"
            >
              Next <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <button 
            onClick={() => onConfirm(editedTitle, editedContent)}
            className="flex items-center gap-3 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
          >
            <Check className="w-5 h-5" />
            Commit This Draft
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AddMaterialModal({ courseId, onClose, onAdded }: { courseId: string, onClose: () => void, onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"lesson" | "assignment">("lesson");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await addDoc(collection(db, "courses", courseId, "materials"), {
      title,
      content,
      type,
      createdAt: serverTimestamp()
    });
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl">
        <h2 className="text-2xl font-bold mb-4">Add Material</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Riemann Integration" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value as any)} className="w-full border rounded-lg px-3 py-2">
                <option value="lesson">Lesson</option>
                <option value="assignment">Assignment</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Content (Markdown + LaTeX)</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} required className="w-full border rounded-lg px-3 py-2 h-64 font-mono text-sm" placeholder="# Section\n\nExplain math here: $E = mc^2$" />
          </div>
          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="flex-1 border py-2 rounded-lg font-bold">Cancel</button>
            <button disabled={loading} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold">
              {loading ? "Adding..." : "Add Material"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
