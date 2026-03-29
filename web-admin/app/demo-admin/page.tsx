"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDataService } from "../data-service";
import { isDemoModeEnabled } from "../demo-mode";
import type { DemoAnnouncement, DemoCampus, DemoCourse, DemoStudent, DemoTeacher } from "../demo-data";

type ModuleKey = "students" | "teachers" | "courses" | "announcements" | "campuses";

type DemoState = {
  students: DemoStudent[];
  teachers: DemoTeacher[];
  courses: DemoCourse[];
  announcements: DemoAnnouncement[];
  campuses: DemoCampus[];
};

const initialState: DemoState = {
  students: [],
  teachers: [],
  courses: [],
  announcements: [],
  campuses: []
};

export default function DemoAdminPage() {
  const [state, setState] = useState<DemoState>(initialState);
  const [activeModule, setActiveModule] = useState<ModuleKey>("students");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [studentForm, setStudentForm] = useState<Omit<DemoStudent, "id">>({ fullName: "", email: "", campusId: "", department: "", year: "", status: "Active" });
  const [teacherForm, setTeacherForm] = useState<Omit<DemoTeacher, "id">>({ fullName: "", email: "", campusId: "", department: "", specialization: "", status: "Active" });
  const [courseForm, setCourseForm] = useState<Omit<DemoCourse, "id">>({ courseCode: "", title: "", campusId: "", facultyId: "", semesterCode: "", room: "" });
  const [announcementForm, setAnnouncementForm] = useState<Omit<DemoAnnouncement, "id">>({ title: "", message: "", audience: "All", publishedOn: new Date().toISOString() });
  const [campusForm, setCampusForm] = useState<Omit<DemoCampus, "id">>({ name: "", location: "", deanName: "", studentCapacity: 1000 });

  useEffect(() => {
    async function load() {
      if (!isDemoModeEnabled()) {
        setError("Demo data lab is available only when demo mode is enabled.");
        setLoading(false);
        return;
      }

      try {
        const service = getDataService();
        const [students, teachers, courses, announcements, campuses] = await Promise.all([
          service.getStudents(),
          service.getTeachers(),
          service.getCourses(),
          service.getAnnouncements(),
          service.getCampuses()
        ]);

        setState({ students, teachers, courses, announcements, campuses });
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load demo data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function refresh() {
    const service = getDataService();
    const [students, teachers, courses, announcements, campuses] = await Promise.all([
      service.getStudents(),
      service.getTeachers(),
      service.getCourses(),
      service.getAnnouncements(),
      service.getCampuses()
    ]);

    setState({ students, teachers, courses, announcements, campuses });
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);

    try {
      const service = getDataService();
      if (activeModule === "students") await service.addStudent(studentForm);
      if (activeModule === "teachers") await service.addTeacher(teacherForm);
      if (activeModule === "courses") await service.addCourse(courseForm);
      if (activeModule === "announcements") await service.addAnnouncement(announcementForm);
      if (activeModule === "campuses") await service.addCampus(campusForm);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save demo data.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!editingId) {
      await handleCreate();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const service = getDataService();
      if (activeModule === "students") await service.updateStudent(editingId, studentForm);
      if (activeModule === "teachers") await service.updateTeacher(editingId, teacherForm);
      if (activeModule === "courses") await service.updateCourse(editingId, courseForm);
      if (activeModule === "announcements") await service.updateAnnouncement(editingId, announcementForm);
      if (activeModule === "campuses") await service.updateCampus(editingId, campusForm);
      setEditingId(null);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update demo data.");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(module: ModuleKey, id: string) {
    setEditingId(id);
    if (module === "students") {
      const item = state.students.find((entry) => entry.id === id);
      if (item) setStudentForm({ fullName: item.fullName, email: item.email, campusId: item.campusId, department: item.department, year: item.year, status: item.status });
    }
    if (module === "teachers") {
      const item = state.teachers.find((entry) => entry.id === id);
      if (item) setTeacherForm({ fullName: item.fullName, email: item.email, campusId: item.campusId, department: item.department, specialization: item.specialization, status: item.status });
    }
    if (module === "courses") {
      const item = state.courses.find((entry) => entry.id === id);
      if (item) setCourseForm({ courseCode: item.courseCode, title: item.title, campusId: item.campusId, facultyId: item.facultyId, semesterCode: item.semesterCode, room: item.room });
    }
    if (module === "announcements") {
      const item = state.announcements.find((entry) => entry.id === id);
      if (item) setAnnouncementForm({ title: item.title, message: item.message, audience: item.audience, publishedOn: item.publishedOn });
    }
    if (module === "campuses") {
      const item = state.campuses.find((entry) => entry.id === id);
      if (item) setCampusForm({ name: item.name, location: item.location, deanName: item.deanName, studentCapacity: item.studentCapacity });
    }
  }

  async function handleDelete(module: ModuleKey, id: string) {
    setSaving(true);
    setError(null);

    try {
      const service = getDataService();
      if (module === "students") await service.deleteStudent(id);
      if (module === "teachers") await service.deleteTeacher(id);
      if (module === "courses") await service.deleteCourse(id);
      if (module === "announcements") await service.deleteAnnouncement(id);
      if (module === "campuses") await service.deleteCampus(id);
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete demo data.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(size: "small" | "medium" | "large") {
    setSaving(true);
    setError(null);

    try {
      await getDataService().resetDemo(size);
      await refresh();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset demo data.");
    } finally {
      setSaving(false);
    }
  }

  const moduleButtons: { id: ModuleKey; label: string }[] = [
    { id: "students", label: "Students" },
    { id: "teachers", label: "Teachers" },
    { id: "courses", label: "Courses" },
    { id: "announcements", label: "Announcements" },
    { id: "campuses", label: "Campuses" }
  ];

  return (
    <main className="panel-grid min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-[rgba(10,21,37,0.88)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Demo Data Lab</p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Temporary CRUD across all seeded demo modules.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Use this workspace to simulate realistic administrative changes without touching live APIs or production data.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/ops" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white">
                Back to Ops
              </Link>
              <button type="button" onClick={() => handleReset("small")} disabled={saving} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 disabled:opacity-60">
                Reset Small
              </button>
              <button type="button" onClick={() => handleReset("medium")} disabled={saving} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 disabled:opacity-60">
                Reset Medium
              </button>
              <button type="button" onClick={() => handleReset("large")} disabled={saving} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
                Reset Large
              </button>
            </div>
          </div>
        </section>

        {error ? <div className="mt-6 rounded-[1.3rem] border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {moduleButtons.map((module) => (
            <button
              key={module.id}
              type="button"
              onClick={() => {
                setActiveModule(module.id);
                setEditingId(null);
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeModule === module.id ? "bg-cyan-300 text-slate-950" : "border border-white/10 bg-white/5 text-white"
              }`}
            >
              {module.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6">
            <h2 className="text-2xl font-semibold text-white">Create Demo Record</h2>
            <div className="mt-5 grid gap-3">
              {activeModule === "students" ? (
                <>
                  <input value={studentForm.fullName} onChange={(event) => setStudentForm({ ...studentForm, fullName: event.target.value })} placeholder="Student name" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={studentForm.email} onChange={(event) => setStudentForm({ ...studentForm, email: event.target.value })} placeholder="Student email" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={studentForm.campusId} onChange={(event) => setStudentForm({ ...studentForm, campusId: event.target.value })} placeholder="Campus id" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={studentForm.department} onChange={(event) => setStudentForm({ ...studentForm, department: event.target.value })} placeholder="Department" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={studentForm.year} onChange={(event) => setStudentForm({ ...studentForm, year: event.target.value })} placeholder="Year" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                </>
              ) : null}
              {activeModule === "teachers" ? (
                <>
                  <input value={teacherForm.fullName} onChange={(event) => setTeacherForm({ ...teacherForm, fullName: event.target.value })} placeholder="Teacher name" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={teacherForm.email} onChange={(event) => setTeacherForm({ ...teacherForm, email: event.target.value })} placeholder="Teacher email" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={teacherForm.campusId} onChange={(event) => setTeacherForm({ ...teacherForm, campusId: event.target.value })} placeholder="Campus id" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={teacherForm.department} onChange={(event) => setTeacherForm({ ...teacherForm, department: event.target.value })} placeholder="Department" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={teacherForm.specialization} onChange={(event) => setTeacherForm({ ...teacherForm, specialization: event.target.value })} placeholder="Specialization" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                </>
              ) : null}
              {activeModule === "courses" ? (
                <>
                  <input value={courseForm.courseCode} onChange={(event) => setCourseForm({ ...courseForm, courseCode: event.target.value })} placeholder="Course code" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} placeholder="Course title" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={courseForm.campusId} onChange={(event) => setCourseForm({ ...courseForm, campusId: event.target.value })} placeholder="Campus id" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={courseForm.facultyId} onChange={(event) => setCourseForm({ ...courseForm, facultyId: event.target.value })} placeholder="Faculty id" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={courseForm.semesterCode} onChange={(event) => setCourseForm({ ...courseForm, semesterCode: event.target.value })} placeholder="Semester code" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={courseForm.room} onChange={(event) => setCourseForm({ ...courseForm, room: event.target.value })} placeholder="Room" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                </>
              ) : null}
              {activeModule === "announcements" ? (
                <>
                  <input value={announcementForm.title} onChange={(event) => setAnnouncementForm({ ...announcementForm, title: event.target.value })} placeholder="Announcement title" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <textarea value={announcementForm.message} onChange={(event) => setAnnouncementForm({ ...announcementForm, message: event.target.value })} placeholder="Announcement message" className="min-h-28 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={announcementForm.audience} onChange={(event) => setAnnouncementForm({ ...announcementForm, audience: event.target.value })} placeholder="Audience" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                </>
              ) : null}
              {activeModule === "campuses" ? (
                <>
                  <input value={campusForm.name} onChange={(event) => setCampusForm({ ...campusForm, name: event.target.value })} placeholder="Campus name" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={campusForm.location} onChange={(event) => setCampusForm({ ...campusForm, location: event.target.value })} placeholder="Location" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input value={campusForm.deanName} onChange={(event) => setCampusForm({ ...campusForm, deanName: event.target.value })} placeholder="Dean name" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                  <input type="number" value={campusForm.studentCapacity} onChange={(event) => setCampusForm({ ...campusForm, studentCapacity: Number(event.target.value) })} placeholder="Student capacity" className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-white" />
                </>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleSave} disabled={saving || loading} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
                  {saving ? "Saving..." : editingId ? `Update ${activeModule.slice(0, -1)}` : `Create ${activeModule.slice(0, -1)}`}
                </button>
                {editingId ? (
                  <button type="button" onClick={() => setEditingId(null)} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white">
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-white">Demo Records</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {loading ? "Loading" : activeModule}
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {activeModule === "students" ? state.students.map((item) => (
                <RecordCard key={item.id} title={item.fullName} subtitle={`${item.department} · ${item.year}`} meta={item.email} onEdit={() => handleEdit("students", item.id)} onDelete={() => handleDelete("students", item.id)} />
              )) : null}
              {activeModule === "teachers" ? state.teachers.map((item) => (
                <RecordCard key={item.id} title={item.fullName} subtitle={`${item.department} · ${item.specialization}`} meta={item.email} onEdit={() => handleEdit("teachers", item.id)} onDelete={() => handleDelete("teachers", item.id)} />
              )) : null}
              {activeModule === "courses" ? state.courses.map((item) => (
                <RecordCard key={item.id} title={`${item.courseCode} · ${item.title}`} subtitle={`${item.semesterCode} · ${item.room}`} meta={item.facultyId} onEdit={() => handleEdit("courses", item.id)} onDelete={() => handleDelete("courses", item.id)} />
              )) : null}
              {activeModule === "announcements" ? state.announcements.map((item) => (
                <RecordCard key={item.id} title={item.title} subtitle={item.audience} meta={item.publishedOn} onEdit={() => handleEdit("announcements", item.id)} onDelete={() => handleDelete("announcements", item.id)} />
              )) : null}
              {activeModule === "campuses" ? state.campuses.map((item) => (
                <RecordCard key={item.id} title={item.name} subtitle={`${item.location} · ${item.studentCapacity} seats`} meta={item.deanName} onEdit={() => handleEdit("campuses", item.id)} onDelete={() => handleDelete("campuses", item.id)} />
              )) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function RecordCard({ title, subtitle, meta, onEdit, onDelete }: { title: string; subtitle: string; meta: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <article className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{subtitle}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-cyan-200">{meta}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onEdit} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100">
            Edit
          </button>
          <button type="button" onClick={onDelete} className="rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-100">
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
