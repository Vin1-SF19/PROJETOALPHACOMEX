import 'server-only';
import { compare, hash } from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import db from "@/lib/prisma";
const senhaCabeNoBcrypt = (senha: string) => Buffer.byteLength(senha, "utf8") <= 72;
export async function verificarSenha(conta: {
    id: string;
    senhaHash: string | null;
    senha: string;
    authSessionVersion: number;
}, senha: string) {
    const cabeNoBcrypt = senhaCabeNoBcrypt(senha);
    if (conta.senhaHash !== null)
        return cabeNoBcrypt ? compare(senha, conta.senhaHash) : false;
    const valid = timingSafeEqual(createHash("sha256").update(conta.senha).digest(), createHash("sha256").update(senha).digest());
    if (!valid || !conta.senha)
        return false;
    // Long legacy passwords remain exact-only until an explicit bounded reset.
    // Hashing here would silently discard the bytes after bcrypt's boundary.
    if (!cabeNoBcrypt)
        return true;
    const senhaHash = await hash(senha, 12);
    const updated = await db.clienteOperacional.updateMany({
        where: {
            id: conta.id,
            senhaHash: null,
            senha: conta.senha,
            authSessionVersion: conta.authSessionVersion,
        },
        data: { senhaHash, senha: "" },
    });
    if (updated.count === 1)
        return true;
    const latest = await db.clienteOperacional.findUnique({
        where: { id: conta.id },
        select: { senhaHash: true, authSessionVersion: true },
    });
    return Boolean(latest?.senhaHash &&
        latest.authSessionVersion === conta.authSessionVersion &&
        (await compare(senha, latest.senhaHash)));
}
