export type CustomCourseUserInput = {
  category?: string;
  difficulty?: string;
  duration?: string;
  video?: string;
  totalChapters?: number;
  topic?: string;
  description?: string;
};

export type CustomChapterType = {
  chapter_name: string;
  description: string;
  duration: string;
};

export type CustomCourseOutput = {
  category: string;
  topic: string;
  description: string;
  level: string;
  duration: string;
  chapters: CustomChapterType[];
};

export type CodeExample = { code: string };

export type ChapterSection = {
  title: string;
  explanation: string;
  code_examples?: CodeExample[];
};
