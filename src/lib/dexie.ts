import Dexie, { type Table } from "dexie";

// ── Entity interfaces ────────────────────────────────────────────────────────

export interface DexieUser {
  id: string; // canvas user id
  displayName: string;
  avatarUrl?: string;
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
  id: string; // cuid from prisma
  userId: string;
  title: string;
  courseId?: number;
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

  constructor() {
    super("StudyHubDB");
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
  }
}

export const db = new StudyHubDB();
