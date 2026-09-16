import { create } from "zustand";
import type { Collection, Environment, HistoryEntry, ApiRequest, ResponseSnapshot, VariableDefinition } from "@apiplatform/shared";
import { api, getStoredUser, getToken, setSession, clearSession } from "./api";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

interface AppState {
  user: { id: string; email: string; name: string } | null;
  token: boolean;
  workspaces: Record<string, unknown>[];
  activeWorkspaceId: string | null;
  environments: Environment[];
  activeEnvironmentId: string | null;
  collections: Collection[];
  collectionsTree: Record<string, { folders: unknown[]; requests: ApiRequest[] }>;
  requests: ApiRequest[];
  activeRequest: ApiRequest | null;
  activeRequestDirty: boolean;
  response: ResponseSnapshot | null;
  sending: boolean;
  history: HistoryEntry[];
  globals: VariableDefinition[];
  toasts: Toast[];

  init(): Promise<void>;
  setUser(user: AppState["user"]): void;
  login(email: string, password: string): Promise<void>;
  register(email: string, name: string, password: string): Promise<void>;
  logout(): void;

  loadWorkspaces(): Promise<void>;
  selectWorkspace(id: string): Promise<void>;
  createWorkspace(name: string): Promise<void>;

  loadEnvironments(): Promise<void>;
  setActiveEnvironment(id: string | null): void;

  loadCollections(): Promise<void>;
  loadCollection(id: string): Promise<void>;
  createCollection(name: string): Promise<void>;

  loadRequests(): Promise<void>;
  selectRequest(id: string): Promise<void>;
  newRequest(): void;
  deleteRequest(workspaceId: string, id: string): Promise<void>;
  saveRequest(input: Partial<ApiRequest>): Promise<ApiRequest | null>;
  updateActiveRequest(patch: Partial<ApiRequest>): void;
  send(environmentId?: string): Promise<void>;

  loadHistory(): Promise<void>;

  toast(kind: Toast["kind"], message: string): void;
  dismissToast(id: number): void;
}

let toastCounter = 0;

export const useApp = create<AppState>((set, get) => ({
  user: null,
  token: Boolean(getToken()),
  workspaces: [],
  activeWorkspaceId: null,
  environments: [],
  activeEnvironmentId: null,
  collections: [],
  collectionsTree: {},
  requests: [],
  activeRequest: null,
  activeRequestDirty: false,
  response: null,
  sending: false,
  history: [],
  globals: [],
  toasts: [],

  async init() {
    if (!getToken()) return;
    try {
      const stored = getStoredUser() as AppState["user"];
      if (stored) set({ user: stored });
      await get().loadWorkspaces();
      if (get().activeWorkspaceId === null && get().workspaces.length > 0) {
        await get().selectWorkspace(get().workspaces[0]!.id as string);
      }
    } catch {
      clearSession();
      set({ user: null, token: false });
    }
  },

  setUser(user) {
    set({ user, token: Boolean(user) });
  },

  async login(email, password) {
    const res = await api.login({ email, password });
    setSession(res.token, res.user);
    set({ user: res.user as AppState["user"], token: true });
    await get().init();
  },

  async register(email, name, password) {
    const res = await api.register({ email, name, password });
    setSession(res.token, res.user);
    set({ user: res.user as AppState["user"], token: true });
    await get().init();
  },

  logout() {
    clearSession();
    set({
      user: null,
      token: false,
      workspaces: [],
      activeWorkspaceId: null,
      collections: [],
      requests: [],
      activeRequest: null,
      response: null,
    });
  },

  async loadWorkspaces() {
    const res = await api.listWorkspaces();
    set({ workspaces: res.workspaces });
  },

  async selectWorkspace(id) {
    set({ activeWorkspaceId: id, activeRequest: null, response: null, collections: [], requests: [], history: [] });
    await Promise.all([get().loadEnvironments(), get().loadCollections(), get().loadRequests(), get().loadHistory()]);
  },

  async createWorkspace(name) {
    const res = await api.createWorkspace({ name });
    await get().loadWorkspaces();
    await get().selectWorkspace(res.workspace.id as string);
  },

  async loadEnvironments() {
    const ws = get().activeWorkspaceId;
    if (!ws) return;
    const res = await api.listEnvironments(ws);
    set({ environments: res.environments });
    try {
      const globals = await api.getGlobals(ws);
      set({ globals: globals.variables });
    } catch {
      /* ignore */
    }
  },

  setActiveEnvironment(id) {
    set({ activeEnvironmentId: id });
  },

  async loadCollections() {
    const ws = get().activeWorkspaceId;
    if (!ws) return;
    const res = await api.listCollections(ws);
    set({ collections: res.collections });
    const tree: AppState["collectionsTree"] = {};
    for (const c of res.collections) {
      try {
        tree[c.id] = await api.getCollection(ws, c.id);
      } catch {
        tree[c.id] = { folders: [], requests: [] } as never;
      }
    }
    set({ collectionsTree: tree });
  },

  async loadCollection(id) {
    const ws = get().activeWorkspaceId;
    if (!ws) return;
    const data = await api.getCollection(ws, id);
    set((s) => ({ collectionsTree: { ...s.collectionsTree, [id]: data } }));
  },

  async createCollection(name) {
    const ws = get().activeWorkspaceId;
    if (!ws) return;
    await api.createCollection(ws, { name });
    await get().loadCollections();
  },

  async loadRequests() {
    const ws = get().activeWorkspaceId;
    if (!ws) return;
    const res = await api.listRequests(ws);
    set({ requests: res.requests });
  },

  async selectRequest(id) {
    const ws = get().activeWorkspaceId;
    if (!ws) return;
    const res = await api.getRequest(ws, id);
    set({ activeRequest: res.request, activeRequestDirty: false, response: null });
  },

  newRequest() {
    set({
      activeRequest: {
        id: "",
        name: "New Request",
        method: "GET",
        url: "",
        header: [],
        query: [],
        body: { mode: "none" },
        auth: { type: "none" },
        workspaceId: get().activeWorkspaceId ?? "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      activeRequestDirty: false,
      response: null,
    });
  },

  async deleteRequest(workspaceId, id) {
    await api.deleteRequest(workspaceId, id);
    const active = get().activeRequest;
    if (active && active.id === id) set({ activeRequest: null, response: null });
    await get().loadCollections();
    await get().loadRequests();
  },

  async saveRequest(input) {
    const ws = get().activeWorkspaceId;
    if (!ws) return null;
    const active = get().activeRequest;
    let saved: ApiRequest | null = null;
    if (active && active.id) {
      const res = await api.updateRequest(ws, active.id, input as Partial<ApiRequest>);
      saved = res.request;
    } else {
      const res = await api.createRequest(ws, input as Partial<ApiRequest>);
      saved = res.request;
    }
    set({ activeRequest: saved, activeRequestDirty: false });
    await get().loadCollections();
    await get().loadRequests();
    return saved;
  },

  updateActiveRequest(patch) {
    const active = get().activeRequest;
    if (active) set({ activeRequest: { ...active, ...patch }, activeRequestDirty: true });
  },

  async send(environmentId) {
    const ws = get().activeWorkspaceId;
    const active = get().activeRequest;
    if (!ws || !active) return;
    let requestId = active.id;

    if (!requestId) {
      const saved = await get().saveRequest({ ...active } as Partial<ApiRequest>);
      if (!saved) return;
      requestId = saved.id;
    }
    set({ sending: true });
    try {
      const res = await api.sendRequest(ws, requestId, {
        environmentId: environmentId ?? get().activeEnvironmentId ?? undefined,
        runtime: {},
      });
      set({ response: res.response, sending: false });
      await get().loadHistory();
    } catch (e) {
      set({ sending: false });
      get().toast("error", e instanceof Error ? e.message : "Request failed");
    }
  },

  async loadHistory() {
    const ws = get().activeWorkspaceId;
    if (!ws) return;
    const res = await api.listHistory(ws);
    set({ history: res.entries });
  },

  toast(kind, message) {
    const id = ++toastCounter;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => get().dismissToast(id), 5000);
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));