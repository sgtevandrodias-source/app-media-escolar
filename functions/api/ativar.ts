type Env = {
  DB: any;
};

const CHAVE_PUBLICA_ILIMITADA = "MEDIA-CMB-LIVRE";

function respostaJson(dados: unknown, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}) => {
  const { request, env } = context;

  try {
    const corpo = (await request.json()) as {
      chave?: string;
      deviceId?: string;
    };

    const chave = String(corpo.chave ?? "").trim().toUpperCase();
    const deviceId = String(corpo.deviceId ?? "").trim();

    if (!chave || !deviceId) {
      return respostaJson(
        {
          ok: false,
          mensagem: "Informe a chave e o identificador do dispositivo.",
        },
        400,
      );
    }

    // Chave pública: libera qualquer quantidade de dispositivos e não grava
    // device_1/device_2 no banco.
    if (chave === CHAVE_PUBLICA_ILIMITADA) {
      return respostaJson({
        ok: true,
        mensagem: "Acesso público liberado neste dispositivo.",
        chave: CHAVE_PUBLICA_ILIMITADA,
        ilimitada: true,
      });
    }

    if (!env.DB) {
      return respostaJson(
        {
          ok: false,
          mensagem: "Banco de licenças não configurado.",
        },
        500,
      );
    }

 type LicencaBanco = {
  id: number;
  chave: string;
  status: string;
  device_1: string | null;
  device_2: string | null;
  ativada_1_em: string | null;
  ativada_2_em: string | null;
};

const licenca = (await env.DB
  .prepare(
    "SELECT id, chave, status, device_1, device_2, ativada_1_em, ativada_2_em FROM licencas WHERE chave = ?",
  )
  .bind(chave)
  .first()) as LicencaBanco | null;

    if (!licenca) {
      return respostaJson(
        {
          ok: false,
          mensagem: "Chave não encontrada.",
        },
        404,
      );
    }

    if (licenca.status !== "ativa") {
      return respostaJson(
        {
          ok: false,
          mensagem: "Esta chave está bloqueada ou inativa.",
        },
        403,
      );
    }

    if (licenca.device_1 === deviceId || licenca.device_2 === deviceId) {
      return respostaJson({
        ok: true,
        mensagem: "Licença já ativada neste dispositivo.",
        chave,
      });
    }

    const agora = new Date().toISOString();

    if (!licenca.device_1) {
      await env.DB
        .prepare(
          "UPDATE licencas SET device_1 = ?, ativada_1_em = ? WHERE chave = ?",
        )
        .bind(deviceId, agora, chave)
        .run();

      return respostaJson({
        ok: true,
        mensagem: "Licença ativada com sucesso neste dispositivo.",
        chave,
      });
    }

    if (!licenca.device_2) {
      await env.DB
        .prepare(
          "UPDATE licencas SET device_2 = ?, ativada_2_em = ? WHERE chave = ?",
        )
        .bind(deviceId, agora, chave)
        .run();

      return respostaJson({
        ok: true,
        mensagem: "Licença ativada com sucesso neste segundo dispositivo.",
        chave,
      });
    }

    return respostaJson(
      {
        ok: false,
        mensagem: "Esta chave já foi ativada em 2 dispositivos.",
      },
      403,
    );
  } catch (erro) {
    return respostaJson(
      {
        ok: false,
        mensagem: "Erro interno ao validar a licença.",
        detalhe: erro instanceof Error ? erro.message : String(erro),
      },
      500,
    );
  }
};
