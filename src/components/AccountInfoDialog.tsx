import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Calendar, Clock, Wifi, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchAccountInfo, type AccountInfo } from "@/lib/account-info";

interface AccountInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AccountInfoDialog = ({ open, onOpenChange }: AccountInfoDialogProps) => {
  const [info, setInfo] = useState<AccountInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    fetchAccountInfo().then((result) => {
      if (result) setInfo(result);
    });
  }, [open]);

  const items = info
    ? [
        { icon: User, label: "Usuário", value: info.username },
        { icon: Shield, label: "Status", value: info.isTrial ? "Trial" : info.status },
        { icon: Calendar, label: "Expiração", value: info.expDate },
        { icon: Wifi, label: "Conexões Máximas", value: info.maxConnections },
        { icon: Clock, label: "Criado em", value: info.createdAt },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">Informações da Conta</DialogTitle>
        </DialogHeader>
        {!info ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma lista configurada</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-surface">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium text-foreground truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AccountInfoDialog;
