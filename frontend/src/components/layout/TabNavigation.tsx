import { useStudio, type StudioView } from "../../state/StudioContext";
import styles from "./TabNavigation.module.css";

const NAVIGATION_TABS: { view: StudioView; label: string }[] = [
  { view: "characters", label: "1. Personajes" },
  { view: "review", label: "2. Revisión de Huesos" },
  { view: "generator", label: "3. Generador" },
  { view: "results", label: "4. Resultados 3D" },
  { view: "history", label: "5. Historial de Tandas" },
];

/** The five pipeline screens as tabs. */
export function TabNavigation() {
  const { activeView, showView } = useStudio();
  return (
    <nav className={styles.bar_tab_navigation} aria-label="Pantallas">
      {NAVIGATION_TABS.map((navigationTab) => (
        <button
          key={navigationTab.view}
          type="button"
          className={`${styles.button_navigation_tab} ${activeView === navigationTab.view ? styles.button_tab_active : ""}`}
          onClick={() => showView(navigationTab.view)}
          aria-current={activeView === navigationTab.view ? "page" : undefined}
        >
          {navigationTab.label}
        </button>
      ))}
    </nav>
  );
}
