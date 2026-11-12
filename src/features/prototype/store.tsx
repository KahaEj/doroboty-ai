import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePostHog } from "@posthog/react";
import { initialState, transition, type Action, type State } from "./model";
import { parseState, readState, saveState, type StoragePort } from "./storage";
import { prototypeLogger } from "@/lib/prototype-logger";
function browserStorage(): StoragePort | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function useStore() {
  const posthog = usePostHog();
  const [loaded] = useState(() => readState(browserStorage()));
  const [state, setState] = useState(loaded.state);
  const [issue, setIssue] = useState(loaded.issue);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(loaded.blocked);
  const latest = useRef(state);
  function commit(next: State, replace = false) {
    latest.current = next;
    setState(next);
    setError("");
    if (blocked && !replace) return;
    try {
      saveState(browserStorage(), next);
      setIssue("");
      if (replace) setBlocked(false);
    } catch (e) {
      setIssue((e as Error).message);
    }
  }
  function run(action: Action) {
    try {
      commit(transition(latest.current, action));
      return true;
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Sprawdź poprawność i długość wprowadzonych danych.",
      );
      return false;
    }
  }
  function importState(raw: string) {
    try {
      const next = parseState(raw);
      commit(next, true);
      prototypeLogger.info("Prototype state imported", {
        event: "prototype_state_imported",
        import_source: "settings",
      });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  const identifiedPersonId = useRef<string | null>(null);
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
  useEffect(() => {
    const person = state.people.find((candidate) => candidate.id === state.activePersonId);
    if (identifiedPersonId.current === person?.id) return;

    if (identifiedPersonId.current) posthog.reset();
    if (person) posthog.identify(person.id, { name: person.name, role: person.role });
    identifiedPersonId.current = person?.id ?? null;
  }, [posthog, state.activePersonId, state.people]);
  return {
    state,
    issue,
    error,
    blocked,
    original: loaded.original,
    run,
    importState,
    signOut: () => run({ type: "select_person", id: null }),
    clearError: () => setError(""),
    reset: () => {
      commit(initialState(), true);
      prototypeLogger.info("Prototype state reset", {
        event: "prototype_state_reset",
        reset_source: "settings",
      });
    },
  };
}
type Store = ReturnType<typeof useStore>;
const Context = createContext<Store | null>(null);
export function PrototypeProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function usePrototype() {
  const store = useContext(Context);
  if (!store) throw new Error("PrototypeProvider is required");
  return store;
}
