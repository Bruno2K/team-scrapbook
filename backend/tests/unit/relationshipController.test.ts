import { describe, expect, it } from "vitest";
import {
  acceptanceHttpResult,
  blockHttpResult,
} from "../../src/controllers/userController.js";

describe("relationship conflict HTTP mapping", () => {
  it("maps retryable/state conflicts without exposing database internals", () => {
    expect(acceptanceHttpResult("conflict")).toEqual({
      status: 409,
      message: "Solicitação já processada ou em conflito",
    });
    expect(blockHttpResult("conflict")).toEqual({
      status: 409,
      message: "Conflito ao atualizar relacionamento; tente novamente",
    });
  });

  it("does not distinguish missing requests from another recipient's request", () => {
    expect(acceptanceHttpResult("not_found")).toEqual(acceptanceHttpResult("forbidden"));
  });
});
