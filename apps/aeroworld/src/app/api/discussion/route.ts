import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

type DiscussionMessage = {
  name: string;
  text: string;
};

const MAX_DISCUSSION_MESSAGES = 40;
const MAX_DISCUSSION_NAME_LENGTH = 20;
const MAX_DISCUSSION_TEXT_LENGTH = 400;

const discussionFileCandidates = [
  path.join(process.cwd(), "apps", "aeroworld", "public", "data", "discussion.json"),
  path.join(process.cwd(), "public", "data", "discussion.json"),
];

const resolveDiscussionFilePath = async () => {
  for (const candidate of discussionFileCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }

  return discussionFileCandidates[0];
};

const readDiscussionMessages = async () => {
  const discussionFilePath = await resolveDiscussionFilePath();
  const raw = await readFile(discussionFilePath, "utf-8");
  const parsed = JSON.parse(raw) as DiscussionMessage[];
  return Array.isArray(parsed) ? parsed.slice(-MAX_DISCUSSION_MESSAGES) : [];
};

export async function GET() {
  try {
    return NextResponse.json(await readDiscussionMessages(), {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json([], {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<DiscussionMessage>;
    const name = (body.name?.trim() ?? "").slice(0, MAX_DISCUSSION_NAME_LENGTH);
    const text = (body.text?.trim() ?? "").slice(0, MAX_DISCUSSION_TEXT_LENGTH);

    if (!name || !text) {
      return NextResponse.json({ error: "Name and text are required" }, { status: 400 });
    }

    const currentMessages = await readDiscussionMessages();
    const nextMessages = [...currentMessages, { name, text }].slice(-MAX_DISCUSSION_MESSAGES);
    const discussionFilePath = await resolveDiscussionFilePath();

    await writeFile(discussionFilePath, `${JSON.stringify(nextMessages, null, 2)}\n`, "utf-8");

    return NextResponse.json(nextMessages, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to save discussion message" }, { status: 500 });
  }
}
