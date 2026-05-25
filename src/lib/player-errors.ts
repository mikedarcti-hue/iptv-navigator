// Centraliza a classificação de erros do player para mensagens mais úteis.
// Usado pelo PlayerView quando uma reprodução falha — diferencia rede, codec,
// CORS, timeout e bloqueio de origem em vez de mostrar sempre o mesmo texto.

export type PlayerErrorContext = {
  isLive: boolean;
  isVod: boolean;
  proxyAttempted: boolean;
  url?: string;
};

export type ClassifiedError = {
  message: string;
  hint?: string;
};

/**
 * Recebe o MediaError do elemento <video> (quando existir) e o contexto da
 * tentativa atual, e devolve uma mensagem amigável para o usuário.
 */
export function classifyPlayerError(
  mediaError: MediaError | null | undefined,
  ctx: PlayerErrorContext,
): ClassifiedError {
  const code = mediaError?.code;
  const url = (ctx.url ?? "").toLowerCase();

  // Codecs comuns não suportados em Chromecast antigo, alguns TV Box e WebView
  const looksHevc = /h265|hevc|x265/.test(url);
  const looksMkv = /\.mkv(\?|$)/.test(url);

  switch (code) {
    case 1 /* MEDIA_ERR_ABORTED */:
      return { message: "Reprodução interrompida" };

    case 2 /* MEDIA_ERR_NETWORK */:
      return {
        message: ctx.proxyAttempted
          ? "Falha de rede ao carregar o conteúdo"
          : "Falha de rede — tentando rota alternativa…",
        hint: "Verifique a conexão com a internet.",
      };

    case 3 /* MEDIA_ERR_DECODE */:
      return {
        message: looksHevc
          ? "Codec HEVC/H.265 não suportado neste dispositivo"
          : looksMkv
            ? "Formato MKV pode não ser suportado neste dispositivo"
            : "Erro ao decodificar o vídeo",
      };

    case 4 /* MEDIA_ERR_SRC_NOT_SUPPORTED */:
      return ctx.isLive
        ? {
            message: "Este canal não está disponível no momento",
            hint: "Tente outro canal ou volte mais tarde.",
          }
        : {
            message: "Conteúdo indisponível ou em formato não suportado",
            hint: looksMkv ? "Arquivos MKV podem falhar em alguns dispositivos." : undefined,
          };

    default:
      // Sem MediaError útil (ex.: hls.js já destruído) — diferencia pelo contexto
      if (ctx.proxyAttempted) {
        return {
          message: ctx.isLive
            ? "Canal indisponível — todas as rotas falharam"
            : "Conteúdo indisponível — todas as rotas falharam",
        };
      }
      return {
        message: ctx.isLive
          ? "Falha ao abrir o canal — tentando rota alternativa…"
          : "Falha ao abrir o conteúdo — tentando rota alternativa…",
      };
  }
}
