"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

interface ConfirmacoesJustificativaMetaProps {
    confirmarSobrescritaAberto: boolean;
    onConfirmarSobrescritaChange: (open: boolean) => void;
    onSubstituir: () => void;
    mesLabel: string;
    ano: number;

    confirmarExclusaoAberto: boolean;
    onConfirmarExclusaoChange: (open: boolean) => void;
    onExcluir: () => void;
    excluindo: boolean;
}

export function ConfirmacoesJustificativaMeta({
    confirmarSobrescritaAberto,
    onConfirmarSobrescritaChange,
    onSubstituir,
    mesLabel,
    ano,
    confirmarExclusaoAberto,
    onConfirmarExclusaoChange,
    onExcluir,
    excluindo,
}: ConfirmacoesJustificativaMetaProps) {
    return (
        <>
            <AlertDialog open={confirmarSobrescritaAberto} onOpenChange={onConfirmarSobrescritaChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Substituir justificativa vigente?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Já existe uma justificativa para {mesLabel}/{ano}. Isso vai substituir o arquivo vigente
                            desse período. A versão anterior continua disponível no histórico. Continuar?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={onSubstituir}>Substituir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={confirmarExclusaoAberto} onOpenChange={onConfirmarExclusaoChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita e remove o arquivo do histórico também.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className={buttonVariants({ variant: "destructive" })}
                            disabled={excluindo}
                            onClick={onExcluir}
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
