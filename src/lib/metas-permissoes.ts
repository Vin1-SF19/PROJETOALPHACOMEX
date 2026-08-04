import { isAdminRole } from "@/lib/roles";

export function podeGerenciarMetas(role: string) {
    return isAdminRole(role) || role === "Lider Comercial";
}
