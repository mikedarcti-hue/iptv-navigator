import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Calendar, Clock, Wifi, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import type { ServerConfig } from "@/lib/iptv-sync";

interface AccountInfo {
  username: string;
  status: string;
  expDate: string;
  maxConnections: string;
  createdAt: string;
  isTrial: boolean;
}

interface AccountInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AccountInfoDialog = ({ open, onOpenChange }: AccountInfoDialogProps) => {
  const [info, setInfo] = useState<AccountInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem("obsidian_server_config");
      if (!saved) return;
      const config: ServerConfig = JSON.parse(saved);

      // Try to load cached account info
      const cached = localStorage.getItem("dark_iptv_account_info");
      if (cached) {
        setInfo(JSON.parse(cached));
        return;
      }

      if (config.type === "xtream" && config.xtreamUser) {
        // Build basic info from config
        setInfo({
          username: config.xtreamUser,
          status: "Ativo",
          expDate: "N/A",
          maxConnections: "N/A",
          createdAt: "N/A",
          isTrial: false,
        });

        // Try fetching real info from Xtream API
        const baseUrl = config.xtreamUrl.replace(/\/+$/, "");
        fetch(`${baseUrl}/player_api.php?username=${config.xtreamUser}&password=${config.xtreamPass}`)
          .then((r) => r.json())
          .then((data) => {
            if (data?.user_info) {
              const u = data.user_info;
              const accountInfo: AccountInfo = {
                username: u.username || config.xtreamUser,
                status: u.status || "Ativo",
                expDate: u.exp_date ? new Date(parseInt(u.exp_date) * 1000).toLocaleDateString("pt-BR") : "Ilimitado",
                maxConnections: u.max_connections || "N/A",
                createdAt: u.created_at ? new Date(parseInt(u.created_at) * 1000).toLocaleDateString("pt-BR") : "N/A",
                isTrial: u.is_trial === "1",
              };
              setInfo(accountInfo);
              localStorage.setItem("dark_iptv_account_info", JSON.stringify(accountInfo));
            }
          })
          .catch(() => {});
      } else if (config.type === "m3u") {
        setInfo({
          username: "Lista M3U",
          status: "Ativo",
          expDate: "N/A",
          maxConnections: "N/A",
          createdAt: "N/A",
          isTrial: false,
        });
      }
    } catch {}
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
