import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const pinPath = join(
  projectRoot,
  "src",
  "contracts",
  "opportunity-signal-v1.pin.json",
);
const goldenPath = join(
  projectRoot,
  "src",
  "private-engine",
  "opportunity-signal-v1.golden.json",
);
const pin = JSON.parse(readFileSync(pinPath, "utf8"));
const golden = JSON.parse(readFileSync(goldenPath, "utf8"));

const checkoutArgument = process.argv[2];
if (!checkoutArgument) {
  throw new Error(
    "Pass a checkout of the pinned public repository as the only argument.",
  );
}

const publicCheckout = isAbsolute(checkoutArgument)
  ? resolve(checkoutArgument)
  : resolve(projectRoot, checkoutArgument);

function gitValue(...arguments_) {
  const result = spawnSync("git", ["-C", publicCheckout, ...arguments_], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error("Unable to verify the pinned public Git checkout.");
  }
  return result.stdout.trim();
}

assert.equal(
  gitValue("rev-parse", "HEAD"),
  pin.commit,
  "Public checkout HEAD does not match the immutable contract pin.",
);
assert.equal(
  gitValue("rev-parse", `HEAD:${pin.package_path}`),
  pin.package_tree,
  "Public opportunity-signal package tree does not match the pin.",
);

const temporaryRoot = mkdtempSync(join(tmpdir(), "prism-contract-conformance-"));
const outputDirectory = join(temporaryRoot, "dist");
const compiler = join(projectRoot, "node_modules", "typescript", "bin", "tsc");
let exitCode = 1;

function materializePinnedPublicPackage() {
  const archive = spawnSync(
    "git",
    [
      "-C",
      publicCheckout,
      "archive",
      "--format=tar",
      "--prefix=public/",
      `${pin.commit}:${pin.package_path}`,
    ],
    { encoding: null, stdio: ["ignore", "pipe", "pipe"] },
  );
  if (archive.status !== 0 || archive.stdout === null) {
    throw new Error("Unable to materialize the pinned public package object.");
  }

  const extraction = spawnSync(
    "tar",
    ["-xf", "-", "-C", temporaryRoot],
    {
      input: archive.stdout,
      encoding: null,
      stdio: ["pipe", "ignore", "pipe"],
    },
  );
  if (extraction.status !== 0) {
    throw new Error("Unable to extract the pinned public package object.");
  }
}

const bridgeSource = `
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  OpportunitySignalContractError,
  canonicalOpportunitySignalEvidenceBundleBytesV1,
  canonicalOpportunitySignalRequestBytesV1,
  evaluateOpportunitySignalV1,
  opportunitySignalEvidenceBundleDigestV1,
  opportunitySignalRequestDigestV1,
  parseOpportunitySignalEvidenceEnvelopeV1,
  parseOpportunitySignalInputV1,
  parseOpportunitySignalProviderResultV1,
  parseOpportunitySignalV1,
  projectOpportunitySignalV1,
} from "./public/src/index";
import {
  createOpportunitySignalEvidenceFixture,
  createOpportunitySignalFixture,
} from "./private-engine/fixtures";
import { fixtureOpportunityProviderV1 } from "./private-engine/provider";

const golden = ${JSON.stringify(golden)} as const;
const digestProvider = Object.freeze({
  async digest(algorithm: "SHA-256", data: ArrayBuffer): Promise<ArrayBuffer> {
    return (await webcrypto.subtle.digest(algorithm, data)) as ArrayBuffer;
  },
});

async function main(): Promise<void> {
  const envelope = createOpportunitySignalEvidenceFixture();
  const input = createOpportunitySignalFixture();
  parseOpportunitySignalEvidenceEnvelopeV1(envelope);
  parseOpportunitySignalInputV1(input);

  assert.equal(
    canonicalOpportunitySignalEvidenceBundleBytesV1(envelope).byteLength,
    golden.evidence.canonical_bytes,
  );
  assert.equal(
    await opportunitySignalEvidenceBundleDigestV1(envelope, digestProvider),
    golden.evidence.digest,
  );
  assert.equal(
    canonicalOpportunitySignalRequestBytesV1(input).byteLength,
    golden.request.canonical_bytes,
  );
  const requestDigest = await opportunitySignalRequestDigestV1(
    input,
    digestProvider,
  );
  assert.equal(requestDigest, golden.request.digest);

  const providerResult = await fixtureOpportunityProviderV1.evaluate(
    input,
    Object.freeze({ request_digest: requestDigest }),
  );
  assert.deepEqual(providerResult, golden.expected_provider_result);
  parseOpportunitySignalProviderResultV1(providerResult);
  assert.deepEqual(Object.keys(providerResult as object).sort(), [
    "candidate_ref",
    "classification",
    "evaluated_at",
    "expires_at",
    "reason_codes",
    "request_digest",
    "schema",
  ]);

  const output = await evaluateOpportunitySignalV1(
    fixtureOpportunityProviderV1,
    input,
    digestProvider,
  );
  assert.deepEqual(
    {
      classification: output.classification,
      estimate: output.estimate,
      liquidity: output.liquidity,
    },
    golden.expected_public_projection,
  );
  assert.ok(output.risk_codes.includes("availability_not_reserved"));
  const missingInherentRisk = {
    ...output,
    risk_codes: output.risk_codes.filter(
      (risk) => risk !== "availability_not_reserved",
    ),
  };
  assert.throws(
    () => parseOpportunitySignalV1(missingInherentRisk),
    (error: unknown) =>
      error instanceof OpportunitySignalContractError &&
      error.phase === "output" &&
      error.issues.some(
        (issue) =>
          issue.path === "$.risk_codes" && issue.code === "unsafe_claim",
      ),
  );

  let providerCalls = 0;
  const countingProvider = {
    async evaluate(...args: Parameters<typeof fixtureOpportunityProviderV1.evaluate>) {
      providerCalls += 1;
      return fixtureOpportunityProviderV1.evaluate(...args);
    },
  };
  const staleRightsInput = {
    ...input,
    candidate: {
      ...input.candidate,
      asking_price_minor: input.candidate.asking_price_minor + 1,
    },
  };
  const denied = await evaluateOpportunitySignalV1(
    countingProvider,
    staleRightsInput,
    digestProvider,
  );
  assert.equal(providerCalls, 0);
  assert.equal(denied.classification, "unavailable");
  assert.ok(denied.reason_codes.includes("rights_not_eligible"));
  assert.equal(denied.valuation_as_of, null);
  assert.equal(denied.confidence, null);
  assert.equal(denied.liquidity, null);
  assert.equal(denied.estimate, null);
  assert.deepEqual(denied.risk_codes, [
    "availability_not_reserved",
    "condition_unverified",
    "authenticity_unverified",
  ]);

  const changedEnvelope = {
    ...envelope,
    candidate: staleRightsInput.candidate,
  };
  const changedEvidenceDigest = await opportunitySignalEvidenceBundleDigestV1(
    changedEnvelope,
    digestProvider,
  );
  const reboundInput = {
    ...staleRightsInput,
    release_eligibility: {
      ...staleRightsInput.release_eligibility,
      evidence_bundle_digest: changedEvidenceDigest,
    },
  };
  await assert.rejects(
    () => projectOpportunitySignalV1(reboundInput, providerResult, digestProvider),
    (error: unknown) => error instanceof OpportunitySignalContractError,
  );

  process.stdout.write(
    "Pinned opportunity-signal/v1 parser/projector conformance passed.\\n",
  );
}

void main();
`;

try {
  // Compile the verified Git object, never mutable checkout filesystem bytes.
  materializePinnedPublicPackage();
  cpSync(
    join(projectRoot, "src", "contracts"),
    join(temporaryRoot, "contracts"),
    { recursive: true },
  );
  cpSync(
    join(projectRoot, "src", "private-engine"),
    join(temporaryRoot, "private-engine"),
    { recursive: true },
  );
  writeFileSync(join(temporaryRoot, "bridge.ts"), bridgeSource);
  writeFileSync(
    join(temporaryRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020", "DOM"],
          module: "CommonJS",
          moduleResolution: "Node",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          resolveJsonModule: true,
          types: ["node"],
          typeRoots: [join(projectRoot, "node_modules", "@types")],
          outDir: outputDirectory,
        },
        include: ["bridge.ts"],
      },
      null,
      2,
    ),
  );

  const compile = spawnSync(
    process.execPath,
    [compiler, "-p", join(temporaryRoot, "tsconfig.json")],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (compile.status === 0) {
    const bridge = spawnSync(
      process.execPath,
      [join(outputDirectory, "bridge.js")],
      { cwd: projectRoot, stdio: "inherit" },
    );
    exitCode = bridge.status ?? 1;
  } else {
    exitCode = compile.status ?? 1;
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

process.exitCode = exitCode;
