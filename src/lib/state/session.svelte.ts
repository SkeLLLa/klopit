import type { SessionRecord } from '#lib/db.js';
import {
  createSession as createSessionService,
  deleteSession as deleteSessionService,
} from '#lib/services/session.js';

const STORAGE_KEY = 'klopit:activeSessionId';

function createSessionState() {
  let activeId: string | undefined = $state(undefined);

  let sessionList: SessionRecord[] = $state([]);

  const activeSession: SessionRecord | undefined = $derived(
    sessionList.find((s) => s.id === activeId),
  );

  return {
    get sessions() {
      return sessionList;
    },
    get activeSessionId() {
      return activeId;
    },
    get activeSession() {
      return activeSession;
    },
    /** Called by components to sync Dexie liveQuery results into shared state */
    setSessions(sessions: SessionRecord[]) {
      sessionList = sessions;
    },
    /** Restore active session from localStorage, or pick the first one */
    init(sessions: SessionRecord[]) {
      sessionList = sessions;
      if (sessions.length === 0) {
        activeId = undefined;
        return;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && sessions.some((s) => s.id === stored)) {
        activeId = stored;
      } else {
        activeId = sessions[0]?.id;
      }
    },
    setActiveSession(id: string) {
      activeId = id;
      localStorage.setItem(STORAGE_KEY, id);
    },
    async createSession(year: number) {
      const session = await createSessionService({ year });
      activeId = session.id;
      localStorage.setItem(STORAGE_KEY, session.id);
      return session;
    },
    async deleteSession() {
      if (!activeId) return;
      await deleteSessionService({ id: activeId });
      activeId = undefined;
    },
  };
}

export const sessionState = createSessionState();
