import { describe, expect, it } from "vitest";

import { SmbGatewayError } from "@/lib/alpha-explorer/smb/browser-client";
import { friendlySmbErrorMessage } from "@/lib/alpha-explorer/smb/error-messages";

describe("Alpha Explorer SMB friendly errors", () => {
  it("explains authentication failures in Portuguese and preserves the support reference", () => {
    const message = friendlySmbErrorMessage(new SmbGatewayError(
      "SMB_AUTHENTICATION_FAILED",
      403,
      "dc730c8c-2bb4-4328-83c0-326c7e4ea0db",
    ));
    expect(message).toContain("recusou o usuário ou a senha");
    expect(message).toContain("Referência para o suporte");
    expect(message).not.toContain("SMB_AUTHENTICATION_FAILED");
  });

  it("distinguishes a valid account without accessible shares", () => {
    expect(friendlySmbErrorMessage(new SmbGatewayError("SMB_NO_ACCESSIBLE_SHARES", 403)))
      .toContain("foi autenticada");
  });

  it("explains an expired Office session without exposing the internal error code", () => {
    const message = friendlySmbErrorMessage(new SmbGatewayError("OFFICE_SESSION_NOT_FOUND", 404));
    expect(message).toContain("acesso temporário");
    expect(message).toContain("Abra o arquivo novamente");
    expect(message).not.toContain("OFFICE_SESSION_NOT_FOUND");
  });
});
