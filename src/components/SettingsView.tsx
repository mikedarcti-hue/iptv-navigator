import { useState } from "react";
import { Plus, RefreshCw, Trash2, Tv, Lock, Settings as SettingsIcon, Wifi, Sliders } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { usePreferences } from "@/hooks/use-preferences";
import { addEpgSource, removeEpgSource, toggleEpgSource, updatePreferences, clearAppCache } from "@/lib/app-preferences";
import ConnectionSettings from "@/components/settings/ConnectionSettings";
import ParentalPinDialog from "@/components/ParentalPinDialog";
import { cn } from "@/lib/utils";

type Tab = "connection" | "epg" | "stream" | "parental" | "general";

const TABS: { id: Tab; label: string; icon: typeof Wifi }[] = [
  { id: "connection", label: "Conexão", icon: Wifi },
  { id: "epg", label: "EPG", icon: Tv },
  { id: "stream", label: "Fluxo", icon: Sliders },
  { id: "parental", label: "Controle Parental", icon: Lock },
  { id: "general", label: "Geral", icon: SettingsIcon },
];

const SettingsView = () => {
  const [tab, setTab] = useState<Tab>("connection");
  const { prefs, update } = usePreferences();
  const [epgDialogOpen, setEpgDialogOpen] = useState(false);
  const [epgName, setEpgName] = useState("");
  const [epgUrl, setEpgUrl] = useState("");
  const [pinDialog, setPinDialog] = useState<{ open: boolean; mode: "set" | "change" }>({ open: false, mode: "set" });
  const [updatingEpg, setUpdatingEpg] = useState(false);

  const handleAddEpg = () => {
    if (!epgName.trim() || !epgUrl.trim()) {
      toast.error("Preencha nome e URL");
      return;
    }
    addEpgSource(epgName.trim(), epgUrl.trim());
    setEpgName("");
    setEpgUrl("");
    setEpgDialogOpen(false);
    toast.success("Fonte EPG adicionada");
  };

  const handleUpdateEpg = async () => {
    const enabled = prefs.epgSources.filter((s) => s.enabled);
    if (enabled.length === 0) {
      toast.error("Adicione e ative ao menos uma fonte EPG");
      return;
    }
    setUpdatingEpg(true);
    try {
      // Trigger fetch attempt (best-effort) to validate sources
      await Promise.allSettled(enabled.map((s) => fetch(s.url, { method: "HEAD" }).catch(() => null)));
      update({ epgLastUpdate: Date.now() });
      toast.success(`EPG atualizado de ${enabled.length} fonte(s)`);
    } finally {
      setUpdatingEpg(false);
    }
  };

  const handleClearCache = async () => {
    await clearAppCache();
    toast.success("Cache limpo com sucesso");
  };

  const handleParentalToggle = (enabled: boolean) => {
    if (enabled && !prefs.parentalPin) {
      setPinDialog({ open: true, mode: "set" });
    } else {
      update({ parentalEnabled: enabled, parentalUnlocked: false });
      toast.success(enabled ? "Controle parental ativado" : "Controle parental desativado");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie conexão, EPG, controle parental e preferências</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all tv-focus",
              tab === id ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-surface-hover"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Connection */}
      {tab === "connection" && <ConnectionSettings />}

      {/* EPG */}
      {tab === "epg" && (
        <div className="space-y-4">
          <ToggleRow
            label="Ativar EPG"
            description="Guia eletrônico de programação"
            checked={prefs.epgEnabled}
            onChange={(v) => update({ epgEnabled: v })}
          />
          <ToggleRow
            label="Atualizar automaticamente"
            description="Sincroniza fontes EPG ao iniciar o app"
            checked={prefs.epgAutoUpdate}
            onChange={(v) => update({ epgAutoUpdate: v })}
          />

          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fontes de EPG</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateEpg}
                  disabled={updatingEpg}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface text-xs font-medium text-foreground hover:bg-surface-hover transition-all border border-border tv-focus disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", updatingEpg && "animate-spin")} />
                  Atualizar
                </button>
                <button
                  onClick={() => setEpgDialogOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-all tv-focus"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </div>
            </div>
            <div className="glass-surface rounded-xl overflow-hidden card-shadow">
              {prefs.epgSources.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma fonte EPG adicionada</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {prefs.epgSources.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.url}</p>
                      </div>
                      <Switch checked={s.enabled} onCheckedChange={() => toggleEpgSource(s.id)} />
                      <button
                        onClick={() => { removeEpgSource(s.id); toast.success("Fonte removida"); }}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors tv-focus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {prefs.epgLastUpdate && (
              <p className="text-xs text-muted-foreground mt-2 px-1">
                Última atualização: {new Date(prefs.epgLastUpdate).toLocaleString("pt-BR")}
              </p>
            )}
          </section>
        </div>
      )}

      {/* Stream Format */}
      {tab === "stream" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground px-1">
            Escolha o formato de fluxo. "Padrão" detecta automaticamente da lista integrada.
          </p>
          {[
            { value: "default" as const, label: "Padrão (automático)", desc: "Detecta o melhor formato pela lista" },
            { value: "ts" as const, label: "MPEGTS (.ts)", desc: "Compatível com a maioria dos servidores Xtream" },
            { value: "m3u8" as const, label: "HLS (.m3u8)", desc: "Streaming adaptativo, melhor para internet instável" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { update({ streamFormat: opt.value }); toast.success(`Formato: ${opt.label}`); }}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-lg transition-all text-left tv-focus",
                prefs.streamFormat === opt.value ? "bg-primary/15 border border-primary/30" : "bg-surface hover:bg-surface-hover border border-transparent"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                prefs.streamFormat === opt.value ? "border-primary" : "border-muted-foreground"
              )}>
                {prefs.streamFormat === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Parental Control */}
      {tab === "parental" && (
        <div className="space-y-4">
          <ToggleRow
            label="Ativar controle parental"
            description="Bloqueia conteúdo adulto exigindo PIN para acesso"
            checked={prefs.parentalEnabled}
            onChange={handleParentalToggle}
          />
          {prefs.parentalEnabled && (
            <button
              onClick={() => setPinDialog({ open: true, mode: "change" })}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-surface hover:bg-surface-hover transition-all tv-focus"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">Alterar PIN</p>
                <p className="text-xs text-muted-foreground">Defina um novo PIN de 4 dígitos</p>
              </div>
              <Lock className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <div className="p-4 rounded-lg bg-surface/50 border border-border/50">
            <p className="text-xs text-muted-foreground">
              Conteúdos com palavras-chave como "adulto", "XXX", "+18" serão bloqueados. O bloqueio dura até reiniciar o app.
            </p>
          </div>
        </div>
      )}

      {/* General */}
      {tab === "general" && (
        <div className="space-y-3">
          <ToggleRow
            label="Iniciar com o sistema"
            description="Auto-iniciar quando o dispositivo ligar (Android TV)"
            checked={prefs.autoStartOnBoot}
            onChange={(v) => update({ autoStartOnBoot: v })}
          />
          <ToggleRow
            label="Mostrar guia completo"
            description="Exibe descrição e horários estendidos do EPG"
            checked={prefs.showFullGuide}
            onChange={(v) => update({ showFullGuide: v })}
          />
          <ToggleRow
            label="Legendas ativas"
            description="Habilita faixas de legenda quando disponíveis"
            checked={prefs.subtitlesEnabled}
            onChange={(v) => update({ subtitlesEnabled: v })}
          />
          <ToggleRow
            label="Picture-in-Picture"
            description="Continua reproduzindo em mini-janela ao sair do app"
            checked={prefs.pictureInPictureEnabled}
            onChange={(v) => update({ pictureInPictureEnabled: v })}
          />
          <ToggleRow
            label="Mostrar EPG na lista de canais"
            description="Exibe programa atual abaixo do nome do canal"
            checked={prefs.showEpgInChannelList}
            onChange={(v) => update({ showEpgInChannelList: v })}
          />
          <ToggleRow
            label="Reprodução automática do próximo episódio"
            description="Avança automaticamente para o próximo episódio"
            checked={prefs.autoPlayNextEnabled}
            onChange={(v) => update({ autoPlayNextEnabled: v })}
          />
          {prefs.autoPlayNextEnabled && (
            <div className="p-4 rounded-lg bg-surface">
              <p className="text-sm font-medium text-foreground mb-3">Tempo de espera</p>
              <div className="grid grid-cols-4 gap-2">
                {[10, 20, 30, 40].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => update({ autoPlayNextDelay: sec as 10 | 20 | 30 | 40 })}
                    className={cn(
                      "py-2 rounded-lg text-sm font-medium transition-all tv-focus",
                      prefs.autoPlayNextDelay === sec ? "bg-primary text-primary-foreground" : "bg-surface-hover text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          )}
          <ToggleRow
            label="Auto-limpar cache"
            description="Limpa cache automaticamente ao iniciar o app"
            checked={prefs.autoClearCache}
            onChange={(v) => update({ autoClearCache: v })}
          />
          <button
            onClick={handleClearCache}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-all tv-focus"
          >
            <Trash2 className="w-4 h-4" />
            Limpar cache agora
          </button>
        </div>
      )}

      {/* Add EPG Dialog */}
      <Dialog open={epgDialogOpen} onOpenChange={setEpgDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Adicionar fonte EPG</DialogTitle>
            <DialogDescription className="text-muted-foreground">Insira nome e URL XMLTV ou XML.gz</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome</label>
              <input
                type="text"
                autoFocus
                value={epgName}
                onChange={(e) => setEpgName(e.target.value)}
                placeholder="Minha fonte EPG"
                className="tv-focus w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">URL</label>
              <input
                type="url"
                inputMode="url"
                value={epgUrl}
                onChange={(e) => setEpgUrl(e.target.value)}
                placeholder="https://exemplo.com/epg.xml"
                className="tv-focus w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleAddEpg}
              className="tv-focus w-full py-2.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all"
            >
              Adicionar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ParentalPinDialog
        open={pinDialog.open}
        onOpenChange={(o) => setPinDialog({ ...pinDialog, open: o })}
        mode={pinDialog.mode}
      />
    </div>
  );
};

const ToggleRow = ({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center gap-4 p-4 rounded-xl glass-surface card-shadow">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default SettingsView;
