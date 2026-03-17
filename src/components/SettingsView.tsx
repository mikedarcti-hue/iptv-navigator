import { Globe, Database, Shield, Info, ChevronRight } from "lucide-react";

const settingsGroups = [
  {
    title: "Conexão",
    items: [
      { icon: Globe, label: "URL do Servidor", value: "Não configurado", action: true },
      { icon: Database, label: "Tipo de Playlist", value: "M3U / Xtream", action: true },
    ],
  },
  {
    title: "Player",
    items: [
      { icon: Shield, label: "Buffer de Vídeo", value: "50 segundos", action: true },
      { icon: Info, label: "Decodificador", value: "Hardware (padrão)", action: true },
    ],
  },
  {
    title: "Sobre",
    items: [
      { icon: Info, label: "Versão", value: "1.0.0", action: false },
      { icon: Shield, label: "Licença", value: "Premium", action: false },
    ],
  },
];

const SettingsView = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua conexão e preferências</p>
      </div>

      {settingsGroups.map((group) => (
        <section key={group.title}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            {group.title}
          </h3>
          <div className="glass-surface rounded-xl overflow-hidden card-shadow divide-y divide-border/50">
            {group.items.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-4 p-4 hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.value}</p>
                </div>
                {item.action && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default SettingsView;
