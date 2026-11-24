import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { operatorMiddleware } from "@/lib/operator-middleware";

export type CaptureCard = {
  slug: string;
  name: string;
  category: string;
  brief: string;
  updatedAt: string;
  visible: boolean;
  sample?: boolean;
  bytes?: number;
  width?: number;
  height?: number;
  src?: string;
  thumbSrc?: string;
};

export type BriefingStep = {
  kicker: string;
  title: string;
  body: string;
};

export type Briefing = {
  lede: string;
  note: string;
  steps: BriefingStep[];
};

export const defaultBriefing: Briefing = {
  lede: "Open a sphere, study the ground, and pin what you find on the CTF map.",
  note: "Answers are pinpointed on the map on the CTF site, not here.",
  steps: [
    {
      kicker: "01",
      title: "Open",
      body: "Each card is one equirectangular challenge. Nothing on this page is the flag.",
    },
    {
      kicker: "02",
      title: "Look",
      body: "Drag to turn, scroll to zoom, and use the compass. The sphere is the clue.",
    },
    {
      kicker: "03",
      title: "Pin",
      body: "Take the read back to the CTF and drop the pin on the geo challenge map.",
    },
  ],
};

const MAX_IMAGE_CHARS = 68_000_000;

function cleanText(value: unknown, max: number, label: string) {
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  const text = value.trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} is too long.`);
  return text;
}

function cleanBrief(value: unknown) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (text.length > 2000) throw new Error("Description is too long.");
  return text;
}

function cleanImage(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  const data = value.includes(",") ? (value.split(",").pop() ?? "") : value;
  if (data.length < 32 || data.length > MAX_IMAGE_CHARS) {
    throw new Error(`${label} is empty or too large. Keep the original under 100 MB.`);
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error(`${label} is not a valid image.`);
  return data;
}

function cleanBriefing(value: unknown): Briefing {
  const source = value && typeof value === "object" ? (value as Partial<Briefing>) : {};
  const steps = Array.isArray(source.steps) ? source.steps : [];
  return {
    lede: cleanText(source.lede, 500, "Intro"),
    note: cleanText(source.note, 280, "Footnote"),
    steps: defaultBriefing.steps.map((fallback, index) => {
      const step = steps[index] && typeof steps[index] === "object" ? steps[index] : {};
      return {
        kicker: fallback.kicker,
        title: cleanText((step as BriefingStep).title ?? fallback.title, 40, "Step title"),
        body: cleanText((step as BriefingStep).body ?? fallback.body, 320, "Step description"),
      };
    }),
  };
}

function slugify(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "capture";
}

async function dropSeededSample() {
  const sql = await getSql();
  await sql`delete from captures where created_by = 'seed'`;
}

async function listRows() {
  const sql = await getSql();
  await dropSeededSample();
  return sql<CaptureCard>`
    select slug, name, category, brief, updated_at::text as "updatedAt", visible
    from captures
    order by created_at asc
  `;
}
async function readBriefing(): Promise<Briefing> {
  const sql = await getSql();
  const rows = await sql<{ value: string }>`select value from board_meta where key = 'briefing'`;
  if (!rows[0]?.value) return defaultBriefing;
  try {
    return shownBriefing(JSON.parse(rows[0].value));
  } catch {
    return defaultBriefing;
  }
}

async function requireOperator(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ user_id: string }>`
    select user_id from operators where user_id = ${userId}
  `;
  if (!rows.length) throw new Error("Only the board operator can change captures.");
  return sql;
}

function uniqueFrom(base: string, taken: string[]) {
  let slug = base;
  for (let n = 2; n < 50; n += 1) {
    if (!taken.includes(slug)) return slug;
    slug = `${base}-${n}`;
  }
  throw new Error("Pick a different name.");
}

async function uniqueSlug(base: string) {
  const sql = await getSql();
  let slug = base;
  for (let n = 2; n < 50; n += 1) {
    const rows = await sql<{ slug: string }>`select slug from captures where slug = ${slug}`;
    if (!rows.length) return slug;
    slug = `${base}-${n}`;
  }
  throw new Error("Pick a different name.");
}

async function assertMayEdit(userId: string) {
  if (process.env.OPERATOR_PASSWORD) return;
  await requireOperator(userId);
}

const PREVIOUS_LEDE =
  "Spherical imagery for field-analysis challenges. Open a challenge, look around, then submit the answer on the CTF board by pinning the location on the map.";

function shownBriefing(value: unknown): Briefing {
  const briefing = value ? cleanBriefing(value) : defaultBriefing;
  if (briefing.lede === PREVIOUS_LEDE) return { ...briefing, lede: defaultBriefing.lede };
  return briefing;
}

function publicCard(capture: {
  slug: string;
  name: string;
  category: string;
  brief: string;
  updatedAt: string;
  visible?: boolean;
  bytes?: number;
  width?: number;
  height?: number;
}): CaptureCard {
  return {
    slug: capture.slug,
    name: capture.name,
    category: capture.category,
    brief: capture.brief,
    updatedAt: capture.updatedAt,
    visible: capture.visible !== false,
    bytes: capture.bytes,
    width: capture.width,
    height: capture.height,
  };
}

function visibleOnly(stored: CaptureCard[]) {
  return stored.filter((capture) => capture.visible);
}

export const gateStatus = createServerFn({ method: "GET" }).handler(async () => {
  if (!process.env.OPERATOR_PASSWORD) return { mode: "account" as const, unlocked: false };
  const { operatorCookieOk } = await import("./operator-gate.server");
  return { mode: "passphrase" as const, unlocked: operatorCookieOk() };
});

export const unlockBoard = createServerFn({ method: "POST" })
  .validator((password: string) => (typeof password === "string" ? password : ""))
  .handler(async ({ data }) => {
    const { assertSameSiteRequest } = await import("./auth/isolation.server");
    const { noteOperatorFailure, noteOperatorSuccess, operatorLocked, unlockOperator } = await import(
      "./operator-gate.server"
    );
    assertSameSiteRequest();
    if (operatorLocked()) throw new Error("Too many attempts. Wait ten minutes and try again.");
    if (!unlockOperator(data)) {
      noteOperatorFailure();
      throw new Error("That passphrase is wrong.");
    }
    noteOperatorSuccess();
    return { ok: true as const };
  });

export const uploadMode = createServerFn({ method: "GET" }).handler(async () => {
  return { direct: Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.OPERATOR_PASSWORD) };
});

function sphereSrc(slug: string, updatedAt: string) {
  return `/api/media/${slug}?kind=full&v=${encodeURIComponent(updatedAt)}`;
}

export const getBoard = createServerFn({ method: "GET" }).handler(async () => {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const remote = await import("./blob-board.server");
      const board = await remote.remoteBoard();
      return {
        captures: visibleOnly(board.captures.map((capture) => publicCard(capture))),
        briefing: shownBriefing(board.briefing),
      };
    } catch (error) {
      console.error(error);
      return { captures: [], briefing: defaultBriefing };
    }
  }
  try {
    const [stored, briefing] = await Promise.all([listRows(), readBriefing()]);
    return { captures: visibleOnly(stored), briefing };
  } catch (error) {
    console.error(error);
    return { captures: [], briefing: defaultBriefing };
  }
});

export const listCaptures = createServerFn({ method: "GET" })
  .middleware([operatorMiddleware])
  .handler(async () => {
    return listRows();
  });

export const getCapture = createServerFn({ method: "GET" })
  .validator((slug: string) => (typeof slug === "string" ? slug : ""))
  .handler(async ({ data: slug }) => {
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const remote = await import("./blob-board.server");
        const board = await remote.remoteBoard();
        const found = board.captures.find((item) => item.slug === slug);
        if (!found || found.visible === false) return null;
        let src = sphereSrc(found.slug, found.updatedAt);
        if (found.imagePath) {
          try {
            src = await remote.remoteReadUrl(found.imagePath);
          } catch (error) {
            console.error(error);
          }
        }
        return { ...publicCard(found), src };
      } catch (error) {
        console.error(error);
      }
      return null;
    }
    try {
      await dropSeededSample();
      const sql = await getSql();
      const rows = await sql<CaptureCard>`
        select slug, name, category, brief, updated_at::text as "updatedAt", visible
        from captures
        where slug = ${slug}
      `;
      const found = rows[0];
      if (!found || found.visible === false) return null;
      return { ...found, src: sphereSrc(found.slug, found.updatedAt) };
    } catch (error) {
      console.error(error);
      return null;
    }
  });

async function withThumbs(
  captures: Array<{ thumbPath?: string } & Parameters<typeof publicCard>[0]>,
  sign: (path: string) => Promise<string>,
) {
  return Promise.all(
    captures.map(async (capture) => {
      const card = publicCard(capture);
      if (!capture.thumbPath) return card;
      try {
        card.thumbSrc = await sign(capture.thumbPath);
      } catch (error) {
        console.error(error);
      }
      return card;
    }),
  );
}

async function loadOperatorBoard(userId: string) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const remote = await import("./blob-board.server");
    const board = await remote.remoteBoard();
    const captures = await withThumbs(board.captures, (path) => remote.remoteReadUrl(path));
    const briefing = shownBriefing(board.briefing);
    if (process.env.OPERATOR_PASSWORD) {
      return { isOperator: true, operatorCount: 1, captures, briefing };
    }
    const sql = await getSql();
    const operators = await sql<{ n: number }>`select count(*)::int as n from operators`;
    const mine = await sql<{ user_id: string }>`
      select user_id from operators where user_id = ${userId}
    `;
    return {
      isOperator: mine.length > 0,
      operatorCount: Number(operators[0]?.n ?? 0),
      captures,
      briefing,
    };
  }
  const sql = await getSql();
  const operators = await sql<{ n: number }>`select count(*)::int as n from operators`;
  const mine = await sql<{ user_id: string }>`
    select user_id from operators where user_id = ${userId}
  `;
  const captures = await listRows();
  const briefing = await readBriefing();
  return {
    isOperator: mine.length > 0,
    operatorCount: Number(operators[0]?.n ?? 0),
    captures,
    briefing,
  };
}

export const openConsole = createServerFn({ method: "GET" }).handler(async () => {
  if (!process.env.OPERATOR_PASSWORD) {
    return { mode: "account" as const, unlocked: false as const, board: null };
  }
  const { operatorCookieOk } = await import("./operator-gate.server");
  if (!operatorCookieOk()) {
    return { mode: "passphrase" as const, unlocked: false as const, board: null };
  }
  return { mode: "passphrase" as const, unlocked: true as const, board: await loadOperatorBoard("operator") };
});

export const adminBoard = createServerFn({ method: "GET" })
  .middleware([operatorMiddleware])
  .handler(async ({ context }) => loadOperatorBoard(context.userId));

export const saveBriefing = createServerFn({ method: "POST" })
  .middleware([operatorMiddleware])
  .validator((input: Briefing) => cleanBriefing(input))
  .handler(async ({ context, data }) => {
    await assertMayEdit(context.userId);
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const remote = await import("./blob-board.server");
      await remote.remoteSaveBriefing(data);
      return data;
    }
    const sql = await getSql();
    const value = JSON.stringify(data);
    await sql`
      insert into board_meta (key, value) values ('briefing', ${value})
      on conflict (key) do update set value = ${value}
    `;
    return data;
  });

export const claimBoard = createServerFn({ method: "POST" })
  .middleware([operatorMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const users = await sql<{ email: string }>`
      select email from "user" where id = ${context.userId}
    `;
    const email = users[0]?.email ?? "";
    const claimed = await sql<{ user_id: string }>`
      insert into operators (user_id, email)
      select ${context.userId}, ${email}
      where not exists (select 1 from operators)
      returning user_id
    `;
    if (!claimed.length) throw new Error("This board already has an operator.");
    return { ok: true as const };
  });

export const setCaptureShown = createServerFn({ method: "POST" })
  .middleware([operatorMiddleware])
  .validator((input: { slug: string; visible: boolean; sample?: boolean }) => {
    if (!input || typeof input.slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(input.slug)) {
      throw new Error("Unknown capture.");
    }
    return { slug: input.slug, visible: Boolean(input.visible), sample: Boolean(input.sample) };
  })
  .handler(async ({ context, data }) => {
    await assertMayEdit(context.userId);
    if (data.sample) {
      const value = data.visible ? "1" : "0";
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const remote = await import("./blob-board.server");
        await remote.remoteSetSample(data.visible);
        return { ok: true as const };
      }
      const sql = await getSql();
      await sql`
        insert into board_meta (key, value) values ('show_sample', ${value})
        on conflict (key) do update set value = ${value}
      `;
      return { ok: true as const };
    }
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const remote = await import("./blob-board.server");
      await remote.remoteSetVisible(data.slug, data.visible);
      return { ok: true as const };
    }
    const sql = await getSql();
    const rows = await sql<{ slug: string }>`
      update captures set visible = ${data.visible}, updated_at = now()
      where slug = ${data.slug}
      returning slug
    `;
    if (!rows.length) throw new Error("That capture is gone.");
    return { ok: true as const };
  });

type CaptureInput = {
  name: string;
  category: string;
  brief: string;
  mime: string;
  image?: string;
  thumb?: string;
  imagePath?: string;
  thumbPath?: string;
  bytes?: number;
  width?: number;
  height?: number;
};

function cleanPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("captures/") || value.includes("..") || value.length > 240) {
    throw new Error("That panorama was not stored.");
  }
  return value;
}

function cleanCount(value: unknown, max: number) {
  const n = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(n) || n < 1 || n > max) return undefined;
  return Math.round(n);
}

function readCaptureInput(input: CaptureInput): CaptureInput {
  const mime = typeof input?.mime === "string" && input.mime.startsWith("image/") ? input.mime.slice(0, 80) : "image/jpeg";
  const next: CaptureInput = {
    name: cleanText(input?.name, 80, "Name"),
    category: cleanText(input?.category, 40, "Category"),
    brief: cleanBrief(input?.brief),
    mime,
    bytes: cleanCount(input?.bytes, 100 * 1024 * 1024),
    width: cleanCount(input?.width, 32768),
    height: cleanCount(input?.height, 32768),
  };
  if (input?.imagePath || input?.thumbPath) {
    next.imagePath = cleanPath(input.imagePath);
    next.thumbPath = cleanPath(input.thumbPath);
    return next;
  }
  next.image = cleanImage(input?.image, "Panorama");
  next.thumb = cleanImage(input?.thumb, "Preview");
  return next;
}

export const publishCapture = createServerFn({ method: "POST" })
  .middleware([operatorMiddleware])
  .validator((input: CaptureInput) => readCaptureInput(input))
  .handler(async ({ context, data }) => {
    await assertMayEdit(context.userId);
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const remote = await import("./blob-board.server");
      const board = await remote.remoteBoard();
      const slug = uniqueFrom(
        slugify(data.name),
        board.captures.map((item) => item.slug),
      );
      await remote.remotePublish({
        slug,
        name: data.name,
        category: data.category,
        brief: data.brief,
        mime: data.mime,
        visible: true,
        image: data.image,
        thumb: data.thumb,
        imagePath: data.imagePath,
        thumbPath: data.thumbPath,
        bytes: data.bytes,
        width: data.width,
        height: data.height,
        updatedAt: new Date().toISOString(),
      });
      return { slug };
    }
    if (!data.image || !data.thumb) throw new Error("That panorama was not stored.");
    const sql = await requireOperator(context.userId);
    const slug = await uniqueSlug(slugify(data.name));
    await sql`
      insert into captures (slug, name, category, brief, mime, image_b64, thumb_b64, created_by)
      values (
        ${slug},
        ${data.name},
        ${data.category},
        ${data.brief},
        ${data.mime},
        ${data.image},
        ${data.thumb},
        ${context.userId}
      )
    `;
    return { slug };
  });

type UpdateInput = {
  slug: string;
  name: string;
  category: string;
  brief: string;
  image?: string;
  thumb?: string;
  imagePath?: string;
  thumbPath?: string;
  mime?: string;
  bytes?: number;
  width?: number;
  height?: number;
};

export const updateCapture = createServerFn({ method: "POST" })
  .middleware([operatorMiddleware])
  .validator((input: UpdateInput) => {
    if (!input || typeof input.slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(input.slug)) {
      throw new Error("Unknown capture.");
    }
    const next: UpdateInput = {
      slug: input.slug,
      name: cleanText(input.name, 80, "Name"),
      category: cleanText(input.category, 40, "Category"),
      brief: cleanBrief(input.brief),
      bytes: cleanCount(input.bytes, 100 * 1024 * 1024),
      width: cleanCount(input.width, 32768),
      height: cleanCount(input.height, 32768),
    };
    if (input.imagePath || input.thumbPath) {
      next.imagePath = cleanPath(input.imagePath);
      next.thumbPath = cleanPath(input.thumbPath);
      next.mime =
        typeof input.mime === "string" && input.mime.startsWith("image/") ? input.mime.slice(0, 80) : "image/jpeg";
    } else if (input.image || input.thumb) {
      next.image = cleanImage(input.image, "Panorama");
      next.thumb = cleanImage(input.thumb, "Preview");
      next.mime =
        typeof input.mime === "string" && input.mime.startsWith("image/") ? input.mime.slice(0, 80) : "image/jpeg";
    }
    return next;
  })
  .handler(async ({ context, data }) => {
    await assertMayEdit(context.userId);
    const replacing = Boolean((data.imagePath && data.thumbPath) || (data.image && data.thumb));
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const remote = await import("./blob-board.server");
      await remote.remoteUpdate(
        {
          slug: data.slug,
          name: data.name,
          category: data.category,
          brief: data.brief,
          mime: data.mime,
          image: data.image,
          thumb: data.thumb,
          imagePath: data.imagePath,
          thumbPath: data.thumbPath,
          bytes: data.bytes,
          width: data.width,
          height: data.height,
          updatedAt: new Date().toISOString(),
        },
        replacing,
      );
      return { slug: data.slug };
    }
    const sql = await requireOperator(context.userId);
    if (data.image && data.thumb) {
      const rows = await sql<{ slug: string }>`
        update captures
        set name = ${data.name},
            category = ${data.category},
            brief = ${data.brief},
            image_b64 = ${data.image},
            thumb_b64 = ${data.thumb},
            mime = ${data.mime || "image/jpeg"},
            updated_at = now()
        where slug = ${data.slug}
        returning slug
      `;
      if (!rows.length) throw new Error("That capture is gone.");
      return { slug: data.slug };
    }
    const rows = await sql<{ slug: string }>`
      update captures
      set name = ${data.name},
          category = ${data.category},
          brief = ${data.brief},
          updated_at = now()
      where slug = ${data.slug}
      returning slug
    `;
    if (!rows.length) throw new Error("That capture is gone.");
    return { slug: data.slug };
  });

export const removeCapture = createServerFn({ method: "POST" })
  .middleware([operatorMiddleware])
  .validator((slug: string) => {
    if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(slug)) {
      throw new Error("Unknown capture.");
    }
    return slug;
  })
  .handler(async ({ context, data: slug }) => {
    await assertMayEdit(context.userId);
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const remote = await import("./blob-board.server");
      await remote.remoteRemove(slug);
    }
    try {
      const sql = await getSql();
      await sql`delete from captures where slug = ${slug}`;
    } catch (error) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw error;
      console.error(error);
    }
    return { ok: true as const };
  });
