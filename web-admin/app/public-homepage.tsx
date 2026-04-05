"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { apiConfig } from "./api-config";
import ChatWidget from "./chat-widget";

type StatItem = { label: string; value: string };
type CampusItem = {
  id: string;
  collegeId: string;
  name: string;
  location: string;
  description: string;
  image: string;
  statLabel: string;
  statValue: string;
  facilities: string[];
};
type ProgramItem = {
  id: string;
  campusId: string;
  code: string;
  name: string;
  levelName: string;
  departmentName: string;
  durationYears: number;
  seats: number;
  mode: string;
  description: string;
  careerPath: string;
};
type AnnouncementItem = {
  id: string;
  title: string;
  summary: string;
  badge: string;
  publishedOn: string;
};
type JourneyStep = { title: string; detail: string };
type ContactCard = { email: string; phone: string; office: string };
type CatalogPayload = {
  stats: StatItem[];
  campuses: CampusItem[];
  featuredPrograms: ProgramItem[];
  campusOptions: Array<{ id: string; name: string }>;
  levelOptions: string[];
};
type ContentPayload = {
  tickerItems: string[];
  announcements: AnnouncementItem[];
  admissionsJourney: JourneyStep[];
  contact: ContactCard;
};

const tenantId = "default";
const defaultCatalog: CatalogPayload = {
  stats: [],
  campuses: [],
  featuredPrograms: [],
  campusOptions: [],
  levelOptions: []
};
const defaultContent: ContentPayload = {
  tickerItems: [
    "Admissions, campus visits, and scholarship guidance are available through the live platform.",
    "Use the inquiry form to connect the public website directly to the operations workflow."
  ],
  announcements: [],
  admissionsJourney: [
    { title: "Discover programs", detail: "Search live programs by campus and study level." },
    { title: "Talk to admissions", detail: "Share your interest so the team can follow up from the ops workspace." },
    { title: "Plan the next step", detail: "Move into counseling, visit scheduling, and application readiness." }
  ],
  contact: {
    email: "admissions@university360.edu",
    phone: "+91 80000 12345",
    office: "University Operations Office, Bengaluru"
  }
};
const roleCards = [
  {
    title: "Students",
    description: "Results, attendance, next classes, and fee visibility without admin clutter.",
    href: "/student"
  },
  {
    title: "Teachers",
    description: "Attendance, course load, and communication kept close to day-to-day teaching decisions.",
    href: "/teacher"
  },
  {
    title: "Operations",
    description: "Admissions, audit visibility, notifications, and role-aware control in one place.",
    href: "/ops"
  }
];

function buildProgramQuery(search: string, campusId: string, level: string) {
  const params = new URLSearchParams({ tenantId });
  if (search) params.set("search", search);
  if (campusId) params.set("campusId", campusId);
  if (level) params.set("level", level);
  return params.toString();
}

export default function PublicHomepage() {
  const [catalog, setCatalog] = useState<CatalogPayload>(defaultCatalog);
  const [content, setContent] = useState<ContentPayload>(defaultContent);
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [programLoading, setProgramLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCampus, setSelectedCampus] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    preferredCampus: "",
    interestedProgram: "",
    message: ""
  });
  const [submitState, setSubmitState] = useState<{ loading: boolean; error: string | null; success: string | null }>({
    loading: false,
    error: null,
    success: null
  });
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [catalogResponse, contentResponse] = await Promise.all([
          fetch(`${apiConfig.organization()}/api/v1/public/homepage?tenantId=${tenantId}`),
          fetch(`${apiConfig.communication()}/api/v1/public/homepage?tenantId=${tenantId}`)
        ]);

        if (!catalogResponse.ok || !contentResponse.ok) {
          throw new Error("Public content is temporarily running with partial data while the live services warm up.");
        }

        const [catalogPayload, contentPayload] = await Promise.all([
          catalogResponse.json() as Promise<CatalogPayload>,
          contentResponse.json() as Promise<ContentPayload>
        ]);

        if (!cancelled) {
          setCatalog(catalogPayload);
          setContent(contentPayload);
          setPrograms(catalogPayload.featuredPrograms);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Public content is temporarily unavailable.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPrograms() {
      if (!catalog.campusOptions.length && !catalog.featuredPrograms.length) {
        return;
      }

      setProgramLoading(true);
      try {
        const response = await fetch(`${apiConfig.organization()}/api/v1/public/programs?${buildProgramQuery(deferredSearch, selectedCampus, selectedLevel)}`);
        if (!response.ok) {
          throw new Error("Program explorer is temporarily unavailable.");
        }

        const payload = (await response.json()) as ProgramItem[];
        if (!cancelled) {
          setPrograms(payload);
        }
      } catch {
        if (!cancelled) {
          const query = deferredSearch.toLowerCase();
          setPrograms(
            catalog.featuredPrograms.filter((program) => {
              if (selectedCampus && program.campusId !== selectedCampus) return false;
              if (selectedLevel && program.levelName !== selectedLevel) return false;
              if (!query) return true;
              return [program.name, program.code, program.departmentName, program.description, program.careerPath]
                .some((value) => value.toLowerCase().includes(query));
            })
          );
        }
      } finally {
        if (!cancelled) {
          setProgramLoading(false);
        }
      }
    }

    loadPrograms();
    return () => {
      cancelled = true;
    };
  }, [catalog.campusOptions.length, catalog.featuredPrograms, deferredSearch, selectedCampus, selectedLevel]);

  const featuredCampus = useMemo(() => catalog.campuses[0], [catalog.campuses]);

  async function handleInquirySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState({ loading: true, error: null, success: null });

    try {
      const response = await fetch(`${apiConfig.communication()}/api/v1/public/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, ...form })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message ?? "Unable to submit the admissions inquiry.");
      }

      setForm({
        fullName: "",
        email: "",
        phone: "",
        preferredCampus: "",
        interestedProgram: "",
        message: ""
      });
      setSubmitState({
        loading: false,
        error: null,
        success: payload?.message ?? "Admissions inquiry submitted successfully."
      });
    } catch (submitError) {
      setSubmitState({
        loading: false,
        error: submitError instanceof Error ? submitError.message : "Unable to submit the admissions inquiry.",
        success: null
      });
    }
  }

  return (
    <main className="panel-grid min-h-screen overflow-x-hidden text-slate-100">
      <section className="relative isolate px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="sticky top-4 z-20 rounded-[2rem] border border-white/10 bg-[rgba(8,20,36,0.78)] px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.45em] text-cyan-300/90">University360</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold text-white sm:text-3xl">College Management Platform</h1>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-emerald-200">
                    Live admissions + campus ops
                  </span>
                </div>
              </div>

              <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <a href="#programs" className="rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white">Programs</a>
                <a href="#campuses" className="rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white">Campuses</a>
                <a href="#announcements" className="rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white">Announcements</a>
                <a href="#inquiry" className="rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white">Admissions</a>
                <Link href="/auth" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-medium text-white transition hover:bg-white/10">
                  Login
                </Link>
                <a href="#inquiry" className="rounded-full bg-cyan-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-200">
                  Apply Now
                </a>
              </nav>
            </div>
          </header>

          <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-cyan-300/15 bg-[rgba(12,29,48,0.72)] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur">
            <div className="ticker-track whitespace-nowrap text-sm text-cyan-100">
              {[...content.tickerItems, ...content.tickerItems].map((item, index) => (
                <span key={`${item}-${index}`} className="mx-6 inline-flex items-center gap-3">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-300" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <section className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(7,18,34,0.95),rgba(14,40,73,0.86)_58%,rgba(5,13,25,0.96))] p-6 shadow-[0_32px_100px_rgba(3,10,20,0.5)] sm:p-8 lg:p-10">
              <div className="absolute inset-y-0 right-[-8%] hidden aspect-square w-[48%] rounded-full bg-cyan-300/10 blur-3xl lg:block" />
              <div className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />
              <div className="relative">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-100">
                  Public discovery connected to operations
                </span>
                <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                  Explore campuses, compare programs, and move directly into admissions support.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                  The public site now reflects live campus and program data instead of static brochure copy, and every inquiry can flow into the authenticated operations workspace.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href="#programs" className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">Discover Programs</a>
                  <a href="#inquiry" className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Talk to Admissions</a>
                </div>
                <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {catalog.stats.map((item) => (
                    <div key={item.label} className="rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-4 backdrop-blur">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                      <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : item.value}</p>
                    </div>
                  ))}
                </div>
                {error ? <div className="mt-6 rounded-[1.4rem] border border-amber-300/20 bg-amber-400/10 px-4 py-4 text-sm leading-6 text-amber-50">{error}</div> : null}
              </div>
            </section>

            <aside className="grid gap-5">
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(12,24,41,0.82)] shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur">
                <div className="border-b border-white/10 px-6 py-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Featured campus</p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">{featuredCampus?.name ?? "Campus network"}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{featuredCampus?.description ?? "Browse the live multi-campus structure across the institution."}</p>
                </div>
                <img src={featuredCampus?.image ?? "/images/graduation-hero.svg"} alt={featuredCampus?.name ?? "Featured campus"} className="h-72 w-full object-cover" />
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[rgba(12,24,41,0.82)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur">
                <p className="text-xs uppercase tracking-[0.35em] text-amber-200">Why this is stronger</p>
                <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                  <p>Public content, campus data, and programs now come from live service contracts.</p>
                  <p>Admissions leads are captured for follow-up instead of ending in static contact copy.</p>
                  <p>Role workspaces stay available, but no longer compete with the public homepage for attention.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {roleCards.map((item) => (
            <Link key={item.title} href={item.href} className="group rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur transition hover:-translate-y-1 hover:border-cyan-300/30">
              <h3 className="text-2xl font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">{item.description}</p>
              <p className="mt-5 text-sm font-medium text-cyan-100">Open workspace</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8" id="programs">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Program explorer</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Search live academic pathways</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-400">This section is backed by the public catalog API so applicants can browse programs by campus and study level.</p>
          </div>

          <div className="mt-6 rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.82)] p-5 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by program, code, department, or career path" className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
              <select value={selectedCampus} onChange={(event) => setSelectedCampus(event.target.value)} className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none">
                <option value="">All campuses</option>
                {catalog.campusOptions.map((campus) => <option key={campus.id} value={campus.id} className="bg-slate-950">{campus.name}</option>)}
              </select>
              <select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)} className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none">
                <option value="">All levels</option>
                {catalog.levelOptions.map((level) => <option key={level} value={level} className="bg-slate-950">{level}</option>)}
              </select>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {programs.map((program) => {
                const campus = catalog.campuses.find((item) => item.id === program.campusId);
                return (
                  <article key={program.id} className="rounded-[1.6rem] border border-white/10 bg-slate-950/35 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">{program.levelName}</span>
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{program.code}</span>
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-white">{program.name}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{program.description}</p>
                    <p className="mt-4 text-sm leading-6 text-slate-300">{program.departmentName} | {program.durationYears} years | {program.seats} seats</p>
                    <p className="mt-2 text-sm leading-6 text-cyan-100/90">{campus?.name ?? "Campus network"} | {program.mode}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-400">Career path: {program.careerPath}</p>
                  </article>
                );
              })}
            </div>

            {!programLoading && programs.length === 0 ? <div className="mt-6 rounded-[1.4rem] border border-dashed border-white/15 bg-white/4 px-4 py-6 text-sm text-slate-400">No programs matched the current filters.</div> : null}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8" id="campuses">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Campus network</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">College and campus structure made visible</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-400">The multi-college model is now surfaced clearly for applicants and staff instead of being implied in the documentation only.</p>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            {catalog.campuses.map((campus) => (
              <article key={campus.id} className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.8)] shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
                <img src={campus.image} alt={campus.name} className="h-56 w-full object-cover" />
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold text-white">{campus.name}</h3>
                      <p className="mt-1 text-sm text-cyan-100">{campus.location}</p>
                    </div>
                    <div className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{campus.statLabel}</p>
                      <p className="mt-1 text-xl font-semibold text-white">{campus.statValue}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-400">{campus.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {campus.facilities.map((item) => <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">{item}</span>)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8" id="announcements">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Announcements</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Live public communication feed</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-400">These notices now come from the communication service, which keeps the public site aligned with the admin publishing flow.</p>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-4">
            {content.announcements.map((item) => (
              <article key={item.id} className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-100">{item.badge}</span>
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.publishedOn}</span>
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-white">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-400">{item.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8" id="inquiry">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Admissions journey</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Turn public interest into an operational workflow</h2>
            <div className="mt-6 space-y-4">
              {content.admissionsJourney.map((step, index) => (
                <article key={step.title} className="rounded-[1.4rem] border border-white/10 bg-slate-950/35 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Step {index + 1}</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{step.detail}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-sm font-medium text-white">Admissions contact</p>
              <p className="mt-3 text-sm leading-7 text-slate-400">{content.contact.email}</p>
              <p className="text-sm leading-7 text-slate-400">{content.contact.phone}</p>
              <p className="text-sm leading-7 text-slate-400">{content.contact.office}</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(16,30,48,0.95),rgba(27,50,80,0.86)_58%,rgba(8,18,34,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Inquiry form</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Request a guided admissions follow-up</h2>

            <form className="mt-6 space-y-4" onSubmit={handleInquirySubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Full name" className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" required />
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="Email address" className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
                <select value={form.preferredCampus} onChange={(event) => setForm((current) => ({ ...current, preferredCampus: event.target.value }))} className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none">
                  <option value="">Preferred campus</option>
                  {catalog.campusOptions.map((campus) => <option key={campus.id} value={campus.name} className="bg-slate-950">{campus.name}</option>)}
                </select>
              </div>
              <input value={form.interestedProgram} onChange={(event) => setForm((current) => ({ ...current, interestedProgram: event.target.value }))} placeholder="Interested program" className="w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" required />
              <textarea value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} placeholder="Tell the admissions team what you need help with" className="min-h-36 w-full rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" required />
              {submitState.error ? <div className="rounded-[1.1rem] border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{submitState.error}</div> : null}
              {submitState.success ? <div className="rounded-[1.1rem] border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{submitState.success}</div> : null}
              <button type="submit" disabled={submitState.loading} className="w-full rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">
                {submitState.loading ? "Submitting..." : "Submit Inquiry"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">University360</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">A more complete college platform from public trust to operational follow-through.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Discovery, admissions, campus structure, and internal workspaces now point to the same service-backed operating model.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-5 backdrop-blur">
              <p className="text-sm font-medium text-white">Contact</p>
              <p className="mt-3 text-sm leading-7 text-slate-400">{content.contact.email}</p>
              <p className="text-sm leading-7 text-slate-400">{content.contact.phone}</p>
              <p className="text-sm leading-7 text-slate-400">{content.contact.office}</p>
            </div>
            <div className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-5 backdrop-blur">
              <p className="text-sm font-medium text-white">Quick links</p>
              <p className="mt-3 text-sm leading-7 text-slate-400">Programs</p>
              <p className="text-sm leading-7 text-slate-400">Admissions</p>
              <p className="text-sm leading-7 text-slate-400">Student / Teacher / Operations</p>
            </div>
          </div>
        </div>
      </footer>

      <ChatWidget mode="public" />
    </main>
  );
}
