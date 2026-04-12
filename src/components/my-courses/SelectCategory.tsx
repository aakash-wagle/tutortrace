import { useCustomCourseInput } from "@/contexts/CustomCourseContext";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { name: "Programming", icon: "💻" },
  { name: "Business", icon: "📊" },
  { name: "Finance & Accounting", icon: "💰" },
  { name: "Science", icon: "🔬" },
  { name: "History", icon: "🏛️" },
  { name: "Language", icon: "🌐" },
  { name: "Art & Design", icon: "🎨" },
  { name: "Music", icon: "🎵" },
];

export default function SelectCategory() {
  const { userInput, setUserInput } = useCustomCourseInput();

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-1">Select a Category</h3>
      <p className="text-sm text-muted-foreground mb-6">Choose the subject area for your course.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {CATEGORIES.map((cat) => {
          const active = userInput.category === cat.name;
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => setUserInput((prev) => ({ ...prev, category: cat.name }))}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-150 cursor-pointer",
                active
                  ? "border-accent bg-accent/10 shadow-neo-sm"
                  : "border-border bg-card hover:border-accent/50 hover:bg-muted shadow-neo-sm hover:shadow-neo"
              )}
            >
              <span className="text-3xl">{cat.icon}</span>
              <span className={cn("text-xs font-semibold", active ? "text-accent" : "text-foreground")}>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
