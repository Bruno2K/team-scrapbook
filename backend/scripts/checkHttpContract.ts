import { pathToFileURL } from "node:url";
import app from "../src/app.js";
import { openApiSpec } from "../src/openapi.js";
import {
  DOCUMENTATION_SURFACE_EXCLUSIONS,
  extractNonRouteMounts,
  extractOpenApiHttpOperations,
  extractRuntimeHttpOperations,
  findHttpContractDrift,
  formatHttpContractDrift,
  hasHttpContractDrift,
} from "./httpContract.js";

export function checkHttpContract() {
  const runtime = extractRuntimeHttpOperations(app);
  const openApi = extractOpenApiHttpOperations(openApiSpec);
  const nonRouteMounts = extractNonRouteMounts(app);
  return {
    runtime,
    openApi,
    nonRouteMounts,
    exclusions: DOCUMENTATION_SURFACE_EXCLUSIONS,
    drift: findHttpContractDrift({
      runtime,
      openApi,
      exclusions: DOCUMENTATION_SURFACE_EXCLUSIONS,
      nonRouteMounts,
    }),
  };
}

async function main() {
  const result = checkHttpContract();
  if (hasHttpContractDrift(result.drift)) {
    console.error("HTTP contract drift: fail");
    console.error(formatHttpContractDrift(result.drift));
    process.exitCode = 1;
    return;
  }
  console.log(
    `HTTP contract: pass (${result.runtime.length} runtime operations including documentation surfaces, ${result.openApi.length} OpenAPI operations, product METHOD+PATH aligned)`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
