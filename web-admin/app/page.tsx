import Link from "next/link";
import DashboardPage from "./dashboard-page";
import ChatWidget from "./chat-widget";
import { campusHighlights, homepageAnnouncements, quickAccessLinks, stats, tickerItems } from "./site-content";

export default function HomePage() {
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
                    Multi-campus ready
                  </span>
                </div>
              </div>

              <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <a href="#about" className="rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white">About</a>
                <a href="#courses" className="rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white">Courses</a>
                <a href="#campuses" className="rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white">Campuses</a>
                <a href="#contact" className="rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white">Contact</a>
                <Link href="/auth" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-medium text-white transition hover:bg-white/10">
                  Login
                </Link>
                <a href="#apply" className="rounded-full bg-cyan-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-200">
                  Register
                </a>
              </nav>
            </div>
          </header>

          <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-cyan-300/15 bg-[rgba(12,29,48,0.72)] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur">
            <div className="ticker-track whitespace-nowrap text-sm text-cyan-100">
              {[...tickerItems, ...tickerItems].map((item, index) => (
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
                  Future-ready college operations
                </span>
                <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                  One platform for university governance, campus delivery, and student success.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                  Manage colleges, campuses, courses, departments, admissions, communication, and role-based dashboards with a polished experience built for both public visitors and internal teams.
                </p>

                <div className="mt-8 flex flex-wrap gap-3" id="apply">
                  <a href="#courses" className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
                    Apply Now
                  </a>
                  <a href="#campuses" className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                    Explore Campuses
                  </a>
                </div>

                <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {stats.map((item) => (
                    <div key={item.label} className="rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-4 backdrop-blur">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                      <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="grid gap-5">
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(12,24,41,0.82)] shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur">
                <div className="border-b border-white/10 px-6 py-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Admissions at a glance</p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">Built to feel clear, modern, and trustworthy.</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Students discover programs quickly, teachers get direct workflow entry, and administrators retain cross-campus visibility.
                  </p>
                </div>
                <img
                  src="/images/graduation-hero.svg"
                  alt="Graduation celebration representing institutional success"
                  className="h-72 w-full object-cover"
                />
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[rgba(12,24,41,0.82)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur">
                <p className="text-xs uppercase tracking-[0.35em] text-amber-200">Quick facts</p>
                <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                  <p>Multi-role authentication with JWT, OTP, password reset, and email verification.</p>
                  <p>Normalized organization hierarchy from university to college to campus to department.</p>
                  <p>Guest chatbot assistance for admissions, course discovery, and campus contact support.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-8" id="about">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 md:grid-cols-3">
            {quickAccessLinks.map((item) => (
              <a
                key={item.title}
                href={item.href}
                className="group rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur transition hover:-translate-y-1 hover:border-cyan-300/30"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">{item.eyebrow}</p>
                <h3 className="mt-4 text-2xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{item.description}</p>
                <p className="mt-5 text-sm font-medium text-cyan-100">Open workspace</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8" id="courses">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Announcements</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Latest university updates</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-400">
              Public notices stay visible, structured, and easy to scan so applicants, faculty, and students do not miss key deadlines.
            </p>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {homepageAnnouncements.map((item) => (
              <article key={item.id} className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.24)] backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-100">
                    {item.badge}
                  </span>
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.publishedOn}</span>
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-white">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-400">{item.summary}</p>
                <a href="#contact" className="mt-5 inline-flex text-sm font-medium text-cyan-100">
                  Learn more
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8" id="campuses">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200">Campus highlights</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Distinct campuses with shared platform standards</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-400">
              Showcase campus identity without fragmenting the operating model. Every location feels unique while the platform stays consistent.
            </p>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-3">
            {campusHighlights.map((campus) => (
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
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Role-based dashboards</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Operational depth for every role</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-400">
              Students, teachers, and administrators land in the right workspace with the right data, permissions, and next actions.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div id="student-dashboard" className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Student dashboard</p>
              <div className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
                <p>Profile management, course enrollment, timetable, assignments, results, and notifications.</p>
                <p>Designed for low friction on both mobile and web-ready surfaces.</p>
              </div>
            </div>
            <div id="teacher-dashboard" className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Teacher dashboard</p>
              <div className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
                <p>Class management, assignment publishing, attendance capture, grading, and department announcements.</p>
                <p>Built for repeat actions with minimal clutter and strong validation.</p>
              </div>
            </div>
            <div id="admin-dashboard" className="rounded-[1.8rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Admin dashboards</p>
              <div className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
                <p>College, campus, course, department, user, and analytics management with strong RBAC boundaries.</p>
                <p>Supports super admin, college admin, and campus admin operating scopes.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <DashboardPage />
      </section>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6 lg:px-8" id="contact">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">University360</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">A production-ready foundation for modern college management.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              Designed for public trust, campus clarity, and scalable internal operations across multiple colleges and campuses.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-5 backdrop-blur">
              <p className="text-sm font-medium text-white">Contact</p>
              <p className="mt-3 text-sm leading-7 text-slate-400">admissions@university360.edu</p>
              <p className="text-sm leading-7 text-slate-400">+91 80000 12345</p>
              <p className="text-sm leading-7 text-slate-400">University Operations Office, Bengaluru</p>
            </div>
            <div className="rounded-[1.6rem] border border-white/10 bg-[rgba(10,21,37,0.8)] p-5 backdrop-blur">
              <p className="text-sm font-medium text-white">Links</p>
              <p className="mt-3 text-sm leading-7 text-slate-400">Privacy Policy</p>
              <p className="text-sm leading-7 text-slate-400">Terms of Use</p>
              <p className="text-sm leading-7 text-slate-400">Facebook / LinkedIn / YouTube</p>
            </div>
          </div>
        </div>
      </footer>

      <ChatWidget mode="public" />
    </main>
  );
}
