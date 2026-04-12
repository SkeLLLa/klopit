import type { SessionRecord } from '$lib/db.js';
import {
  createSession as createSessionService,
  deleteSession as deleteSessionService,
} from '$lib/services/session.js';

const STORAGE_KEY = 'klopit:activeSessionId';

function createSessionState() {
  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
  let _activeId: string | undefined = $state(undefined);

  let _sessions: SessionRecord[] = $state([]);

  const activeSession: SessionRecord | undefined = $derived(
    _sessions.find((s) => s.id === _activeId),
  );

  return {
    get sessions() {
      return _sessions;
    },
    get activeSessionId() {
      return _activeId;
    },
    get activeSession() {
      return activeSession;
    },
    /** Called by components to sync Dexie liveQuery results into shared state */
    setSessions(sessions: SessionRecord[]) {
      _sessions = sessions;
    },
    /** Restore active session from localStorage, or pick the first one */
    init(sessions: SessionRecord[]) {
      _sessions = sessions;
      if (sessions.length === 0) {
        _activeId = undefined;
        return;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && sessions.some((s) => s.id === stored)) {
        _activeId = stored;
      } else {
        _activeId = sessions[0]?.id;
      }
    },
    setActiveSession(id: string) {
      _activeId = id;
      localStorage.setItem(STORAGE_KEY, id);
    },
    async createSession(year: number) {
      const session = await createSessionService({ year });
      _activeId = session.id;
      localStorage.setItem(STORAGE_KEY, session.id);
      return session;
    },
    async deleteSession() {
      if (!_activeId) return;
      await deleteSessionService({ id: _activeId });
      _activeId = undefined;
    },
  };
}

export const sessionState = createSessionState();
