import Dexie, { type Table } from "dexie";

// ── Entity interfaces ────────────────────────────────────────────────────────

export interface DexieUser {
  id: string; // canvas user id (or "demo")
  displayName: string;
  avatarUrl?: string;
  // Auth fields
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: number; // epoch ms
  isDemo: boolean;
  canvasUrl?: string;
  updatedAt: number; // epoch ms
}

export interface DexieCourse {
  id: number; // canvas course id
  userId: string;
  name: string;
  courseCode: string;
  enrollmentType?: string;
  updatedAt: number;
}

export interface DexieAssignment {
  id: number; // canvas assignment id
  courseId: number;
  userId: string;
  name: string;
  dueAt: string | null;
  pointsPossible: number;
  submittedAt?: string;
  workflowState: string;
  htmlUrl?: string;
  updatedAt: number;
}

export interface DexieFlashcardDeck {
  id: string; // cuid
  userId: string;
  title: string;
  courseId?: number;
  // Fields formerly stored server-side
  sourceType?: string; // "module" | "assignment" | "page" | "file" | "manual"
  sourceIds?: string; // JSON array
  sourceNames?: string; // JSON array
  courseName?: string | null;
  cardCount: number;
  createdAt: number;
  updatedAt: number;
  synced: boolean;
}

export interface DexieFlashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint?: string;
  difficulty: "easy" | "medium" | "hard";
  sortOrder?: number;
  lastReviewed?: number;
  correctCount: number;
  incorrectCount: number;
  synced: boolean;
}

export interface DexieGamification {
  userId: string; // primary key — singleton per user
  xp: number;
  level: number;
  coins: number;
  streak: number;
  longestStreak: number;
  lastActivityDate: string | null; // YYYY-MM-DD
  updatedAt: number;
}

export interface DexieXPEvent {
  id?: number; // auto-increment
  userId: string;
  source: string;
  amount: number;
  metadata?: string; // JSON string
  createdAt: number;
  synced: boolean;
}

export interface DexieActivityLog {
  id?: number; // auto-increment
  userId: string;
  date: string; // YYYY-MM-DD
  activityType: string;
  bloomLevel?: string;
  xpEarned: number;
  synced: boolean;
}

export interface DexieBadge {
  id: string; // badge type slug
  userId: string;
  unlockedAt: number;
  synced: boolean;
}

export interface DexieCommitment {
  userId: string; // primary key
  monitorName: string;
  monitorEmail: string;
  pledge: string;
  createdAt: number;
}

export interface DexieContentChunk {
  chunkId: string; // `${courseId}-${sourceTitle}-${chunkIndex}`
  courseId: number;
  chunkText: string;
  metadata: {
    sourceType: string;
    sourceTitle: string;
    chunkIndex: number;
  };
}

export interface DexieCustomCourse {
  courseId: string;           // UUID primary key
  courseName: string;
  category: string;
  level: string;              // "Beginner" | "Intermediate" | "Advanced"
  courseOutput: {
    category: string;
    topic: string;
    description: string;
    level: string;
    duration: string;
    chapters: { chapter_name: string; description: string; duration: string }[];
  };
  isVideo: "Yes" | "No";
  courseBanner?: string;      // data URL
  isPublished: boolean;
  createdAt: number;          // epoch ms
  updatedAt: number;
}

export interface DexieCustomChapter {
  courseId: string;           // compound primary key part 1
  chapterId: number;          // compound primary key part 2
  content: unknown;           // ChapterSection[]
  videoId: string;            // YouTube video ID (may be empty)
  updatedAt: number;
}

export interface DexieScheduleBlock {
  id: string;                 // e.g. "assignmentId-date-sessionIdx"
  userId: string;
  assignmentId: number;
  assignmentName: string;
  courseId: number;
  date: string;               // YYYY-MM-DD
  startHour: number;          // 24h
  startMinute: number;
  durationMinutes: number;
  priority: "critical" | "high" | "medium" | "low";
  completed: boolean;
  dueAt: string | null;
  pointsPossible: number;
  updatedAt: number;
}

// ── Database class ───────────────────────────────────────────────────────────

class StudyHubDB extends Dexie {
  users!: Table<DexieUser>;
  courses!: Table<DexieCourse>;
  assignments!: Table<DexieAssignment>;
  flashcardDecks!: Table<DexieFlashcardDeck>;
  flashcards!: Table<DexieFlashcard>;
  gamification!: Table<DexieGamification>;
  xpEvents!: Table<DexieXPEvent>;
  activityLog!: Table<DexieActivityLog>;
  badges!: Table<DexieBadge>;
  commitments!: Table<DexieCommitment>;
  contentChunks!: Table<DexieContentChunk>;
  customCourses!: Table<DexieCustomCourse>;
  customChapters!: Table<DexieCustomChapter>;
  schedules!: Table<DexieScheduleBlock>;

  constructor() {
    super("StudyHubDB");

    // v1: original schema (matches dexie.ts)
    this.version(1).stores({
      users: "id, updatedAt",
      courses: "id, userId, updatedAt",
      assignments: "id, courseId, userId, dueAt, updatedAt",
      flashcardDecks: "id, userId, courseId, updatedAt, synced",
      flashcards: "id, deckId, synced",
      gamification: "userId",
      xpEvents: "++id, userId, synced, createdAt",
      activityLog: "++id, userId, date, synced",
      badges: "[id+userId], userId, synced",
      commitments: "userId",
    });

    // v2: non-breaking — new fields added to interfaces (no index changes needed)
    this.version(2).stores({
      users: "id, updatedAt",
      flashcardDecks: "id, userId, courseId, updatedAt, synced",
    });

    // v3: add contentChunks table for FlexSearch RAG
    this.version(3).stores({
      contentChunks: "chunkId, courseId",
    });

    // v4: add AI-generated custom courses and chapters
    this.version(4).stores({
      customCourses: "&courseId, createdAt",
      customChapters: "&[courseId+chapterId], courseId",
    });

    // v5: add dynamic schedule blocks for the Week Planner
    this.version(5).stores({
      schedules: "id, userId, date, assignmentId, completed",
    });
  }
}

export const db = new StudyHubDB();
