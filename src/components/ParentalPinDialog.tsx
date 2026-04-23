import { useState } from "react";
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getPreferences, updatePreferences } from "@/lib/app-preferences";

interface ParentalPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "verify" | "set" | "change";
  onSuccess?: () => void;
}

const ParentalPinDialog = ({ open, onOpenChange, mode, onSuccess }: ParentalPinDialogProps) => {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const reset = () => {
    setPin("");
    setConfirmPin("");
  };

  const handleSubmit = () => {
    if (pin.length !== 4) {
      toast.error("O PIN deve ter 4 dígitos");
      return;
    }
    if (mode === "verify") {
      if (pin === getPreferences().parentalPin) {
        updatePreferences({ parentalUnlocked: true });
        toast.success("Conteúdo desbloqueado");
        onSuccess?.();
        onOpenChange(false);
        reset();
      } else {
        toast.error("PIN incorreto");
        setPin("");
      }
    } else {
      if (pin !== confirmPin) {
        toast.error("Os PINs não conferem");
        return;
      }
      updatePreferences({ parentalPin: pin, parentalEnabled: true });
      toast.success("PIN parental definido");
      onSuccess?.();
      onOpenChange(false);
      reset();
    }
  };

  const titles = {
    verify: "Digite o PIN parental",
    set: "Definir PIN parental",
    change: "Alterar PIN parental",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            {titles[mode]}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {mode === "verify" ? "Insira seu PIN de 4 dígitos para acessar o conteúdo." : "Crie um PIN de 4 dígitos para bloquear conteúdo adulto."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            className="w-full text-center text-2xl tracking-[0.5em] py-3 rounded-lg bg-surface border border-border text-foreground outline-none focus:ring-1 focus:ring-primary/40"
            autoFocus
          />
          {mode !== "verify" && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Confirmar PIN"
              className="w-full text-center text-2xl tracking-[0.5em] py-3 rounded-lg bg-surface border border-border text-foreground outline-none focus:ring-1 focus:ring-primary/40"
            />
          )}
          <button
            onClick={handleSubmit}
            className="w-full py-2.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all"
          >
            Confirmar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ParentalPinDialog;
