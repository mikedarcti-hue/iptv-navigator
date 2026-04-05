interface ExitDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const ExitDialog = ({ onConfirm, onCancel }: ExitDialogProps) => {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-6 max-w-sm w-full space-y-5 border border-border/50 card-shadow text-center">
        <h2 className="text-lg font-bold text-foreground">Deseja sair do app?</h2>
        <div className="flex gap-3 justify-center">
          <button
            autoFocus
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          >
            Não
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExitDialog;
