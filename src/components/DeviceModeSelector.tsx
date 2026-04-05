import { Smartphone, Tv } from "lucide-react";
import type { DeviceMode } from "@/lib/device-mode";

interface DeviceModeSelectorProps {
  onSelect: (mode: DeviceMode) => void;
}

const DeviceModeSelector = ({ onSelect }: DeviceModeSelectorProps) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-8 text-center">
        <div className="space-y-3">
          <img src="/favicon.png" alt="DARK IPTV" className="w-16 h-16 mx-auto rounded-2xl object-cover" />
          <h1 className="text-2xl font-bold text-foreground">DARK IPTV</h1>
          <p className="text-sm text-muted-foreground">Como você está assistindo?</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onSelect("mobile")}
            autoFocus
            className="flex flex-col items-center gap-4 p-6 sm:p-8 rounded-2xl bg-card border-2 border-border/30 hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all group"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-focus:bg-primary/20 transition-colors">
              <Smartphone className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Celular / Tablet</p>
              <p className="text-xs text-muted-foreground mt-1">Toque na tela</p>
            </div>
          </button>

          <button
            onClick={() => onSelect("tv")}
            className="flex flex-col items-center gap-4 p-6 sm:p-8 rounded-2xl bg-card border-2 border-border/30 hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all group"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-focus:bg-primary/20 transition-colors">
              <Tv className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">TV / TV Box</p>
              <p className="text-xs text-muted-foreground mt-1">Controle remoto</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceModeSelector;
