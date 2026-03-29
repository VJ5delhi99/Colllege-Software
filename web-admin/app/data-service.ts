import {
  getDemoDataset,
  getDemoUsers as loadDemoUsers,
  resetDemoDataset,
  updateDemoCollection
} from "./demo-runtime";
import { apiConfig } from "./api-config";
import { isDemoModeEnabled } from "./demo-mode";
import type {
  DemoAnnouncement,
  DemoCampus,
  DemoCourse,
  DemoStudent,
  DemoTeacher,
  DemoUserAccount
} from "./demo-data";

export interface IDataService {
  getStudents(): Promise<DemoStudent[]>;
  addStudent(input: Omit<DemoStudent, "id">): Promise<DemoStudent>;
  updateStudent(id: string, input: Omit<DemoStudent, "id">): Promise<DemoStudent>;
  deleteStudent(id: string): Promise<void>;
  getTeachers(): Promise<DemoTeacher[]>;
  addTeacher(input: Omit<DemoTeacher, "id">): Promise<DemoTeacher>;
  updateTeacher(id: string, input: Omit<DemoTeacher, "id">): Promise<DemoTeacher>;
  deleteTeacher(id: string): Promise<void>;
  getCourses(): Promise<DemoCourse[]>;
  addCourse(input: Omit<DemoCourse, "id">): Promise<DemoCourse>;
  updateCourse(id: string, input: Omit<DemoCourse, "id">): Promise<DemoCourse>;
  deleteCourse(id: string): Promise<void>;
  getAnnouncements(): Promise<DemoAnnouncement[]>;
  addAnnouncement(input: Omit<DemoAnnouncement, "id">): Promise<DemoAnnouncement>;
  updateAnnouncement(id: string, input: Omit<DemoAnnouncement, "id">): Promise<DemoAnnouncement>;
  deleteAnnouncement(id: string): Promise<void>;
  getCampuses(): Promise<DemoCampus[]>;
  addCampus(input: Omit<DemoCampus, "id">): Promise<DemoCampus>;
  updateCampus(id: string, input: Omit<DemoCampus, "id">): Promise<DemoCampus>;
  deleteCampus(id: string): Promise<void>;
  getDemoUsers(): Promise<DemoUserAccount[]>;
  resetDemo(size?: "small" | "medium" | "large"): Promise<void>;
}

function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

async function simulateLatency() {
  const delay = 300 + Math.round(Math.random() * 500);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

function maybeThrowSimulationError() {
  const roll = Math.random();
  if (roll < 0.08) {
    throw new Error("Demo network timeout. Try the action again.");
  }
}

function validateRequired(fields: Record<string, string | number>) {
  for (const [label, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.trim().length === 0) {
      throw new Error(`${label} is required.`);
    }

    if (typeof value === "number" && Number.isNaN(value)) {
      throw new Error(`${label} is invalid.`);
    }
  }
}

class DemoDataService implements IDataService {
  async getStudents() {
    await simulateLatency();
    return getDemoDataset().students;
  }

  async addStudent(input: Omit<DemoStudent, "id">) {
    await simulateLatency();
    validateRequired({ FullName: input.fullName, Email: input.email, Department: input.department, Year: input.year });
    maybeThrowSimulationError();
    const student = { ...input, id: nextId("student") };
    updateDemoCollection("students", (items) => [student, ...items]);
    return student;
  }

  async updateStudent(id: string, input: Omit<DemoStudent, "id">) {
    await simulateLatency();
    validateRequired({ FullName: input.fullName, Email: input.email, Department: input.department, Year: input.year });
    maybeThrowSimulationError();
    updateDemoCollection("students", (items) => items.map((item) => (item.id === id ? { ...input, id } : item)));
    return { ...input, id };
  }

  async deleteStudent(id: string) {
    await simulateLatency();
    maybeThrowSimulationError();
    updateDemoCollection("students", (items) => items.filter((item) => item.id !== id));
  }

  async getTeachers() {
    await simulateLatency();
    return getDemoDataset().teachers;
  }

  async addTeacher(input: Omit<DemoTeacher, "id">) {
    await simulateLatency();
    validateRequired({ FullName: input.fullName, Email: input.email, Department: input.department, Specialization: input.specialization });
    maybeThrowSimulationError();
    const teacher = { ...input, id: nextId("teacher") };
    updateDemoCollection("teachers", (items) => [teacher, ...items]);
    return teacher;
  }

  async updateTeacher(id: string, input: Omit<DemoTeacher, "id">) {
    await simulateLatency();
    validateRequired({ FullName: input.fullName, Email: input.email, Department: input.department, Specialization: input.specialization });
    maybeThrowSimulationError();
    updateDemoCollection("teachers", (items) => items.map((item) => (item.id === id ? { ...input, id } : item)));
    return { ...input, id };
  }

  async deleteTeacher(id: string) {
    await simulateLatency();
    maybeThrowSimulationError();
    updateDemoCollection("teachers", (items) => items.filter((item) => item.id !== id));
  }

  async getCourses() {
    await simulateLatency();
    return getDemoDataset().courses;
  }

  async addCourse(input: Omit<DemoCourse, "id">) {
    await simulateLatency();
    validateRequired({ CourseCode: input.courseCode, Title: input.title, SemesterCode: input.semesterCode, Room: input.room });
    maybeThrowSimulationError();
    const course = { ...input, id: nextId("course") };
    updateDemoCollection("courses", (items) => [course, ...items]);
    return course;
  }

  async updateCourse(id: string, input: Omit<DemoCourse, "id">) {
    await simulateLatency();
    validateRequired({ CourseCode: input.courseCode, Title: input.title, SemesterCode: input.semesterCode, Room: input.room });
    maybeThrowSimulationError();
    updateDemoCollection("courses", (items) => items.map((item) => (item.id === id ? { ...input, id } : item)));
    return { ...input, id };
  }

  async deleteCourse(id: string) {
    await simulateLatency();
    maybeThrowSimulationError();
    updateDemoCollection("courses", (items) => items.filter((item) => item.id !== id));
  }

  async getAnnouncements() {
    await simulateLatency();
    return getDemoDataset().announcements;
  }

  async addAnnouncement(input: Omit<DemoAnnouncement, "id">) {
    await simulateLatency();
    validateRequired({ Title: input.title, Message: input.message, Audience: input.audience });
    maybeThrowSimulationError();
    const announcement = { ...input, id: nextId("announcement") };
    updateDemoCollection("announcements", (items) => [announcement, ...items]);
    return announcement;
  }

  async updateAnnouncement(id: string, input: Omit<DemoAnnouncement, "id">) {
    await simulateLatency();
    validateRequired({ Title: input.title, Message: input.message, Audience: input.audience });
    maybeThrowSimulationError();
    updateDemoCollection("announcements", (items) => items.map((item) => (item.id === id ? { ...input, id } : item)));
    return { ...input, id };
  }

  async deleteAnnouncement(id: string) {
    await simulateLatency();
    maybeThrowSimulationError();
    updateDemoCollection("announcements", (items) => items.filter((item) => item.id !== id));
  }

  async getCampuses() {
    await simulateLatency();
    return getDemoDataset().campuses;
  }

  async addCampus(input: Omit<DemoCampus, "id">) {
    await simulateLatency();
    validateRequired({ Name: input.name, Location: input.location, DeanName: input.deanName, StudentCapacity: input.studentCapacity });
    maybeThrowSimulationError();
    const campus = { ...input, id: nextId("campus") };
    updateDemoCollection("campuses", (items) => [campus, ...items]);
    return campus;
  }

  async updateCampus(id: string, input: Omit<DemoCampus, "id">) {
    await simulateLatency();
    validateRequired({ Name: input.name, Location: input.location, DeanName: input.deanName, StudentCapacity: input.studentCapacity });
    maybeThrowSimulationError();
    updateDemoCollection("campuses", (items) => items.map((item) => (item.id === id ? { ...input, id } : item)));
    return { ...input, id };
  }

  async deleteCampus(id: string) {
    await simulateLatency();
    maybeThrowSimulationError();
    updateDemoCollection("campuses", (items) => items.filter((item) => item.id !== id));
  }

  async getDemoUsers() {
    await simulateLatency();
    return loadDemoUsers();
  }

  async resetDemo(size: "small" | "medium" | "large" = "small") {
    await simulateLatency();
    resetDemoDataset(size);
  }
}

class RealApiDataService implements IDataService {
  private unsupported(module: string) {
    throw new Error(`${module} is not connected to a production API adapter yet.`);
  }

  async getStudents() {
    const response = await fetch(`${apiConfig.identity()}/api/v1/users`);
    if (!response.ok) {
      throw new Error("Unable to load students from the live API.");
    }

    return [] as DemoStudent[];
  }

  async addStudent(_input: Omit<DemoStudent, "id">) { this.unsupported("Student CRUD"); return {} as DemoStudent; }
  async updateStudent(_id: string, _input: Omit<DemoStudent, "id">) { this.unsupported("Student CRUD"); return {} as DemoStudent; }
  async deleteStudent(_id: string) { this.unsupported("Student CRUD"); }
  async getTeachers() { this.unsupported("Teacher CRUD"); return []; }
  async addTeacher(_input: Omit<DemoTeacher, "id">) { this.unsupported("Teacher CRUD"); return {} as DemoTeacher; }
  async updateTeacher(_id: string, _input: Omit<DemoTeacher, "id">) { this.unsupported("Teacher CRUD"); return {} as DemoTeacher; }
  async deleteTeacher(_id: string) { this.unsupported("Teacher CRUD"); }
  async getCourses() { this.unsupported("Course CRUD"); return []; }
  async addCourse(_input: Omit<DemoCourse, "id">) { this.unsupported("Course CRUD"); return {} as DemoCourse; }
  async updateCourse(_id: string, _input: Omit<DemoCourse, "id">) { this.unsupported("Course CRUD"); return {} as DemoCourse; }
  async deleteCourse(_id: string) { this.unsupported("Course CRUD"); }
  async getAnnouncements() { this.unsupported("Announcement CRUD"); return []; }
  async addAnnouncement(_input: Omit<DemoAnnouncement, "id">) { this.unsupported("Announcement CRUD"); return {} as DemoAnnouncement; }
  async updateAnnouncement(_id: string, _input: Omit<DemoAnnouncement, "id">) { this.unsupported("Announcement CRUD"); return {} as DemoAnnouncement; }
  async deleteAnnouncement(_id: string) { this.unsupported("Announcement CRUD"); }
  async getCampuses() { this.unsupported("Campus CRUD"); return []; }
  async addCampus(_input: Omit<DemoCampus, "id">) { this.unsupported("Campus CRUD"); return {} as DemoCampus; }
  async updateCampus(_id: string, _input: Omit<DemoCampus, "id">) { this.unsupported("Campus CRUD"); return {} as DemoCampus; }
  async deleteCampus(_id: string) { this.unsupported("Campus CRUD"); }
  async getDemoUsers() { return []; }
  async resetDemo() {}
}

let dataService: IDataService | null = null;

export function getDataService(): IDataService {
  if (!dataService) {
    dataService = isDemoModeEnabled() ? new DemoDataService() : new RealApiDataService();
  }

  return dataService;
}

export function resetDataServiceCache() {
  dataService = null;
}
