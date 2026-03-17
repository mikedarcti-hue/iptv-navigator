import { useState } from "react";
import { ChevronRight, Database, Globe, Info, Loader2, RefreshCw, Shield, Wifi, WifiOff } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useCatalog } from "@/hooks/use-catalog";
import { defaultServerConfig, syncCatalogFromConfig, testIptvConnection, type ServerConfig } from "@/lib/iptv-sync";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

const SettingsView = () => {
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [bufferDialogOpen, setBufferDialogOpen] = useState(false);
  const [decoderDialogOpen, setDecoderDialogOpen] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [syncing, setSyncing] = useState(false);
  const [config, setConfig] = useState<ServerConfig>(() => {
    const saved = localStorage.getItem("obsidian_server_config");
    return saved ? JSON.parse(saved) : defaultServerConfig;
  });
  const [tempConfig, setTempConfig] = useState<ServerConfig>(config);
  const [bufferSize, setBufferSize] = useState(() => localStorage.getItem("obsidian_buffer") || "50");
  const [decoder, setDecoder] = useState(() => localStorage.getItem("obsidian_decoder") || "hardware");
  const { catalog, updateCatalog } = useCatalog();

  const isConfigured = config.type === "m3u"
    ? !!config.m3uUrl.trim()
    : !!config.xtreamUrl.trim() && !!config.xtreamUser.trim() && !!config.xtreamPass.trim();

  const catalogSummary = `${catalog.live.length} ao vivo • ${catalog.movies.length} filmes • ${catalog.series.length} séries`;

  const handleOpenServer = () => {
    setTempConfig(config);
    setStatus("idle");
    setServerDialogOpen(true);
  };

  const testConnection = async () => {
    setStatus("testing");
    try {
      await testIptvConnection(tempConfig);
      setStatus("success");
      toast.success("Servidor acessível!");
    } catch (error: any) {
      setStatus("error");
      toast.error(error.message || "Erro ao conectar ao servidor");
    }
  };

  const runCatalogSync = async (nextConfig: ServerConfig) => {
    setSyncing(true);
    try {
      const nextCatalog = await syncCatalogFromConfig(nextConfig);
      updateCatalog(nextCatalog);
      toast.success(`Catálogo atualizado: ${nextCatalog.live.length} canais, ${nextCatalog.movies.length} filmes e ${nextCatalog.series.length} séries.`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao sincronizar catálogo");
    } finally {
      setSyncing(false);
    }
  };

  const saveAndSync = async () => {
    setConfig(tempConfig);
    localStorage.setItem("obsidian_server_config", JSON.stringify(tempConfig));
    setServerDialogOpen(false);
    toast.success("Servidor configurado com sucesso!");
    await runCatalogSync(tempConfig);
  };

  const syncCatalogNow = async () => {
    if (!isConfigured) {
      toast.error("Configure o servidor primeiro");
      return;
    }
    await runCatalogSync(config);
  };

  const saveBuffer = (value: string) => {
    setBufferSize(value);
    localStorage.setItem("obsidian_buffer", value);
    setBufferDialogOpen(false);
    toast.success(`Buffer alterado para ${value}s`);
  };

  const saveDecoder = (value: string) => {
    setDecoder(value);
    localStorage.setItem("obsidian_decoder", value);
    setDecoderDialogOpen(false);
    toast.success("Decodificador alterado");
  };

  const getServerValue = () => {
    if (!isConfigured) return "Não configurado";
    if (config.type === "m3u") return config.m3uUrl.substring(0, 48) + (config.m3uUrl.length > 48 ? "..." : "");
    return `${config.xtreamUser}@${config.xtreamUrl.replace(/https?:\/\//, "").substring(0, 32)}`;
  };

  const settingsGroups = [
    {
      title: "Conexão",
      items: [
        { icon: Globe, label: "URL do Servidor", value: getServerValue(), action: true, onClick: handleOpenServer },
        { icon: Database, label: "Tipo de Playlist", value: config.type === "m3u" ? "M3U" : "Xtream Codes", action: true, onClick: () => setPlaylistDialogOpen(true) },
        { icon: RefreshCw, label: "Sincronizar Catálogo", value: syncing ? "Atualizando..." : catalogSummary, action: true, onClick: syncCatalogNow },
      ],
    },
    {
      title: "Player",
      items: [
        { icon: Shield, label: "Buffer de Vídeo", value: `${bufferSize} segundos`, action: true, onClick: () => setBufferDialogOpen(true) },
        { icon: Info, label: "Decodificador", value: decoder === "hardware" ? "Hardware (padrão)" : "Software (FFmpeg)", action: true, onClick: () => setDecoderDialogOpen(true) },
      ],
    },
    {
      title: "Sobre",
      items: [
        { icon: Info, label: "Versão", value: "1.0.0", action: false, onClick: () => undefined },
        { icon: Shield, label: "Status", value: isConfigured ? "Fonte conectada" : "Sem fonte conectada", action: false, onClick: () => undefined },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua conexão, catálogo e preferências</p>
      </div>

      {settingsGroups.map((group) => (
        <section key={group.title}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">{group.title}</h3>
          <div className="glass-surface rounded-xl overflow-hidden card-shadow divide-y divide-border/50">
            {group.items.map((item) => (
              <div key={item.label} onClick={item.onClick} className="flex items-center gap-4 p-4 hover:bg-surface-hover transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center shrink-0">
                  <item.icon className={`w-5 h-5 text-muted-foreground ${item.label === "Sincronizar Catálogo" && syncing ? "animate-spin" : ""}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.value}</p>
                </div>
                {item.action && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </section>
      ))}

      <Dialog open={serverDialogOpen} onOpenChange={setServerDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Configurar Servidor</DialogTitle>
            <DialogDescription className="text-muted-foreground">Insira os dados de conexão do seu provedor IPTV.</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 p-1 rounded-lg bg-surface">
            <button
              onClick={() => setTempConfig({ ...tempConfig, type: "xtream" })}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${tempConfig.type === "xtream" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Xtream Codes
            </button>
            <button
              onClick={() => setTempConfig({ ...tempConfig, type: "m3u" })}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${tempConfig.type === "m3u" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              M3U / M3U8
            </button>
          </div>

          <div className="space-y-4 mt-2">
            {tempConfig.type === "m3u" ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">URL da Playlist</label>
                <input
                  type="url"
                  value={tempConfig.m3uUrl}
                  onChange={(event) => setTempConfig({ ...tempConfig, m3uUrl: event.target.value })}
                  placeholder="http://exemplo.com/playlist.m3u"
                  className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">URL do Servidor</label>
                  <input
                    type="url"
                    value={tempConfig.xtreamUrl}
                    onChange={(event) => setTempConfig({ ...tempConfig, xtreamUrl: event.target.value })}
                    placeholder="http://servidor.com:8080"
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Usuário</label>
                  <input
                    type="text"
                    value={tempConfig.xtreamUser}
                    onChange={(event) => setTempConfig({ ...tempConfig, xtreamUser: event.target.value })}
                    placeholder="seu_usuario"
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Senha</label>
                  <input
                    type="password"
                    value={tempConfig.xtreamPass}
                    onChange={(event) => setTempConfig({ ...tempConfig, xtreamPass: event.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
              </>
            )}
          </div>

          {status !== "idle" && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${status === "testing" ? "bg-surface text-muted-foreground" : status === "success" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {status === "testing" && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === "success" && <Wifi className="w-4 h-4" />}
              {status === "error" && <WifiOff className="w-4 h-4" />}
              <span>
                {status === "testing" && "Testando conexão..."}
                {status === "success" && "Servidor acessível!"}
                {status === "error" && "Falha na conexão. Verifique os dados."}
              </span>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button onClick={testConnection} disabled={status === "testing"} className="flex-1 py-2.5 rounded-lg bg-surface text-sm font-medium text-foreground hover:bg-surface-hover transition-all border border-border disabled:opacity-50">
              Testar Conexão
            </button>
            <button onClick={saveAndSync} className="flex-1 py-2.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all">
              Salvar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={playlistDialogOpen} onOpenChange={setPlaylistDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Tipo de Playlist</DialogTitle>
            <DialogDescription className="text-muted-foreground">Escolha o formato da sua lista IPTV.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { value: "xtream" as const, label: "Xtream Codes", desc: "Login com URL, usuário e senha" },
              { value: "m3u" as const, label: "M3U / M3U8", desc: "URL direta da playlist" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  const nextConfig = { ...config, type: option.value };
                  setConfig(nextConfig);
                  localStorage.setItem("obsidian_server_config", JSON.stringify(nextConfig));
                  setPlaylistDialogOpen(false);
                  toast.success(`Tipo alterado para ${option.label}`);
                }}
                className={`w-full flex items-center gap-3 p-4 rounded-lg transition-all text-left ${config.type === option.value ? "bg-primary/15 border border-primary/30" : "bg-surface hover:bg-surface-hover border border-transparent"}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${config.type === option.value ? "border-primary" : "border-muted-foreground"}`}>
                  {config.type === option.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bufferDialogOpen} onOpenChange={setBufferDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Buffer de Vídeo</DialogTitle>
            <DialogDescription className="text-muted-foreground">Buffers maiores reduzem travamentos em conexões instáveis.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {["15", "30", "50", "90"].map((value) => (
              <button
                key={value}
                onClick={() => saveBuffer(value)}
                className={`w-full flex items-center gap-3 p-4 rounded-lg transition-all text-left ${bufferSize === value ? "bg-primary/15 border border-primary/30" : "bg-surface hover:bg-surface-hover border border-transparent"}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${bufferSize === value ? "border-primary" : "border-muted-foreground"}`}>
                  {bufferSize === value && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <p className="text-sm font-medium text-foreground">{value} segundos</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={decoderDialogOpen} onOpenChange={setDecoderDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Decodificador</DialogTitle>
            <DialogDescription className="text-muted-foreground">Hardware é mais rápido; Software suporta mais codecs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { value: "hardware", label: "Hardware (padrão)", desc: "Usa GPU para decodificação rápida" },
              { value: "software", label: "Software (FFmpeg)", desc: "Suporta codecs antigos e raros" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => saveDecoder(option.value)}
                className={`w-full flex items-center gap-3 p-4 rounded-lg transition-all text-left ${decoder === option.value ? "bg-primary/15 border border-primary/30" : "bg-surface hover:bg-surface-hover border border-transparent"}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${decoder === option.value ? "border-primary" : "border-muted-foreground"}`}>
                  {decoder === option.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsView;
