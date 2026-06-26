// Validates every problem's stored test cases against a known-correct reference
// solution. Reads problems from the DB (read-only), runs scripts/reference-solutions/<slug>.py
// on each test input, and diffs the output using the judge's normalizeOutput rules.
//
// Run: node --env-file=.env.local scripts/validate-problems.mjs
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const here = dirname(fileURLToPath(import.meta.url));
const solutionsDir = join(here, "reference-solutions");

// Mirror of lib/judge/core.ts normalizeOutput.
function normalizeOutput(output) {
  return output
    .replace(/[ \t]+$/gm, "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+$/, "");
}

const prisma = new PrismaClient();

const problems = await prisma.problem.findMany({
  orderBy: { createdAt: "asc" },
  select: {
    slug: true,
    timeLimitMs: true,
    testCases: {
      orderBy: { order: "asc" },
      select: { input: true, expectedOutput: true, isSample: true, order: true },
    },
  },
});

let failures = 0;
let missing = 0;

for (const problem of problems) {
  const file = join(solutionsDir, `${problem.slug}.py`);
  if (!existsSync(file)) {
    console.log(`MISSING SOLUTION  ${problem.slug}`);
    missing += 1;
    continue;
  }

  const badTests = [];
  for (const test of problem.testCases) {
    const run = spawnSync("python3", [file], {
      input: test.input,
      encoding: "utf8",
      timeout: Math.max(5000, problem.timeLimitMs + 3000),
    });

    if (run.status !== 0) {
      badTests.push({ test, actual: `<<error: ${run.stderr?.trim() || run.error?.message}>>` });
      continue;
    }

    const actual = normalizeOutput(run.stdout);
    const expected = normalizeOutput(test.expectedOutput);
    if (actual !== expected) {
      badTests.push({ test, actual });
    }
  }

  if (badTests.length === 0) {
    console.log(`OK   ${problem.slug} (${problem.testCases.length} tests)`);
  } else {
    failures += badTests.length;
    console.log(`FAIL ${problem.slug} — ${badTests.length}/${problem.testCases.length} mismatch`);
    for (const { test, actual } of badTests) {
      console.log(`     test#${test.order} (${test.isSample ? "sample" : "hidden"})`);
      console.log(`       input    : ${JSON.stringify(test.input)}`);
      console.log(`       expected : ${JSON.stringify(normalizeOutput(test.expectedOutput))}`);
      console.log(`       reference: ${JSON.stringify(actual)}`);
    }
  }
}

console.log(
  `\n${problems.length} problems, ${failures} test mismatches, ${missing} missing solutions.`,
);
await prisma.$disconnect();
process.exit(failures > 0 || missing > 0 ? 1 : 0);
