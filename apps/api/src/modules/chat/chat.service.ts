import { prisma } from "../../db/prisma";
import { getAIProvider } from "../../ai";
import { cosineSimilarity } from "../../ai/embeddings";

const TOP_K = 15;

export async function askQuestion(projectId: string, userId: string, question: string, sessionId?: string) {
  const ai = getAIProvider();

  const session = sessionId
    ? await prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } })
    : await prisma.chatSession.create({ data: { projectId, userId } });

  await prisma.chatMessage.create({ data: { sessionId: session.id, role: "user", content: question } });

  const sourceIds = (await prisma.source.findMany({ where: { projectId }, select: { id: true } })).map((s) => s.id);
  const comments = await prisma.comment.findMany({
    where: { sourceId: { in: sourceIds } },
    include: { analysis: true },
  });

  const questionEmbedding = await ai.embed(question);

  const scored = comments
    .filter((c) => !!c.analysis?.embedding)
    .map((c) => {
      const embedding = JSON.parse(c.analysis!.embedding!) as number[];
      return {
        comment: c,
        similarity: cosineSimilarity(questionEmbedding, embedding),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP_K);

  const context = scored.map((s) => ({
    text: s.comment.textTranslated ?? s.comment.textOriginal,
    sentiment: s.comment.analysis?.sentimentLabel ?? "neutral",
  }));

  const { answer } = await ai.answerQuestion(question, context);

  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: answer,
      citedCommentIds: JSON.stringify(scored.map((s) => s.comment.id)),
    },
  });

  return {
    session_id: session.id,
    answer,
    cited_comment_ids: scored.map((s) => s.comment.id),
  };
}
