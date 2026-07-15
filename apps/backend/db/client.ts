// DB access layer. The rest of the backend depends only on this interface, so
// the reference in-memory store here can be swapped for a Postgres driver
// (see schema.sql) without touching any route. Not for production persistence.
import type { PromptEvent } from "@promptforge/types";
import type { AuthedUser } from "../api/auth/index.js";
import bundledConfig from "../../../config/selectors.json" with { type: "json" };

interface Db {
  signIn(email: string): Promise<{ user: AuthedUser; token: string }>;
  userForToken(token: string): Promise<AuthedUser | null>;
  upsertPromptEvent(userId: string, e: PromptEvent): Promise<void>;
  promptEventsForUser(userId: string): Promise<PromptEvent[]>;
  activeConfig(): Promise<unknown>;
  orgsForUser?(userId: string): Promise<{ id: string; name: string; role: string }[]>;
}

class InMemoryDb implements Db {
  private users = new Map<string, AuthedUser>(); // id -> user
  private tokens = new Map<string, string>(); // token -> userId
  private events = new Map<string, PromptEvent[]>(); // userId -> events

  async signIn(email: string) {
    let user = [...this.users.values()].find((u) => u.email === email);
    if (!user) {
      const id = "u_" + Buffer.from(email).toString("hex").slice(0, 12);
      user = { id, email };
      this.users.set(id, user);
    }
    const token = "t_" + Buffer.from(`${user.id}:${email}`).toString("base64url");
    this.tokens.set(token, user.id);
    return { user, token };
  }

  async userForToken(token: string) {
    const uid = this.tokens.get(token);
    return uid ? (this.users.get(uid) ?? null) : null;
  }

  async upsertPromptEvent(userId: string, e: PromptEvent) {
    const list = this.events.get(userId) ?? [];
    const idx = list.findIndex((x) => x.id === e.id);
    if (idx >= 0) list[idx] = e;
    else list.push(e);
    this.events.set(userId, list);
  }

  async promptEventsForUser(userId: string) {
    return this.events.get(userId) ?? [];
  }

  async activeConfig() {
    return bundledConfig;
  }

  async orgsForUser(_userId: string) {
    return []; // Phase 5: populated once org membership exists (schema.sql).
  }
}

export const db: Db = new InMemoryDb();
