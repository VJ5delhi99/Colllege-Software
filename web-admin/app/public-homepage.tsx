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
    "Admissions help, campus visits, and scholarship guidance are available here.",
    "Use the inquiry form to request a call or follow-up from the admissions team."
  ],
  announcements: [],
  admissionsJourney: [
    { title: "Discover programs", detail: "Search live programs by campus and study level." },
    { title: "Talk to admissions", detail: "Share your interest so the admissions team can contact you." },
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
    description: "Attendance, results, fees, and requests in one student page.",
    href: "/auth?role=Student&redirect=%2Fstudent"
  },
  {
    title: "Teachers",
    description: "Classes, attendance, marking, and student guidance in one teacher page.",
    href: "/auth?role=Teacher&redirect=%2Fteacher"
  },
  {
    title: "Operations",
    description: "Admissions, support, and daily college follow-up tools for staff teams.",
    href: "/auth?role=Operations&redirect=%2Fops"
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
          throw new Error("Some website information is still loading. Please try again in a moment.");
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
          setError(loadError instanceof Error ? loadError.message : "Some website information is temporarily unavailable.");
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
          throw new Error("The program list is temporarily unavailable.");
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
  const schoolHighlights = useMemo(() => {
    const grouped = new Map<string, { departmentName: string; levels: Set<string>; count: number }>();
    for (const program of catalog.featuredPrograms) {
      const current = grouped.get(program.departmentName) ?? {
        departmentName: program.departmentName,
        levels: new Set<string>(),
        count: 0
      };
      current.levels.add(program.levelName);
      current.count += 1;
      grouped.set(program.departmentName, current);
    }

    return Array.from(grouped.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [catalog.featuredPrograms]);

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

  function focusInquiry(programName?: string, campusName?: string) {
    if (programName || campusName) {
      setForm((current) => ({
        ...current,
        interestedProgram: programName ?? current.interestedProgram,
        preferredCampus: campusName ?? current.preferredCampus
      }));
    }

    if (typeof window !== "undefined") {
      document.getElementById("inquiry")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4efe6] text-slate-900">
      <section className="border-b border-slate-200 bg-[#153a31] px-4 py-3 text-sm text-[#f8f4ed] sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <span>{content.contact.phone}</span>
            <span>{content.contact.email}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#inquiry" className="transition hover:text-white">Admissions</a>
            <a href="#announcements" className="transition hover:text-white">Updates</a>
            <Link href="/auth" className="font-medium text-white underline underline-offset-4">Student / Faculty Login</Link>
          </div>
        </div>
      </section>

      <section className="relative isolate px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#d7cfbf] bg-[#fbf8f2] shadow-[0_20px_60px_rgba(34,33,28,0.08)]">
          <header className="rounded-t-[2rem] border-b border-[#e3dccd] px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.45em] text-[#7a674d]">University360</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold text-[#12263a] sm:text-3xl">College Management Platform</h1>
                  <span className="rounded-full border border-[#d7cfbf] bg-[#efe7d7] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#7a674d]">
                    Admissions 2026
                  </span>
                </div>
              </div>

              <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <a href="#programs" className="rounded-full px-3 py-2 transition hover:bg-[#efe7d7] hover:text-slate-950">Programs</a>
                <a href="#schools" className="rounded-full px-3 py-2 transition hover:bg-[#efe7d7] hover:text-slate-950">Schools</a>
                <a href="#campuses" className="rounded-full px-3 py-2 transition hover:bg-[#efe7d7] hover:text-slate-950">Campuses</a>
                <a href="#announcements" className="rounded-full px-3 py-2 transition hover:bg-[#efe7d7] hover:text-slate-950">Announcements</a>
                <Link href="/auth" className="rounded-full border border-[#d7cfbf] bg-white px-4 py-2 font-medium text-[#12263a] transition hover:bg-[#f8f3ea]">
                  Login
                </Link>
                <a href="#inquiry" className="rounded-full bg-[#153a31] px-4 py-2 font-semibold text-white transition hover:bg-[#0f2d26]">
                  Apply Now
                </a>
              </nav>
            </div>
          </header>

          <div className="overflow-hidden border-b border-[#e3dccd] bg-[#efe7d7] px-4 py-3">
            <div className="ticker-track whitespace-nowrap text-sm text-[#325f54]">
              {[...content.tickerItems, ...content.tickerItems].map((item, index) => (
                <span key={`${item}-${index}`} className="mx-6 inline-flex items-center gap-3">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#b58c2a]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
            <section className="relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10 lg:p-10">
              <div className="relative">
                <span className="rounded-full border border-[#d7cfbf] bg-[#efe7d7] px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-[#7a674d]">
                  Public discovery connected to admissions
                </span>
                <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-[#12263a] sm:text-5xl lg:text-6xl">
                  Explore campuses, compare programs, and move into admissions without the clutter.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                  The website now feels more like a real university site: clear course information first, simpler navigation, cleaner layout, and an easy way to talk to admissions.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href="#programs" className="rounded-full bg-[#153a31] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0f2d26]">Discover Programs</a>
                  <button type="button" onClick={() => focusInquiry()} className="rounded-full border border-[#d7cfbf] bg-white px-6 py-3 text-sm font-semibold text-[#12263a] transition hover:bg-[#f8f3ea]">Talk to Admissions</button>
                </div>
                <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {catalog.stats.map((item) => (
                    <div key={item.label} className="rounded-[1.4rem] border border-[#e3dccd] bg-white px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-[#8d7758]">{item.label}</p>
                      <p className="mt-3 text-2xl font-semibold text-[#12263a]">{loading ? "..." : item.value}</p>
                    </div>
                  ))}
                </div>
                {error ? <div className="mt-6 rounded-[1.4rem] border border-amber-300 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">{error}</div> : null}
              </div>
            </section>

            <aside className="grid gap-5 border-t border-[#e3dccd] bg-[#efe7d7] px-6 py-8 sm:px-8 lg:border-l lg:border-t-0">
              <div className="overflow-hidden rounded-[2rem] border border-[#d7cfbf] bg-white shadow-[0_20px_60px_rgba(34,33,28,0.08)]">
                <div className="border-b border-[#e3dccd] px-6 py-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-[#7a674d]">Featured campus</p>
                  <h3 className="mt-3 text-2xl font-semibold text-[#12263a]">{featuredCampus?.name ?? "Campus network"}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{featuredCampus?.description ?? "Browse the live multi-campus structure across the institution."}</p>
                </div>
                <img src={featuredCampus?.image ?? "/images/graduation-hero.svg"} alt={featuredCampus?.name ?? "Featured campus"} className="h-72 w-full object-cover" />
              </div>

              <div className="rounded-[2rem] bg-[#153a31] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.12)]">
                <p className="text-xs uppercase tracking-[0.35em] text-[#c7d9cf]">Why this is cleaner</p>
                <div className="mt-4 space-y-4 text-sm leading-7 text-[#edf4ef]">
                  <p>Course and campus information stays up to date.</p>
                  <p>Inquiry forms now reach the admissions team instead of stopping at a contact section.</p>
                  <p>Student and staff pages are still available, but they no longer take over the main website.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-8" id="schools">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {schoolHighlights.slice(0, 3).map((item) => (
            <article key={item.departmentName} className="rounded-[1.8rem] border border-[#ddd4c4] bg-[#fbf8f2] p-6 shadow-[0_18px_52px_rgba(34,33,28,0.06)]">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8d7758]">School highlight</p>
              <h3 className="mt-3 text-2xl font-semibold text-[#12263a]">{item.departmentName}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.count} featured pathways across {Array.from(item.levels).join(", ")} programs.</p>
              <a href="#programs" className="mt-5 inline-flex text-sm font-medium text-[#153a31] hover:text-[#0f2d26]">View programs</a>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8" id="programs">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#8d7758]">Program explorer</p>
              <h2 className="mt-3 text-3xl font-semibold text-[#12263a] sm:text-4xl">Search live academic pathways</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">Search by campus and level, then send an inquiry with the program already filled in.</p>
          </div>

          <div className="mt-6 rounded-[1.8rem] border border-[#ddd4c4] bg-[#fbf8f2] p-5 shadow-[0_18px_52px_rgba(34,33,28,0.06)]">
            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by program, code, department, or career path" className="rounded-[1.1rem] border border-[#d7cfbf] bg-white px-4 py-3 text-slate-900 outline-none" />
              <select value={selectedCampus} onChange={(event) => setSelectedCampus(event.target.value)} className="rounded-[1.1rem] border border-[#d7cfbf] bg-white px-4 py-3 text-slate-900 outline-none">
                <option value="">All campuses</option>
                {catalog.campusOptions.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
              </select>
              <select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)} className="rounded-[1.1rem] border border-[#d7cfbf] bg-white px-4 py-3 text-slate-900 outline-none">
                <option value="">All levels</option>
                {catalog.levelOptions.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {programs.map((program) => {
                const campus = catalog.campuses.find((item) => item.id === program.campusId);
                return (
                  <article key={program.id} className="rounded-[1.6rem] border border-[#e3dccd] bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-[#d7cfbf] bg-[#efe7d7] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#7a674d]">{program.levelName}</span>
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{program.code}</span>
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-[#12263a]">{program.name}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{program.description}</p>
                    <p className="mt-4 text-sm leading-6 text-slate-700">{program.departmentName} | {program.durationYears} years | {program.seats} seats</p>
                    <p className="mt-2 text-sm leading-6 text-[#325f54]">{campus?.name ?? "Campus network"} | {program.mode}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">Career path: {program.careerPath}</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button type="button" onClick={() => focusInquiry(program.name, campus?.name)} className="rounded-full bg-[#153a31] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f2d26]">
                        Enquire Now
                      </button>
                      <a href="#campuses" className="rounded-full border border-[#d7cfbf] px-4 py-2 text-sm font-semibold text-[#12263a] transition hover:bg-[#f8f3ea]">
                        View Campus
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>

            {!programLoading && programs.length === 0 ? <div className="mt-6 rounded-[1.4rem] border border-dashed border-[#d7cfbf] bg-[#f8f3ea] px-4 py-6 text-sm text-slate-600">No programs matched the current filters.</div> : null}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8" id="campuses">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#8d7758]">Campus network</p>
              <h2 className="mt-3 text-3xl font-semibold text-[#12263a] sm:text-4xl">College and campus structure made visible</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">The multi-college model is now surfaced clearly for applicants and staff instead of being implied in documentation only.</p>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            {catalog.campuses.map((campus) => (
              <article key={campus.id} className="overflow-hidden rounded-[1.8rem] border border-[#ddd4c4] bg-[#fbf8f2] shadow-[0_18px_52px_rgba(34,33,28,0.06)]">
                <img src={campus.image} alt={campus.name} className="h-56 w-full object-cover" />
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold text-[#12263a]">{campus.name}</h3>
                      <p className="mt-1 text-sm text-[#325f54]">{campus.location}</p>
                    </div>
                    <div className="rounded-[1.1rem] border border-[#e3dccd] bg-white px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-[#8d7758]">{campus.statLabel}</p>
                      <p className="mt-1 text-xl font-semibold text-[#12263a]">{campus.statValue}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{campus.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {campus.facilities.slice(0, 4).map((item) => <span key={item} className="rounded-full border border-[#e3dccd] bg-white px-3 py-1 text-xs uppercase tracking-[0.16em] text-[#7a674d]">{item}</span>)}
                  </div>
                  <button type="button" onClick={() => focusInquiry(undefined, campus.name)} className="mt-5 rounded-full border border-[#d7cfbf] px-4 py-2 text-sm font-semibold text-[#12263a] transition hover:bg-white">
                    Request Campus Guidance
                  </button>
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
              <p className="text-xs uppercase tracking-[0.3em] text-[#8d7758]">Announcements</p>
              <h2 className="mt-3 text-3xl font-semibold text-[#12263a] sm:text-4xl">Live public communication feed</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">These notices are updated from the main college system so the website stays current.</p>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-4">
            {content.announcements.slice(0, 4).map((item) => (
              <article key={item.id} className="rounded-[1.8rem] border border-[#ddd4c4] bg-[#fbf8f2] p-6 shadow-[0_18px_52px_rgba(34,33,28,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-[#d7cfbf] bg-[#efe7d7] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[#7a674d]">{item.badge}</span>
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.publishedOn}</span>
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-[#12263a]">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{item.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8" id="inquiry">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-[#ddd4c4] bg-[#fbf8f2] p-6 shadow-[0_18px_52px_rgba(34,33,28,0.06)]">
            <p className="text-xs uppercase tracking-[0.3em] text-[#8d7758]">Admissions journey</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#12263a]">Turn interest into a guided admissions journey</h2>
            <div className="mt-6 space-y-4">
              {content.admissionsJourney.map((step, index) => (
                <article key={step.title} className="rounded-[1.4rem] border border-[#e3dccd] bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8d7758]">Step {index + 1}</p>
                  <h3 className="mt-2 text-xl font-semibold text-[#12263a]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{step.detail}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 rounded-[1.4rem] border border-[#e3dccd] bg-[#f8f3ea] px-4 py-4">
              <p className="text-sm font-medium text-[#12263a]">Admissions contact</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{content.contact.email}</p>
              <p className="text-sm leading-7 text-slate-600">{content.contact.phone}</p>
              <p className="text-sm leading-7 text-slate-600">{content.contact.office}</p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {roleCards.map((item) => (
                <Link key={item.title} href={item.href} className="rounded-[1.1rem] border border-[#d7cfbf] bg-white px-4 py-4 text-sm font-medium text-[#12263a] transition hover:bg-[#f8f3ea]">
                  {item.title} Login
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#12263a] bg-[#12263a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <p className="text-xs uppercase tracking-[0.3em] text-[#d9e3ed]">Inquiry form</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Request an admissions call or follow-up</h2>

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

      <footer className="border-t border-[#ddd4c4] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#8d7758]">University360</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#12263a]">A clearer university website from first visit to admissions follow-through.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">Course search, admissions, campus information, and sign-in pages now connect more clearly across the same college system.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.6rem] border border-[#ddd4c4] bg-[#fbf8f2] p-5">
              <p className="text-sm font-medium text-[#12263a]">Contact</p>
              <a href={`mailto:${content.contact.email}`} className="mt-3 block text-sm leading-7 text-slate-600 hover:text-[#12263a]">{content.contact.email}</a>
              <a href={`tel:${content.contact.phone.replace(/\s+/g, "")}`} className="block text-sm leading-7 text-slate-600 hover:text-[#12263a]">{content.contact.phone}</a>
              <p className="text-sm leading-7 text-slate-600">{content.contact.office}</p>
            </div>
            <div className="rounded-[1.6rem] border border-[#ddd4c4] bg-[#fbf8f2] p-5">
              <p className="text-sm font-medium text-[#12263a]">Quick links</p>
              <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
                <a href="#programs" className="hover:text-[#12263a]">Programs</a>
                <a href="#campuses" className="hover:text-[#12263a]">Campuses</a>
                <a href="#inquiry" className="hover:text-[#12263a]">Admissions</a>
                <Link href="/auth" className="hover:text-[#12263a]">Login</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <ChatWidget mode="public" />
    </main>
  );
}
