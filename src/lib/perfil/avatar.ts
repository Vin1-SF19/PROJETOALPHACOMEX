import 'server-only';
import { randomUUID, createHash } from "node:crypto";
import db from "@/lib/prisma";
import { exigirLeituraChecklist, } from "@/lib/checklist/acesso";
import { storageConfig, storageDriver, lerStreamLimitado, legacyUrlPermitida, type ChecklistStorage, } from "@/lib/checklist/storage";
import { fail } from "@/lib/checklist/result";
import type { AtorChecklist } from "@/lib/checklist/types";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const REF = "perfil-private:v1:";
const mimeTypes = ["image/jpeg", "image/png", "image/webp"];
export function mimeAvatar(bytes: Uint8Array) {
    if (bytes.length >= 3 &&
        bytes[0] === 255 &&
        bytes[1] === 216 &&
        bytes[2] === 255)
        return "image/jpeg";
    if (bytes.length >= 8 &&
        Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        return "image/png";
    if (bytes.length >= 12 &&
        Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
        Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP")
        return "image/webp";
    fail("UPLOAD_INVALID", "Envie JPEG, PNG ou WebP válido.");
}
export function avatarUrlPublica(imagemUrl: string | null) {
    if (!imagemUrl)
        return null;
    return ("/api/perfil/avatar?v=" +
        createHash("sha256").update(imagemUrl).digest("hex").slice(0, 20));
}
export async function salvarAvatar(ator: AtorChecklist, input: {
    nome: string;
    mime: string;
    body: ReadableStream<Uint8Array>;
    signal?: AbortSignal;
}, driver?: ChecklistStorage) {
    await exigirLeituraChecklist(ator);
    if (ator.kind !== "PORTAL")
        fail("FORBIDDEN", "Esta foto pertence ao portal.");
    if (!input.nome.trim() ||
        input.nome.length > 255 ||
        !mimeTypes.includes(input.mime))
        fail("UPLOAD_INVALID", "Selecione JPEG, PNG ou WebP de até 2 MiB.");
    const bytes = await lerStreamLimitado(input.body, MAX_AVATAR_BYTES, input.signal);
    if (!bytes.length || mimeAvatar(bytes) !== input.mime)
        fail("UPLOAD_INVALID", "O conteúdo não corresponde ao tipo informado.");
    const prefix = storageConfig().prefix;
    const ext = input.mime === "image/jpeg"
        ? "jpg"
        : input.mime === "image/png"
            ? "png"
            : "webp";
    const key = `${prefix}perfil/${encodeURIComponent(ator.id)}/${randomUUID()}.${ext}`;
    await (driver ?? storageDriver()).put(key, bytes, input.mime);
    await db.$transaction(async (tx) => {
        await exigirLeituraChecklist(ator, tx);
        const changed = await tx.clienteOperacional.updateMany({
            where: { id: ator.id, authSessionVersion: ator.sessionVersion },
            data: { imagemUrl: REF + key },
        });
        if (changed.count !== 1)
            fail("UNAUTHENTICATED", "Entre novamente.");
    });
    return { url: avatarUrlPublica(REF + key)! };
}
export async function abrirAvatar(ator: AtorChecklist, signal: AbortSignal, driver?: ChecklistStorage) {
    await exigirLeituraChecklist(ator);
    if (ator.kind !== "PORTAL")
        fail("FORBIDDEN", "Sem acesso.");
    const conta = await db.clienteOperacional.findUnique({
        where: { id: ator.id },
        select: { imagemUrl: true },
    });
    if (!conta?.imagemUrl)
        fail("NOT_FOUND", "Foto não encontrada.");
    let source: {
        body: ReadableStream<Uint8Array>;
        mime: string;
        size: number;
    };
    if (conta.imagemUrl.startsWith(REF)) {
        const key = conta.imagemUrl.slice(REF.length);
        const allowed = `${storageConfig().prefix}perfil/${encodeURIComponent(ator.id)}/`;
        if (!key.startsWith(allowed) ||
            !/^[-a-zA-Z0-9]+\.(jpg|png|webp)$/.test(key.slice(allowed.length)))
            fail("FORBIDDEN", "Foto não pertence a esta conta.");
        source = await (driver ?? storageDriver()).get(key, signal);
    }
    else {
        const url = legacyUrlPermitida(conta.imagemUrl);
        const response = await fetch(url, {
            redirect: "error",
            signal,
            cache: "no-store",
        });
        if (!response.ok || !response.body)
            fail("NOT_FOUND", "Foto indisponível.");
        source = {
            body: response.body,
            mime: response.headers.get("content-type") ?? "",
            size: Number(response.headers.get("content-length") ?? 0),
        };
    }
    const mime = source.mime.split(";")[0];
    if (!mimeTypes.includes(mime) || source.size > MAX_AVATAR_BYTES) {
        await source.body.cancel();
        fail("UPLOAD_INVALID", "Foto inválida ou acima de 2 MiB.");
    }
    let size = 0, header = new Uint8Array(), verified = false, lastCheck = 0;
    const body = source.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        async transform(chunk, controller) {
            size += chunk.length;
            if (size > MAX_AVATAR_BYTES)
                fail("LIMIT_EXCEEDED", "Foto excede 2 MiB.");
            if (Date.now() - lastCheck > 5000) {
                await exigirLeituraChecklist(ator);
                lastCheck = Date.now();
            }
            if (!verified) {
                const combined = new Uint8Array(header.length + chunk.length);
                combined.set(header);
                combined.set(chunk, header.length);
                header = combined;
                if (header.length < 12)
                    return;
                if (mimeAvatar(header) !== mime)
                    fail("UPLOAD_INVALID", "Foto inválida.");
                verified = true;
                controller.enqueue(header);
                header = new Uint8Array();
            }
            else
                controller.enqueue(chunk);
        },
        flush(controller) {
            if (!verified) {
                if (mimeAvatar(header) !== mime)
                    fail("UPLOAD_INVALID", "Foto inválida.");
                controller.enqueue(header);
            }
        },
    }), { signal });
    return { body, mime };
}
