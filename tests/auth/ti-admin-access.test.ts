import { describe, expect, it } from "vitest";

import {
  ADMIN_ACCESS_ROLES,
  isAdminRole,
  isSameRole,
  normalizeRole,
} from "@/lib/roles";
import { MODULOS_REGISTRY } from "@/lib/modulos-registry";
import {
  MAX_AVATAR_SOURCE_BYTES,
  MAX_AVATAR_UPLOAD_BYTES,
  hasValidAvatarSignature,
  validateAvatarMetadata,
} from "@/lib/avatar-upload";

describe("equivalência de acesso administrativo para TI", () => {
  it.each(["Admin", "ADMIN", "CEO", "TI", "T.I", "t.i.", " ti "])(
    "reconhece %s como acesso administrativo",
    (role) => expect(isAdminRole(role)).toBe(true),
  );

  it.each([undefined, null, "", "RECURSOS HUMANOS", "FINANCEIRO", "USER"])(
    "não eleva %s para acesso administrativo",
    (role) => expect(isAdminRole(role)).toBe(false),
  );

  it("normaliza aliases do setor de TI usados pelos documentos POP", () => {
    expect(normalizeRole("T.I")).toBe("TI");
    expect(isSameRole("TI", "T.I.")).toBe(true);
    expect(isSameRole("TI", "Financeiro")).toBe(false);
  });

  it("mantém TI na lista declarada de perfis administrativos", () => {
    expect(ADMIN_ACCESS_ROLES).toContain("TI");
  });

  it("inclui TI em todo módulo que declara Admin entre os allowedRoles", () => {
    const modulosAdminSemTi = MODULOS_REGISTRY.filter(
      (modulo) => modulo.allowedRoles?.includes("Admin") && !modulo.allowedRoles.includes("TI"),
    );
    expect(modulosAdminSemTi).toEqual([]);
  });
});

describe("validação do upload de avatar", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("aceita %s", (type) => {
    expect(validateAvatarMetadata({ type, size: MAX_AVATAR_UPLOAD_BYTES })).toBeNull();
  });

  it("rejeita formatos que não são imagem suportada", () => {
    expect(validateAvatarMetadata({ type: "application/pdf", size: 100 })).toMatch(/JPEG, PNG ou WebP/);
  });

  it("rejeita a origem acima do limite antes de processar no navegador", () => {
    expect(
      validateAvatarMetadata(
        { type: "image/jpeg", size: MAX_AVATAR_SOURCE_BYTES + 1 },
        MAX_AVATAR_SOURCE_BYTES,
      ),
    ).toMatch(/20 MB/);
  });

  it("rejeita o corpo comprimido acima do limite do endpoint", () => {
    expect(
      validateAvatarMetadata(
        { type: "image/webp", size: MAX_AVATAR_UPLOAD_BYTES + 1 },
        MAX_AVATAR_UPLOAD_BYTES,
      ),
    ).toMatch(/1 MB/);
  });

  it("valida a assinatura real do arquivo, além do Content-Type", () => {
    expect(hasValidAvatarSignature("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff]))).toBe(true);
    expect(hasValidAvatarSignature("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasValidAvatarSignature("image/webp", new TextEncoder().encode("RIFF0000WEBP"))).toBe(true);
    expect(hasValidAvatarSignature("image/jpeg", new TextEncoder().encode("not-an-image"))).toBe(false);
  });
});
