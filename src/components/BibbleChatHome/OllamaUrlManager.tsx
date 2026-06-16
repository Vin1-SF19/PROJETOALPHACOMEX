"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Settings,
  Server
} from "lucide-react";

interface OllamaUrlManagerProps {
  currentUrl: string;
  onUrlChange: (newUrl: string) => void;
}

export function OllamaUrlManager({ currentUrl, onUrlChange }: OllamaUrlManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          URL Ollama
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Configurações de Ollama
          </DialogTitle>
          <DialogDescription>
            Atualize o URL da instância Ollama.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">URL atual do Ollama</label>
            <div className="mt-1">
              <p className="text-sm text-foreground/80 font-mono break-all">
                {currentUrl}
              </p>
              <p className="text-xs text-foreground/60 mt-1">
                Para alterar o URL, atualize o arquivo .env.local
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}