import "server-only";
import { db } from "@/lib/db";
import { createTextContainer, publishContainer } from "@/lib/threads-api";
import { schedulePollReplies, scheduleAnalyticsSnapshots } from "@/lib/qstash";

export class PublishError extends Error {
  constructor(message: string, public step: "container" | "publish" | "token") {
    super(message);
  }
}

// Runs the actual Threads container creation + 30s wait + publish for a Post
// that already exists in the DB (status SCHEDULED). Updates the row on success/failure.
export async function executePublish(postId: string): Promise<void> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { user: { include: { threadsToken: true } } },
  });

  if (!post) throw new Error("게시물을 찾을 수 없습니다");
  if (post.status === "PUBLISHED") return; // already done (e.g. QStash retry)

  const token = post.user.threadsToken;
  if (!token) {
    await db.post.update({ where: { id: postId }, data: { status: "FAILED" } });
    throw new PublishError("Threads 계정이 연결되어 있지 않습니다", "token");
  }

  let containerId: string;
  try {
    const container = await createTextContainer(
      token.threadsUserId,
      post.generatedText,
      token.accessToken
    );
    containerId = container.id;
  } catch (err) {
    await db.post.update({ where: { id: postId }, data: { status: "FAILED" } });
    throw new PublishError(`Threads 글 생성 실패: ${err}`, "container");
  }

  // Meta requirement: wait before publishing a freshly created container
  await new Promise((r) => setTimeout(r, 30_000));

  let threadsPostId: string;
  try {
    const result = await publishContainer(token.threadsUserId, containerId, token.accessToken);
    threadsPostId = result.id;
  } catch (err) {
    await db.post.update({ where: { id: postId }, data: { status: "FAILED" } });
    throw new PublishError(`Threads 게시 실패: ${err}`, "publish");
  }

  const publishedAt = new Date();
  const replyWindowEnds = new Date(publishedAt.getTime() + 10 * 60 * 1000);

  await db.post.update({
    where: { id: postId },
    data: {
      status: "PUBLISHED",
      threadsPostId,
      publishedAt,
      replyWindowEnds,
      replyJobStatus: "ACTIVE",
    },
  });

  // Schedule background jobs (best-effort: don't fail publish if QStash unavailable)
  try {
    await Promise.all([
      schedulePollReplies(post.id, publishedAt),
      scheduleAnalyticsSnapshots(post.id, publishedAt),
    ]);
  } catch (err) {
    console.error("[publish] QStash scheduling failed", err);
  }
}
