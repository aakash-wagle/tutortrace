import { createContext, useContext, useState } from "react";
import type { CustomCourseUserInput } from "@/types/customCourse";

interface CustomCourseContextType {
  userInput: CustomCourseUserInput;
  setUserInput: React.Dispatch<React.SetStateAction<CustomCourseUserInput>>;
}

export const CustomCourseContext = createContext<CustomCourseContextType>({
  userInput: {},
  setUserInput: () => {},
});

export function CustomCourseProvider({ children }: { children: React.ReactNode }) {
  const [userInput, setUserInput] = useState<CustomCourseUserInput>({});
  return (
    <CustomCourseContext.Provider value={{ userInput, setUserInput }}>
      {children}
    </CustomCourseContext.Provider>
  );
}

export function useCustomCourseInput() {
  return useContext(CustomCourseContext);
}
