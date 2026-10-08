import { BoneHierarchySidebar } from "./components/layout/BoneHierarchySidebar";
import { TabNavigation } from "./components/layout/TabNavigation";
import { TopBar } from "./components/layout/TopBar";
import { useStudio } from "./state/StudioContext";
import { CharactersView } from "./views/characters/CharactersView";
import { GeneratorView } from "./views/generator/GeneratorView";
import { HistoryView } from "./views/history/HistoryView";
import { ResultsView } from "./views/results/ResultsView";
import { BoneReviewView } from "./views/review/BoneReviewView";
import styles from "./App.module.css";

/** Application shell: top bar, tabs, bone sidebar and the active screen. */
export function App() {
  const { activeView } = useStudio();
  return (
    <div className={styles.container_application}>
      <TopBar />
      <TabNavigation />
      <div className={styles.container_workspace}>
        <BoneHierarchySidebar />
        <main className={styles.container_main_view}>
          {activeView === "characters" && <CharactersView />}
          {activeView === "review" && <BoneReviewView />}
          {activeView === "generator" && <GeneratorView />}
          {activeView === "results" && <ResultsView />}
          {activeView === "history" && <HistoryView />}
        </main>
      </div>
    </div>
  );
}
