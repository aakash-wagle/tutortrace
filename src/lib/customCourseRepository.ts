import { db, DexieCustomCourse, DexieCustomChapter } from "./db";

export const customCourseRepo = {
  list(): Promise<DexieCustomCourse[]> {
    return db.customCourses.orderBy("createdAt").reverse().toArray();
  },

  getById(courseId: string): Promise<DexieCustomCourse | undefined> {
    return db.customCourses.get(courseId);
  },

  insert(course: DexieCustomCourse): Promise<string> {
    return db.customCourses.put(course);
  },

  update(courseId: string, patch: Partial<DexieCustomCourse>): Promise<number> {
    return db.customCourses.where("courseId").equals(courseId).modify({ ...patch, updatedAt: Date.now() });
  },

  async delete(courseId: string): Promise<void> {
    await db.customChapters.where("courseId").equals(courseId).delete();
    await db.customCourses.delete(courseId);
  },

  insertChapter(chapter: DexieCustomChapter): Promise<string> {
    return db.customChapters.put(chapter);
  },

  getChapters(courseId: string): Promise<DexieCustomChapter[]> {
    return db.customChapters.where("courseId").equals(courseId).sortBy("chapterId");
  },
};
