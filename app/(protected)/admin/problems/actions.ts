"use server";

import { requireAdmin } from "../../../../lib/guards";
import { isSupportedLanguage, runJudge } from "../../../../lib/judge";
import { prisma } from "../../../../lib/prisma";

type RunResult =
  | { ok: true; verdict: string; passedCount: number; totalCount: number; runtimeMs: number | null }
  | { ok: false; message: string };

function judgeFailureMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Could not run the judge. Check the judge service logs.";
  }

  if (error.message.includes("JUDGE_BASE_URL")) {
    return "Could not run the judge. JUDGE_BASE_URL is not configured.";
  }

  return `Could not run the judge. ${error.message}`;
}

export async function runReferenceSolution(slug: string): Promise<RunResult> {
  await requireAdmin();

  const problem = await prisma.problem.findUnique({
    where: { slug },
    select: {
      solutionCode: true,
      solutionLanguage: true,
      timeLimitMs: true,
      testCases: { orderBy: { order: "asc" }, select: { input: true, expectedOutput: true } },
    },
  });

  if (!problem?.solutionCode) {
    return { ok: false, message: "No reference solution is stored for this problem." };
  }

  const language = problem.solutionLanguage ?? "python";

  if (!isSupportedLanguage(language)) {
    return { ok: false, message: `Unsupported solution language: ${language}.` };
  }

  try {
    const result = await runJudge({
      code: problem.solutionCode,
      language,
      testCases: problem.testCases,
      timeLimitMs: problem.timeLimitMs,
    });
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, message: judgeFailureMessage(error) };
  }
}
