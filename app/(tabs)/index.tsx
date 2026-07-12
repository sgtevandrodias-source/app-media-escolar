import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

type Trimestre = "t1" | "t2" | "t3";
type SerieEscolar = "6EF" | "7EF" | "8EF" | "9EF" | "1EM" | "2EM" | "3EM";
type ModoFormulario = "novo" | "editar" | null;
type AbaApp = "inicio" | "alunos" | "notas" | "planejamento" | "perfil";
type FerramentaPlanejamento = "ae" | "simulador";
type VisualizacaoNotas = "visao" | "lancamento";

type NotasTrimestre = {
  ap1: string;
  ap2: string;
  gip: string;
  ae: string;
  ar: string;
};

type Disciplina = {
  nome: string;
  usaAE: boolean;
  trimestres: Record<Trimestre, NotasTrimestre>;
};

type DadosAnoLetivo = {
  serie: SerieEscolar;
  turma: string;
  disciplinas: Disciplina[];
};

type Filho = {
  id: string;
  nome: string;
  serie: SerieEscolar;
  turma: string;
  fotoUri?: string;
  disciplinas: Disciplina[];
  anoLetivoAtivo?: string;
  anosLetivos?: Record<string, DadosAnoLetivo>;
};

type DadosSalvos = {
  filhos: Filho[];
  atualizadoEm?: string;
};
type DisciplinaBase = { nome: string; usaAE: boolean };

type SerieConfig = {
  id: SerieEscolar;
  rotulo: string;
  turmaInicial: number;
  turmaFinal: number;
  nivel: "Ensino Fundamental" | "Ensino Médio";
};

type Classificacao = {
  titulo: string;
  mensagem: string;
  corFundo: string;
  corBorda: string;
  corTexto: string;
  corAvatar: string;
};

type LicencaLocal = {
  ativa: boolean;
  chave: string;
  deviceId: string;
  ativadaEm: string;
  ultimaValidacaoEm?: string;
};
type BackupMediaCMB = {
  app: "MEDIA_CMB";
  versaoBackup: number;
  exportadoEm: string;
  filhos: Filho[];
};

const CHAVE_STORAGE = "media-escolar-dados";
const CHAVE_DEVICE_ID = "media-cmb-device-id";
const CHAVE_LICENCA_LOCAL = "media-cmb-licenca-local";
const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://mediacmb.pages.dev"
).replace(/\/+$/, "");
const API_ATIVAR_LICENCA = `${API_BASE_URL}/api/ativar`;
const TEMPO_LIMITE_API_MS = 15000;
const VERSAO_BACKUP_ATUAL = 1;
const TAMANHO_MAXIMO_BACKUP_BYTES = 10 * 1024 * 1024;
const TAMANHO_MAXIMO_FOTO_BYTES = 350 * 1024;

const ANO_LETIVO_PADRAO = String(new Date().getFullYear());

const SERIES: SerieConfig[] = [
  {
    id: "6EF",
    rotulo: "6º Ano EF",
    turmaInicial: 601,
    turmaFinal: 620,
    nivel: "Ensino Fundamental",
  },
  {
    id: "7EF",
    rotulo: "7º Ano EF",
    turmaInicial: 701,
    turmaFinal: 720,
    nivel: "Ensino Fundamental",
  },
  {
    id: "8EF",
    rotulo: "8º Ano EF",
    turmaInicial: 801,
    turmaFinal: 820,
    nivel: "Ensino Fundamental",
  },
  {
    id: "9EF",
    rotulo: "9º Ano EF",
    turmaInicial: 901,
    turmaFinal: 920,
    nivel: "Ensino Fundamental",
  },
  {
    id: "1EM",
    rotulo: "1º Ano EM",
    turmaInicial: 101,
    turmaFinal: 120,
    nivel: "Ensino Médio",
  },
  {
    id: "2EM",
    rotulo: "2º Ano EM",
    turmaInicial: 201,
    turmaFinal: 220,
    nivel: "Ensino Médio",
  },
  {
    id: "3EM",
    rotulo: "3º Ano EM",
    turmaInicial: 301,
    turmaFinal: 320,
    nivel: "Ensino Médio",
  },
];

const DISCIPLINAS_EF: DisciplinaBase[] = [
  { nome: "Arte I", usaAE: false },
  { nome: "Ciências Naturais", usaAE: true },
  { nome: "Educação Física", usaAE: false },
  { nome: "Geografia", usaAE: true },
  { nome: "História", usaAE: true },
  { nome: "LEM - Inglês", usaAE: true },
  { nome: "Língua Portuguesa", usaAE: true },
  { nome: "Matemática", usaAE: true },
];

const DISCIPLINAS_EM: DisciplinaBase[] = [
  { nome: "Arte II", usaAE: true },
  { nome: "Biologia", usaAE: true },
  { nome: "Educação Física", usaAE: false },
  { nome: "Filosofia", usaAE: true },
  { nome: "Física", usaAE: true },
  { nome: "Geografia", usaAE: true },
  { nome: "História", usaAE: true },
  { nome: "LEM - Inglês", usaAE: true },
  { nome: "Língua Portuguesa", usaAE: true },
  { nome: "Matemática", usaAE: true },
  { nome: "Projeto de Vida", usaAE: true },
  { nome: "Química", usaAE: true },
  { nome: "Redação", usaAE: true },
  { nome: "Sociologia", usaAE: true },
];

function criarTrimestre(): NotasTrimestre {
  return { ap1: "", ap2: "", gip: "", ae: "", ar: "" };
}

function obterConfigSerie(serie: SerieEscolar) {
  return SERIES.find((item) => item.id === serie) ?? SERIES[1];
}

function obterRotuloSerie(serie: SerieEscolar) {
  return obterConfigSerie(serie).rotulo;
}

function obterDisciplinasBasePorSerie(serie: SerieEscolar) {
  return obterConfigSerie(serie).nivel === "Ensino Médio"
    ? DISCIPLINAS_EM
    : DISCIPLINAS_EF;
}

function criarDisciplinasPorSerie(serie: SerieEscolar): Disciplina[] {
  return obterDisciplinasBasePorSerie(serie).map((disciplina) => ({
    nome: disciplina.nome,
    usaAE: disciplina.usaAE,
    trimestres: {
      t1: criarTrimestre(),
      t2: criarTrimestre(),
      t3: criarTrimestre(),
    },
  }));
}

function gerarTurmas(serie: SerieEscolar) {
  const config = obterConfigSerie(serie);
  const turmas: string[] = [];

  for (
    let numero = config.turmaInicial;
    numero <= config.turmaFinal;
    numero++
  ) {
    turmas.push(String(numero));
  }

  return turmas;
}

function turmaPadrao(serie: SerieEscolar) {
  return String(obterConfigSerie(serie).turmaInicial);
}

function gerarIdAluno() {
  const momento = Date.now().toString(36);
  const aleatorio = Math.random().toString(36).slice(2, 10);
  return `ALUNO-${momento}-${aleatorio}`;
}

function criarFilho(
  nome = "Aluno 1",
  serie: SerieEscolar = "7EF",
  turma = turmaPadrao("7EF"),
): Filho {
  const disciplinas = criarDisciplinasPorSerie(serie);

  return {
    id: gerarIdAluno(),
    nome,
    serie,
    turma,
    fotoUri: "",
    disciplinas,
    anoLetivoAtivo: ANO_LETIVO_PADRAO,
    anosLetivos: {
      [ANO_LETIVO_PADRAO]: {
        serie,
        turma,
        disciplinas,
      },
    },
  };
}

function migrarSerieAntiga(serie: unknown): SerieEscolar {
  if (serie === "6" || serie === "6EF") return "6EF";
  if (serie === "7" || serie === "7EF") return "7EF";
  if (serie === "8" || serie === "8EF") return "8EF";
  if (serie === "9" || serie === "9EF") return "9EF";
  if (serie === "1" || serie === "1EM") return "1EM";
  if (serie === "2" || serie === "2EM") return "2EM";
  if (serie === "3" || serie === "3EM") return "3EM";
  return "7EF";
}

function normalizarEntradaNota(valor: string): string {
  const original = String(valor ?? "");
  if (!original.trim()) return "";

  const usaVirgula = original.includes(",");
  const separadorSaida = usaVirgula ? "," : ".";

  let limpo = original.replace(",", ".").replace(/[^0-9.]/g, "");

  const primeiroPonto = limpo.indexOf(".");
  if (primeiroPonto >= 0) {
    limpo =
      limpo.slice(0, primeiroPonto + 1) +
      limpo.slice(primeiroPonto + 1).replace(/\./g, "");
  }

  const possuiDecimal = limpo.includes(".");
  let [parteInteira = "", parteDecimal = ""] = limpo.split(".");

  if (parteInteira === "" && possuiDecimal) {
    parteInteira = "0";
  }

  parteInteira = parteInteira.replace(/^0+(?=\d)/, "");

  const numeroInteiro = Number(parteInteira || "0");

  if (numeroInteiro > 10) {
    return "10";
  }

  parteDecimal = parteDecimal.slice(0, 2);

  if (numeroInteiro === 10) {
    return "10";
  }

  if (possuiDecimal) {
    return `${parteInteira || "0"}${separadorSaida}${parteDecimal}`;
  }

  return parteInteira;
}

function normalizarTrimestre(valor: any): NotasTrimestre {
  return {
    ap1: normalizarEntradaNota(String(valor?.ap1 ?? "")),
    ap2: normalizarEntradaNota(String(valor?.ap2 ?? "")),
    gip: normalizarEntradaNota(String(valor?.gip ?? "")),
    ae: normalizarEntradaNota(String(valor?.ae ?? "")),
    ar: normalizarEntradaNota(String(valor?.ar ?? "")),
  };
}

function normalizarDisciplinas(
  serie: SerieEscolar,
  disciplinasSalvas: any,
): Disciplina[] {
  const bases = obterDisciplinasBasePorSerie(serie);
  const salvas = Array.isArray(disciplinasSalvas) ? disciplinasSalvas : [];

  return bases.map((base) => {
    const salva = salvas.find((item) => item?.nome === base.nome);
    return {
      nome: base.nome,
      usaAE: base.usaAE,
      trimestres: {
        t1: normalizarTrimestre(salva?.trimestres?.t1),
        t2: normalizarTrimestre(salva?.trimestres?.t2),
        t3: normalizarTrimestre(salva?.trimestres?.t3),
      },
    };
  });
}
function normalizarAnoLetivo(
  valor: any,
  serieFallback: SerieEscolar,
  turmaFallback: string,
  disciplinasFallback: any,
): DadosAnoLetivo {
  const serie = migrarSerieAntiga(valor?.serie ?? serieFallback);
  const turmas = gerarTurmas(serie);
  const turma = turmas.includes(String(valor?.turma ?? turmaFallback))
    ? String(valor?.turma ?? turmaFallback)
    : turmaPadrao(serie);

  return {
    serie,
    turma,
    disciplinas: normalizarDisciplinas(
      serie,
      valor?.disciplinas ?? disciplinasFallback,
    ),
  };
}

function obterDadosAnoLetivo(filho: Filho, anoLetivo: string): DadosAnoLetivo {
  const dadosAno = filho.anosLetivos?.[anoLetivo];

  if (dadosAno) {
    return dadosAno;
  }

  return {
    serie: filho.serie,
    turma: filho.turma,
    disciplinas: criarDisciplinasPorSerie(filho.serie),
  };
}
function normalizarFilho(valor: any, indice: number): Filho {
  const serie = migrarSerieAntiga(valor?.serie);
  const turmas = gerarTurmas(serie);
  const turma = turmas.includes(String(valor?.turma))
    ? String(valor?.turma)
    : turmaPadrao(serie);
  const disciplinas = normalizarDisciplinas(serie, valor?.disciplinas);

  const anosLetivosOriginais =
    valor?.anosLetivos && typeof valor.anosLetivos === "object"
      ? valor.anosLetivos
      : {};
  const anosLetivosNormalizados: Record<string, DadosAnoLetivo> = {};

  Object.keys(anosLetivosOriginais).forEach((ano) => {
    anosLetivosNormalizados[ano] = normalizarAnoLetivo(
      anosLetivosOriginais[ano],
      serie,
      turma,
      disciplinas,
    );
  });

  if (!anosLetivosNormalizados[ANO_LETIVO_PADRAO]) {
    anosLetivosNormalizados[ANO_LETIVO_PADRAO] = {
      serie,
      turma,
      disciplinas,
    };
  }

  const anoLetivoSolicitado = String(
    valor?.anoLetivoAtivo ?? ANO_LETIVO_PADRAO,
  );
  const anoLetivoAtivo = anosLetivosNormalizados[anoLetivoSolicitado]
    ? anoLetivoSolicitado
    : ANO_LETIVO_PADRAO;
  const dadosAnoAtivo = anosLetivosNormalizados[anoLetivoAtivo];

  return {
    id: String(valor?.id ?? `${Date.now()}-${indice}`),
    nome: String(valor?.nome ?? `Aluno ${indice + 1}`),
    serie: dadosAnoAtivo.serie,
    turma: dadosAnoAtivo.turma,
    fotoUri: String(valor?.fotoUri ?? ""),
    disciplinas: dadosAnoAtivo.disciplinas,
    anoLetivoAtivo,
    anosLetivos: anosLetivosNormalizados,
  };
}
function textoParaNumero(valor: string): number | null {
  if (!valor.trim()) return null;
  const numero = Number(valor.replace(",", "."));
  if (Number.isNaN(numero)) return null;
  return numero;
}

function limitarNota(nota: number): number {
  if (nota > 10) return 10;
  if (nota < 0) return 0;
  return nota;
}

function arredondar(nota: number): number {
  return Math.round((nota + Number.EPSILON) * 10) / 10;
}

function tituloTrimestre(trimestre: Trimestre) {
  if (trimestre === "t1") return "1º Trimestre";
  if (trimestre === "t2") return "2º Trimestre";
  return "3º Trimestre";
}

function prefixoAP(trimestre: Trimestre) {
  if (trimestre === "t1") return "AP1";
  if (trimestre === "t2") return "AP2";
  return "AP3";
}

function calcularMediaAP(trimestre: NotasTrimestre): number | null {
  const notasAP = [
    textoParaNumero(trimestre.ap1),
    textoParaNumero(trimestre.ap2),
  ];
  const notasValidas = notasAP.filter((nota): nota is number => nota !== null);
  if (notasValidas.length === 0) return null;
  const soma = notasValidas.reduce((total, nota) => total + nota, 0);
  return arredondar(soma / notasValidas.length);
}

function calcularNP(
  disciplina: Disciplina,
  trimestre: NotasTrimestre,
): number | null {
  const mediaAP = calcularMediaAP(trimestre);
  const gip = textoParaNumero(trimestre.gip) ?? 0;
  if (mediaAP === null) return null;

  const apMaisGip = limitarNota(mediaAP + gip);

  if (!disciplina.usaAE) return arredondar(apMaisGip);

  const ae = textoParaNumero(trimestre.ae);
  if (ae === null) return null;

  return arredondar(0.4 * apMaisGip + 0.6 * ae);
}

function calcularNPR(
  disciplina: Disciplina,
  trimestre: NotasTrimestre,
): number | null {
  const np = calcularNP(disciplina, trimestre);
  const ar = textoParaNumero(trimestre.ar);
  if (np === null || ar === null) return null;
  return arredondar((ar + np) / 2);
}

function calcularNotaConsiderada(
  disciplina: Disciplina,
  trimestre: NotasTrimestre,
): number | null {
  const np = calcularNP(disciplina, trimestre);
  const npr = calcularNPR(disciplina, trimestre);
  if (np === null && npr === null) return null;
  if (np !== null && npr === null) return np;
  if (np === null && npr !== null) return npr;
  return Math.max(np as number, npr as number);
}

function calcularMediaFinalParcial(disciplina: Disciplina): number | null {
  const notas = [
    calcularNotaConsiderada(disciplina, disciplina.trimestres.t1),
    calcularNotaConsiderada(disciplina, disciplina.trimestres.t2),
    calcularNotaConsiderada(disciplina, disciplina.trimestres.t3),
  ].filter((nota): nota is number => nota !== null);

  if (notas.length === 0) return null;
  const soma = notas.reduce((total, nota) => total + nota, 0);
  return arredondar(soma / notas.length);
}

function calcularNecessidadeFinal(disciplina: Disciplina, mediaMinima: number) {
  const notas = [
    calcularNotaConsiderada(disciplina, disciplina.trimestres.t1),
    calcularNotaConsiderada(disciplina, disciplina.trimestres.t2),
    calcularNotaConsiderada(disciplina, disciplina.trimestres.t3),
  ].filter((nota): nota is number => nota !== null);

  if (notas.length === 0)
    return "Lance pelo menos uma nota periódica para calcular.";

  const totalNecessario = mediaMinima * 3;
  const somaAtual = notas.reduce((total, nota) => total + nota, 0);
  const faltamTrimestres = 3 - notas.length;
  const falta = totalNecessario - somaAtual;

  if (falta <= 0) return "Já atingiu a média mínima, mantendo os dados atuais.";
  if (faltamTrimestres === 0) return "Não atingiu a média mínima.";

  const precisaPorTrimestre = falta / faltamTrimestres;
  if (precisaPorTrimestre > 10)
    return "Precisaria de mais de 10 nos trimestres restantes.";

  return `Para fechar o ano com média ${mediaMinima.toFixed(1).replace(".", ",")}: precisa de ${precisaPorTrimestre.toFixed(1)} em cada trimestre restante.`;
}

function calcularAENecessaria(
  disciplina: Disciplina,
  trimestre: NotasTrimestre,
  npDesejada: number,
) {
  if (!disciplina.usaAE)
    return "Esta disciplina não usa AE. Para melhorar a NP, foque nas APs e no GIP.";

  const mediaAP = calcularMediaAP(trimestre);
  const gip = textoParaNumero(trimestre.gip) ?? 0;
  if (mediaAP === null) return "Informe as APs para calcular a AE necessária.";

  const apMaisGip = limitarNota(mediaAP + gip);
  const aeNecessaria = (npDesejada - 0.4 * apMaisGip) / 0.6;

  if (aeNecessaria <= 0) return "As APs + GIP já garantem essa NP.";
  if (aeNecessaria > 10) return "Impossível atingir essa NP apenas com a AE.";

  return `Precisa tirar ${aeNecessaria.toFixed(1)} na AE.`;
}

function obterClassificacao(media: number | null): Classificacao {
  if (media === null) {
    return {
      titulo: "Sem dados",
      mensagem: "Sem média lançada",
      corFundo: "#f1f5f9",
      corBorda: "#cbd5e1",
      corTexto: "#475569",
      corAvatar: "#64748b",
    };
  }

  if (media < 6) {
    return {
      titulo: "Atenção",
      mensagem: "Você precisa estudar",
      corFundo: "#fef2f2",
      corBorda: "#fecaca",
      corTexto: "#b91c1c",
      corAvatar: "#dc2626",
    };
  }

  if (media < 8) {
    return {
      titulo: "Bom",
      mensagem: "Você pode melhorar",
      corFundo: "#fffbeb",
      corBorda: "#fde68a",
      corTexto: "#92400e",
      corAvatar: "#d97706",
    };
  }

  if (media < 9) {
    return {
      titulo: "Muito bom",
      mensagem: "Continue assim",
      corFundo: "#eff6ff",
      corBorda: "#bfdbfe",
      corTexto: "#1d4ed8",
      corAvatar: "#2563eb",
    };
  }

  return {
    titulo: "Excelente",
    mensagem: "Parabéns",
    corFundo: "#ecfdf5",
    corBorda: "#bbf7d0",
    corTexto: "#166534",
    corAvatar: "#16a34a",
  };
}

function mostrarNota(nota: number | null) {
  if (nota === null) return "Pendente";
  return nota.toFixed(1);
}

function escaparHtml(valor: unknown) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatarValorBoletim(valor: string) {
  const numero = textoParaNumero(valor);
  return numero === null ? "—" : numero.toFixed(1);
}

function obterSiglaDisciplina(nome: string) {
  const siglas: Record<string, string> = {
    "Arte I": "ART",
    "Arte II": "ART",
    Biologia: "BIO",
    "Ciências Naturais": "CN",
    "Educação Física": "EF",
    Filosofia: "FIL",
    Física: "FIS",
    Geografia: "GEO",
    História: "HIST",
    "LEM - Inglês": "ING",
    "Língua Portuguesa": "POR",
    Matemática: "MAT",
    "Projeto de Vida": "PV",
    Química: "QUI",
    Redação: "RED",
    Sociologia: "SOC",
  };

  return siglas[nome] ?? nome;
}

function calcularMediaGeralAluno(filho: Filho): number | null {
  const mediasDisciplinas = filho.disciplinas
    .map((disciplina) => calcularMediaFinalParcial(disciplina))
    .filter((media): media is number => media !== null);

  if (mediasDisciplinas.length === 0) return null;

  const soma = mediasDisciplinas.reduce((total, media) => total + media, 0);
  return arredondar(soma / mediasDisciplinas.length);
}

function obterIniciais(nome: string) {
  const partes = nome.trim().split(" ").filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function calcularResumoDisciplinas(filho: Filho) {
  return filho.disciplinas.map((disciplina) => {
    const media = calcularMediaFinalParcial(disciplina);
    const classificacao = obterClassificacao(media);
    return {
      nome: disciplina.nome,
      sigla: obterSiglaDisciplina(disciplina.nome),
      media,
      classificacao,
    };
  });
}

function gerarDeviceId() {
  const aleatorio = Math.random().toString(36).slice(2, 12).toUpperCase();
  const momento = Date.now().toString(36).toUpperCase();
  return `MEDIA-CMB-${momento}-${aleatorio}`;
}

function normalizarChave(valor: string) {
  return valor.trim().toUpperCase().replace(/\s+/g, "");
}

function ocultarChaveLicenca(chave: string) {
  const chaveNormalizada = normalizarChave(chave);
  if (!chaveNormalizada) return "Não informada";
  if (chaveNormalizada.length <= 8)
    return `${chaveNormalizada.slice(0, 2)}••••`;
  return `${chaveNormalizada.slice(0, 4)}••••${chaveNormalizada.slice(-4)}`;
}

function formatarDataHora(valor?: string) {
  if (!valor) return "Não registrada";

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Não registrada";

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function obterNomePlataforma() {
  if (Platform.OS === "web") return "Navegador / PWA";
  if (Platform.OS === "android") return "Android";
  if (Platform.OS === "ios") return "iPhone / iPad";
  return Platform.OS;
}

function mensagemErroAtivacao(status: number, resultado: any) {
  const mensagemServidor = String(resultado?.mensagem ?? "").trim();
  if (mensagemServidor) return mensagemServidor;

  if (status === 400) return "Confira a chave informada e tente novamente.";
  if (status === 401 || status === 403)
    return "Esta chave não está autorizada.";
  if (status === 404)
    return "Serviço de ativação não encontrado. Atualize o app e tente novamente.";
  if (status === 409)
    return "Esta chave atingiu o limite de dispositivos autorizados.";
  if (status === 429)
    return "Muitas tentativas em sequência. Aguarde um pouco e tente novamente.";
  if (status >= 500)
    return "O servidor de licenças está temporariamente indisponível.";

  return "Não foi possível ativar esta chave.";
}
function gerarNomeArquivoBackup() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");

  return `media-cmb-backup-${ano}-${mes}-${dia}-${hora}${minuto}.json`;
}
function normalizarTextoBusca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function estimarTamanhoTextoBytes(valor: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(valor).length;
  }

  return Math.ceil(valor.length * 1.5);
}

function validarFotoCompactada(fotoUri: string) {
  const tamanhoEstimado = estimarTamanhoTextoBytes(fotoUri);

  if (tamanhoEstimado > TAMANHO_MAXIMO_FOTO_BYTES) {
    throw new Error(
      "A foto ainda ficou muito grande após a compactação. Escolha uma imagem menor.",
    );
  }

  return fotoUri;
}

function possuiNotasLancadas(disciplinas: Disciplina[]) {
  return disciplinas.some((disciplina) =>
    (["t1", "t2", "t3"] as Trimestre[]).some((trimestre) => {
      const notas = disciplina.trimestres[trimestre];
      return [notas.ap1, notas.ap2, notas.gip, notas.ae, notas.ar].some(
        (valor) => String(valor ?? "").trim() !== "",
      );
    }),
  );
}

function confirmarAcao(titulo: string, mensagem: string): Promise<boolean> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return Promise.resolve(window.confirm(`${titulo}\n\n${mensagem}`));
  }

  return new Promise((resolve) => {
    Alert.alert(
      titulo,
      mensagem,
      [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function carregarScriptExterno(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Documento indisponível para carregar o gerador de PDF."));
      return;
    }

    const existente = document.getElementById(id) as HTMLScriptElement | null;
    if (existente?.dataset.carregado === "true") {
      resolve();
      return;
    }

    if (existente) {
      existente.addEventListener("load", () => resolve(), { once: true });
      existente.addEventListener(
        "error",
        () => reject(new Error(`Falha ao carregar ${id}.`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.carregado = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Falha ao carregar ${id}.`));
    document.head.appendChild(script);
  });
}

async function carregarBibliotecasPdf() {
  await carregarScriptExterno(
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
    "media-cmb-jspdf",
  );

  await carregarScriptExterno(
    "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js",
    "media-cmb-jspdf-autotable",
  );

  const janelaPdf = window as typeof window & {
    jspdf?: { jsPDF?: new (opcoes?: any) => any };
  };

  const jsPDF = janelaPdf.jspdf?.jsPDF;
  if (!jsPDF) {
    throw new Error("O gerador de PDF não foi carregado corretamente.");
  }

  return jsPDF;
}

export default function HomeScreen() {
  const [filhos, setFilhos] = useState<Filho[]>([
    criarFilho("Aluno 1", "7EF", turmaPadrao("7EF")),
  ]);
  const [pesquisaAluno, setPesquisaAluno] = useState("");
  const [filhoSelecionado, setFilhoSelecionado] = useState(0);
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState(0);
  const [trimestreSelecionado, setTrimestreSelecionado] =
    useState<Trimestre>("t1");
  const [npDesejada, setNpDesejada] = useState("8.0");
  const [disciplinaSimulador, setDisciplinaSimulador] = useState(0);
  const [trimestreSimulador, setTrimestreSimulador] = useState<Trimestre>("t1");
  const [notasSimuladas, setNotasSimuladas] =
    useState<NotasTrimestre>(criarTrimestre());
  const [mediaDesejadaSimulador, setMediaDesejadaSimulador] = useState("6.0");
  const [ferramentaPlanejamento, setFerramentaPlanejamento] =
    useState<FerramentaPlanejamento>("ae");
  const [visualizacaoNotas, setVisualizacaoNotas] =
    useState<VisualizacaoNotas>("visao");
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null);
  const [nomeFormulario, setNomeFormulario] = useState("");
  const [serieFormulario, setSerieFormulario] = useState<SerieEscolar>("7EF");
  const [turmaFormulario, setTurmaFormulario] = useState(turmaPadrao("7EF"));
  const [mensagem, setMensagem] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<AbaApp>("inicio");
  const [anoLetivoSelecionado, setAnoLetivoSelecionado] =
    useState(ANO_LETIVO_PADRAO);
  const [mostrarSeletorAno, setMostrarSeletorAno] = useState(false);
  const [modoNovoAno, setModoNovoAno] = useState(false);
  const [editandoAnoExistente, setEditandoAnoExistente] = useState(false);
  const [anoNovoFormulario, setAnoNovoFormulario] = useState(
    String(Number(ANO_LETIVO_PADRAO) + 1),
  );
  const [serieAnoFormulario, setSerieAnoFormulario] =
    useState<SerieEscolar>("7EF");
  const [turmaAnoFormulario, setTurmaAnoFormulario] = useState(
    turmaPadrao("7EF"),
  );
  const [licencaCarregada, setLicencaCarregada] = useState(false);
  const [licencaAtiva, setLicencaAtiva] = useState(false);
  const [dadosLicencaLocal, setDadosLicencaLocal] =
    useState<LicencaLocal | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [chaveAtivacao, setChaveAtivacao] = useState("");
  const [mensagemLicenca, setMensagemLicenca] = useState("");
  const [validandoLicenca, setValidandoLicenca] = useState(false);
  const [mostrarCompraPix, setMostrarCompraPix] = useState(false);
  const [nomeComprador, setNomeComprador] = useState("");
  const [emailComprador, setEmailComprador] = useState("");
  const [whatsappComprador, setWhatsappComprador] = useState("");
  const [statusCompraPix, setStatusCompraPix] = useState<
    "inicio" | "preparando" | "aguardando" | "confirmado"
  >("inicio");
  const [pixCopiaCola, setPixCopiaCola] = useState("");
  const { width: larguraTela } = useWindowDimensions();
  const larguraConteudo = Math.min(Math.max(larguraTela - 40, 280), 720);
  const larguraSlideAluno = Math.min(Math.max(larguraTela - 40, 280), 520);
  const larguraInternaConteudo = Math.max(larguraConteudo - 40, 240);
  const larguraCardVisaoNotas = Math.max((larguraInternaConteudo - 16) / 3, 76);
  const larguraCardAlunoInicio = Math.min(
    Math.max(larguraTela - 72, 260),
    500,
  );
  const margemMenuInferior = Math.max(
    (larguraTela - Math.min(larguraTela - 32, 720)) / 2,
    16,
  );

  useEffect(() => {
    async function carregarLicenca() {
      try {
        let idDispositivo = await AsyncStorage.getItem(CHAVE_DEVICE_ID);

        if (!idDispositivo) {
          idDispositivo = gerarDeviceId();
          await AsyncStorage.setItem(CHAVE_DEVICE_ID, idDispositivo);
        }

        setDeviceId(idDispositivo);

        const licencaSalva = await AsyncStorage.getItem(CHAVE_LICENCA_LOCAL);

        if (licencaSalva) {
          const dadosLicenca = JSON.parse(licencaSalva) as LicencaLocal;

          if (dadosLicenca?.ativa && dadosLicenca?.deviceId === idDispositivo) {
            setLicencaAtiva(true);
            setDadosLicencaLocal(dadosLicenca);
            setChaveAtivacao(dadosLicenca.chave ?? "");
          }
        }
      } catch (erro) {
        console.log("Erro ao carregar licença:", erro);
      } finally {
        setLicencaCarregada(true);
      }
    }

    carregarLicenca();
  }, []);

  useEffect(() => {
    async function carregarDados() {
      try {
        const dadosAsync = await AsyncStorage.getItem(CHAVE_STORAGE);

        const dadosWeb =
          Platform.OS === "web" && typeof window !== "undefined"
            ? window.localStorage.getItem(CHAVE_STORAGE)
            : null;

        function obterAtualizadoEm(conteudo: string | null) {
          try {
            if (!conteudo) return "";
            const dados = JSON.parse(conteudo);
            return String(dados?.atualizadoEm ?? "");
          } catch {
            return "";
          }
        }

        const dataAsync = obterAtualizadoEm(dadosAsync);
        const dataWeb = obterAtualizadoEm(dadosWeb);

        let dadosSalvos: string | null = null;

        if (dataAsync || dataWeb) {
          dadosSalvos = dataAsync >= dataWeb ? dadosAsync : dadosWeb;
        } else {
          dadosSalvos = dadosAsync || dadosWeb;
        }

        if (dadosSalvos) {
          const dados = JSON.parse(dadosSalvos);

          if (Array.isArray(dados)) {
            const disciplinasMigradas = normalizarDisciplinas("7EF", dados);
            const filhoMigrado: Filho = {
              id: String(Date.now()),
              nome: "Aluno 1",
              serie: "7EF",
              turma: turmaPadrao("7EF"),
              disciplinas: disciplinasMigradas,
              anoLetivoAtivo: ANO_LETIVO_PADRAO,
              anosLetivos: {
                [ANO_LETIVO_PADRAO]: {
                  serie: "7EF",
                  turma: turmaPadrao("7EF"),
                  disciplinas: disciplinasMigradas,
                },
              },
            };

            setFilhos([filhoMigrado]);
          } else if (dados && Array.isArray(dados.filhos)) {
            const filhosNormalizados = dados.filhos.map(
              (item: any, index: number) => normalizarFilho(item, index),
            );

            setFilhos(
              filhosNormalizados.length ? filhosNormalizados : [criarFilho()],
            );
          }
        }
      } catch (erro) {
        console.log("Erro ao carregar dados:", erro);
      } finally {
        setDadosCarregados(true);
      }
    }

    carregarDados();
  }, []);

  useEffect(() => {
    if (!dadosCarregados) return;

    const temporizadorSalvamento = setTimeout(() => {
      void salvarFilhosNoDispositivo(filhos);
    }, 500);

    return () => clearTimeout(temporizadorSalvamento);
  }, [filhos, dadosCarregados]);

  useEffect(() => {
    const alunoSelecionado = filhos[filhoSelecionado];
    if (!alunoSelecionado) return;

    const anos = alunoSelecionado.anosLetivos ?? {};
    const anoPreferido = alunoSelecionado.anoLetivoAtivo;
    const anoValido =
      anoPreferido && anos[anoPreferido]
        ? anoPreferido
        : (Object.keys(anos).sort().at(-1) ?? ANO_LETIVO_PADRAO);

    setAnoLetivoSelecionado(anoValido);
    setDisciplinaSelecionada(0);
    setTrimestreSelecionado("t1");
  }, [filhoSelecionado, dadosCarregados]);

  const filhoBase = filhos[filhoSelecionado] ?? filhos[0];
  const dadosAnoLetivo = obterDadosAnoLetivo(filhoBase, anoLetivoSelecionado);

  const filho: Filho = {
    ...filhoBase,
    serie: dadosAnoLetivo.serie,
    turma: dadosAnoLetivo.turma,
    disciplinas: dadosAnoLetivo.disciplinas,
  };

  const disciplina =
    filho.disciplinas[disciplinaSelecionada] ?? filho.disciplinas[0];
  const trimestre = disciplina.trimestres[trimestreSelecionado];
  const mediaAP = calcularMediaAP(trimestre);
  const np = calcularNP(disciplina, trimestre);
  const npr = calcularNPR(disciplina, trimestre);
  const notaConsiderada = calcularNotaConsiderada(disciplina, trimestre);
  const mediaFinalParcial = calcularMediaFinalParcial(disciplina);
  const mediaGeralAluno = calcularMediaGeralAluno(filho);
  const classificacaoGeral = obterClassificacao(mediaGeralAluno);
  const classificacaoDisciplina = obterClassificacao(mediaFinalParcial);
  const resumoDisciplinas = calcularResumoDisciplinas(filho);
  const disciplinasComNotas = resumoDisciplinas.filter(
    (item) => item.media !== null,
  );
  const disciplinasEmAtencao = disciplinasComNotas.filter(
    (item) => (item.media ?? 10) < 6,
  );
  const melhorDesempenho = disciplinasComNotas.reduce<
    (typeof resumoDisciplinas)[number] | null
  >((melhor, item) => {
    if (!melhor) return item;
    return (item.media ?? 0) > (melhor.media ?? 0) ? item : melhor;
  }, null);
  const disciplinasSemNotas =
    filho.disciplinas.length - disciplinasComNotas.length;
  const resumoGeralAlunos = filhos
    .map((item, index) => {
      const anosDisponiveis = item.anosLetivos ?? {};
      const anoAtivo =
        item.anoLetivoAtivo && anosDisponiveis[item.anoLetivoAtivo]
          ? item.anoLetivoAtivo
          : (Object.keys(anosDisponiveis).sort().at(-1) ?? ANO_LETIVO_PADRAO);
      const dadosAno = obterDadosAnoLetivo(item, anoAtivo);
      const alunoVisual: Filho = {
        ...item,
        serie: dadosAno.serie,
        turma: dadosAno.turma,
        disciplinas: dadosAno.disciplinas,
      };
      const media = calcularMediaGeralAluno(alunoVisual);
      const resumo = calcularResumoDisciplinas(alunoVisual);
      const disciplinasComNota = resumo.filter((disc) => disc.media !== null);
      const emAtencao = disciplinasComNota.filter(
        (disc) => (disc.media ?? 10) < 6,
      ).length;

      return {
        index,
        aluno: alunoVisual,
        anoAtivo,
        media,
        emAtencao,
        disciplinasComNota: disciplinasComNota.length,
        classificacao: obterClassificacao(media),
      };
    })
    .sort((a, b) => {
      if (a.media === null && b.media === null)
        return a.aluno.nome.localeCompare(b.aluno.nome, "pt-BR");
      if (a.media === null) return 1;
      if (b.media === null) return -1;
      return b.media - a.media;
    });
  const alunosComMedia = resumoGeralAlunos.filter(
    (item) => item.media !== null,
  );
  const alunosEmAtencaoGeral = resumoGeralAlunos.filter(
    (item) => item.media !== null && (item.media ?? 10) < 6,
  );
  const melhorAlunoGeral = alunosComMedia[0] ?? null;
  const totalDisciplinasEmAtencao = resumoGeralAlunos.reduce(
    (total, item) => total + item.emAtencao,
    0,
  );
  const npDesejadaNumero = textoParaNumero(npDesejada) ?? 8.0;
  const disciplinaBaseSimulador =
    filho.disciplinas[disciplinaSimulador] ?? filho.disciplinas[0];
  const simulacaoPreenchida = Object.values(notasSimuladas).some(
    (valor) => valor.trim() !== "",
  );
  const trimestreCalculadoSimulador = simulacaoPreenchida
    ? notasSimuladas
    : disciplinaBaseSimulador.trimestres[trimestreSimulador];
  const disciplinaCalculadaSimulador: Disciplina = {
    ...disciplinaBaseSimulador,
    trimestres: {
      ...disciplinaBaseSimulador.trimestres,
      [trimestreSimulador]: trimestreCalculadoSimulador,
    },
  };
  const mediaAPSimulada = calcularMediaAP(trimestreCalculadoSimulador);
  const npSimulada = calcularNP(
    disciplinaBaseSimulador,
    trimestreCalculadoSimulador,
  );
  const nprSimulada = calcularNPR(
    disciplinaBaseSimulador,
    trimestreCalculadoSimulador,
  );
  const notaConsideradaSimulada = calcularNotaConsiderada(
    disciplinaBaseSimulador,
    trimestreCalculadoSimulador,
  );
  const mediaAnualSimulada = calcularMediaFinalParcial(
    disciplinaCalculadaSimulador,
  );
  const mediaDesejadaNumero = textoParaNumero(mediaDesejadaSimulador) ?? 6.0;
  const diferencaMetaSimulador =
    mediaAnualSimulada === null
      ? null
      : arredondar(mediaAnualSimulada - mediaDesejadaNumero);
  const nomeAP = prefixoAP(trimestreSelecionado);
  const scrollPrincipalRef = useRef<ScrollView>(null);
  const carrosselAlunosRef = useRef<ScrollView>(null);
  const carrosselInicioRef = useRef<ScrollView>(null);

  function atualizarCampoSimulacao(campo: keyof NotasTrimestre, valor: string) {
    setNotasSimuladas((atual) => ({
      ...atual,
      [campo]: normalizarEntradaNota(valor),
    }));
  }

  function limparSimulacao() {
    setNotasSimuladas(criarTrimestre());
    setMediaDesejadaSimulador("6.0");
  }

  function carregarNotasAtuaisNoSimulador() {
    setNotasSimuladas({
      ...disciplinaBaseSimulador.trimestres[trimestreSimulador],
    });
  }

  function trocarDisciplinaSimulador(index: number) {
    setDisciplinaSimulador(index);
    setNotasSimuladas(criarTrimestre());
  }

  function trocarTrimestreSimulador(trimestre: Trimestre) {
    setTrimestreSimulador(trimestre);
    setNotasSimuladas(criarTrimestre());
  }

  function rolarParaFormularioAluno() {
    setTimeout(() => {
      scrollPrincipalRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }
  function obterAnosDisponiveis() {
    const anos = new Set<string>();

    filhos.forEach((item) => {
      if (item.anosLetivos) {
        Object.keys(item.anosLetivos).forEach((ano) => anos.add(ano));
      }
    });

    const anoAtualNumero = Number(ANO_LETIVO_PADRAO);

    anos.add(String(anoAtualNumero - 1));
    anos.add(String(anoAtualNumero));
    anos.add(String(anoAtualNumero + 1));

    return Array.from(anos).sort();
  }
  async function selecionarAnoLetivo(ano: string) {
    const alunoAtual = filhos[filhoSelecionado];
    const anoExistente = alunoAtual?.anosLetivos?.[ano];

    if (!anoExistente) {
      setAnoNovoFormulario(ano);
      setSerieAnoFormulario(filho.serie);
      setTurmaAnoFormulario(filho.turma);
      setModoNovoAno(true);
      setEditandoAnoExistente(false);
      setMostrarSeletorAno(false);
      setMensagem(
        "Este ano ainda não existe para o aluno. Confirme os dados para criá-lo.",
      );
      return;
    }

    const filhosAtualizados = filhos.map((item, index) =>
      index === filhoSelecionado
        ? {
            ...item,
            serie: anoExistente.serie,
            turma: anoExistente.turma,
            disciplinas: anoExistente.disciplinas,
            anoLetivoAtivo: ano,
          }
        : item,
    );

    setFilhos(filhosAtualizados);

    setAnoLetivoSelecionado(ano);
    setDisciplinaSelecionada(0);
    setTrimestreSelecionado("t1");
    setMostrarSeletorAno(false);
    setModoNovoAno(false);
    setEditandoAnoExistente(false);
    setMensagem("");
  }
  function selecionarSerieNovoAno(serie: SerieEscolar) {
    setSerieAnoFormulario(serie);
    setTurmaAnoFormulario(turmaPadrao(serie));
  }
  async function salvarNovoAnoLetivo() {
    const anoLimpo = anoNovoFormulario.trim();

    if (!/^\d{4}$/.test(anoLimpo)) {
      setMensagem("Informe um ano letivo válido. Exemplo: 2027.");
      return;
    }

    const alunoAtual = filhos[filhoSelecionado];
    const anoJaExiste = Boolean(alunoAtual?.anosLetivos?.[anoLimpo]);

    if (anoJaExiste) {
      const confirmou = await confirmarAcao(
        "Substituir ano letivo?",
        `O ano ${anoLimpo} já existe para ${alunoAtual.nome}. Ao continuar, todas as notas desse ano serão apagadas e recriadas em branco.`,
      );

      if (!confirmou) {
        setMensagem("Criação do ano letivo cancelada.");
        return;
      }
    }

    const filhosAtualizados = filhos.map((item, index) => {
      if (index !== filhoSelecionado) return item;

      const novoAno: DadosAnoLetivo = {
        serie: serieAnoFormulario,
        turma: turmaAnoFormulario,
        disciplinas: criarDisciplinasPorSerie(serieAnoFormulario),
      };

      return {
        ...item,
        serie: serieAnoFormulario,
        turma: turmaAnoFormulario,
        disciplinas: novoAno.disciplinas,
        anoLetivoAtivo: anoLimpo,
        anosLetivos: {
          ...(item.anosLetivos ?? {}),
          [anoLimpo]: novoAno,
        },
      };
    });

    setFilhos(filhosAtualizados);

    setAnoLetivoSelecionado(anoLimpo);
    setDisciplinaSelecionada(0);
    setTrimestreSelecionado("t1");
    setMostrarSeletorAno(false);
    setModoNovoAno(false);
    setEditandoAnoExistente(false);
    setMensagem("Ano letivo criado com notas zeradas.");
  }
  function iniciarEdicaoAnoLetivoAtual() {
    const dadosAtuais = obterDadosAnoLetivo(filhoBase, anoLetivoSelecionado);
    setAnoNovoFormulario(anoLetivoSelecionado);
    setSerieAnoFormulario(dadosAtuais.serie);
    setTurmaAnoFormulario(dadosAtuais.turma);
    setEditandoAnoExistente(true);
    setModoNovoAno(true);
    setMostrarSeletorAno(false);
    setMensagem("");
  }

  async function salvarDadosAnoLetivoAtual() {
    const alunoAtual = filhos[filhoSelecionado];
    if (!alunoAtual) return;

    const dadosAtuais = obterDadosAnoLetivo(alunoAtual, anoLetivoSelecionado);
    const mudouSerie = dadosAtuais.serie !== serieAnoFormulario;

    if (mudouSerie) {
      const confirmou = await confirmarAcao(
        "Alterar a série deste ano?",
        `As notas de disciplinas equivalentes serão preservadas. Disciplinas que não existirem em ${obterRotuloSerie(serieAnoFormulario)} não aparecerão neste ano.`,
      );
      if (!confirmou) return;
    }

    const disciplinasAtualizadas = mudouSerie
      ? normalizarDisciplinas(serieAnoFormulario, dadosAtuais.disciplinas)
      : dadosAtuais.disciplinas;

    const filhosAtualizados = filhos.map((item, index) => {
      if (index !== filhoSelecionado) return item;

      const anoAtualizado: DadosAnoLetivo = {
        serie: serieAnoFormulario,
        turma: turmaAnoFormulario,
        disciplinas: disciplinasAtualizadas,
      };

      return {
        ...item,
        serie: serieAnoFormulario,
        turma: turmaAnoFormulario,
        disciplinas: disciplinasAtualizadas,
        anoLetivoAtivo: anoLetivoSelecionado,
        anosLetivos: {
          ...(item.anosLetivos ?? {}),
          [anoLetivoSelecionado]: anoAtualizado,
        },
      };
    });

    setFilhos(filhosAtualizados);
    setDisciplinaSelecionada(0);
    setModoNovoAno(false);
    setEditandoAnoExistente(false);
    setMensagem(
      `Dados de ${anoLetivoSelecionado} atualizados para ${obterRotuloSerie(serieAnoFormulario)}, turma ${turmaAnoFormulario}.`,
    );
  }

  async function salvarFilhosNoDispositivo(filhosAtualizados: Filho[]) {
    const dados: DadosSalvos = {
      filhos: filhosAtualizados,
      atualizadoEm: new Date().toISOString(),
    };

    const conteudo = JSON.stringify(dados);

    try {
      await AsyncStorage.setItem(CHAVE_STORAGE, conteudo);
    } catch (erro) {
      console.log("Erro ao salvar no AsyncStorage:", erro);
      setMensagem("Não foi possível salvar a alteração agora.");
    }

    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(CHAVE_STORAGE, conteudo);
      } catch (erroWeb) {
        console.log("Erro ao salvar no localStorage:", erroWeb);
        setMensagem(
          "Não foi possível salvar a foto ou os dados no navegador. Tente usar uma foto menor.",
        );
      }
    }
  }
  function atualizarCampo(campo: keyof NotasTrimestre, valor: string) {
    const valorNormalizado = normalizarEntradaNota(valor);

    const novosFilhos = filhos.map((filhoAtual, indexFilho) => {
      if (indexFilho !== filhoSelecionado) return filhoAtual;

      const dadosAtuais = obterDadosAnoLetivo(filhoAtual, anoLetivoSelecionado);

      const disciplinasAtualizadas = dadosAtuais.disciplinas.map(
        (disc, indexDisciplina) => {
          if (indexDisciplina !== disciplinaSelecionada) return disc;

          return {
            ...disc,
            trimestres: {
              ...disc.trimestres,
              [trimestreSelecionado]: {
                ...disc.trimestres[trimestreSelecionado],
                [campo]: valorNormalizado,
              },
            },
          };
        },
      );

      const anosLetivosAtualizados = {
        ...(filhoAtual.anosLetivos ?? {}),
        [anoLetivoSelecionado]: {
          ...dadosAtuais,
          disciplinas: disciplinasAtualizadas,
        },
      };

      return {
        ...filhoAtual,
        serie: dadosAtuais.serie,
        turma: dadosAtuais.turma,
        disciplinas: disciplinasAtualizadas,
        anoLetivoAtivo: anoLetivoSelecionado,
        anosLetivos: anosLetivosAtualizados,
      };
    });

    setFilhos(novosFilhos);
  }
  function abrirNovoFilho() {
    setMensagem("");
    setModoFormulario("novo");
    setNomeFormulario("");
    setSerieFormulario("7EF");
    setTurmaFormulario(turmaPadrao("7EF"));
    setAbaAtiva("alunos");
    rolarParaFormularioAluno();
  }

  function cancelarFormulario() {
    setModoFormulario(null);
    setMensagem("");
  }

  function selecionarSerie(serie: SerieEscolar) {
    setSerieFormulario(serie);
    setTurmaFormulario(turmaPadrao(serie));
  }

  async function salvarFilho() {
    const nomeLimpo = nomeFormulario.trim();
    if (!nomeLimpo) {
      setMensagem("Informe o nome do aluno.");
      return;
    }

    if (modoFormulario === "novo") {
      const novoFilho = criarFilho(nomeLimpo, serieFormulario, turmaFormulario);
      const filhosAtualizados = [...filhos, novoFilho];

      setFilhos(filhosAtualizados);
      setFilhoSelecionado(filhos.length);
      setDisciplinaSelecionada(0);
      setTrimestreSelecionado("t1");
      setModoFormulario(null);
      setMensagem("Aluno adicionado com sucesso.");
      setAbaAtiva("inicio");
      return;
    }

    if (modoFormulario === "editar") {
      const alunoAtual = filhos[filhoSelecionado];
      const dadosAtuaisAluno = obterDadosAnoLetivo(
        alunoAtual,
        anoLetivoSelecionado,
      );
      const mudouSerie = dadosAtuaisAluno.serie !== serieFormulario;

      if (mudouSerie && possuiNotasLancadas(dadosAtuaisAluno.disciplinas)) {
        const confirmou = await confirmarAcao(
          "Alterar série e apagar notas?",
          `Ao mudar de ${obterRotuloSerie(dadosAtuaisAluno.serie)} para ${obterRotuloSerie(serieFormulario)}, as notas de ${anoLetivoSelecionado} serão apagadas porque a lista de disciplinas será recriada.`,
        );

        if (!confirmou) {
          setMensagem(
            "Alteração de série cancelada. As notas foram preservadas.",
          );
          return;
        }
      }

      const filhosAtualizados = filhos.map((item, index) => {
        if (index !== filhoSelecionado) return item;

        const dadosAtuais = obterDadosAnoLetivo(item, anoLetivoSelecionado);
        const mudouSerieNesteAluno = dadosAtuais.serie !== serieFormulario;

        const disciplinasAtualizadas = mudouSerieNesteAluno
          ? criarDisciplinasPorSerie(serieFormulario)
          : dadosAtuais.disciplinas;

        const anosLetivosAtualizados = {
          ...(item.anosLetivos ?? {}),
          [anoLetivoSelecionado]: {
            serie: serieFormulario,
            turma: turmaFormulario,
            disciplinas: disciplinasAtualizadas,
          },
        };

        return {
          ...item,
          nome: nomeLimpo,
          serie: serieFormulario,
          turma: turmaFormulario,
          disciplinas: disciplinasAtualizadas,
          anoLetivoAtivo: anoLetivoSelecionado,
          anosLetivos: anosLetivosAtualizados,
        };
      });
      setFilhos(filhosAtualizados);

      setDisciplinaSelecionada(0);
      setTrimestreSelecionado("t1");
      setModoFormulario(null);
      setMensagem("Dados do aluno atualizados.");
      setAbaAtiva("inicio");
    }
  }
  async function compactarFotoPerfil(imagem: ImagePicker.ImagePickerAsset) {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      return new Promise<string>((resolve, reject) => {
        const img = document.createElement("img");

        img.onload = () => {
          const tamanhoMaximo = 240;
          const proporcao = Math.min(
            tamanhoMaximo / img.width,
            tamanhoMaximo / img.height,
            1,
          );

          const largura = Math.max(1, Math.round(img.width * proporcao));
          const altura = Math.max(1, Math.round(img.height * proporcao));
          const canvas = document.createElement("canvas");
          canvas.width = largura;
          canvas.height = altura;

          const contexto = canvas.getContext("2d");

          if (!contexto) {
            reject(new Error("Não foi possível compactar a foto."));
            return;
          }

          contexto.drawImage(img, 0, 0, largura, altura);

          const qualidades = [0.55, 0.45, 0.35, 0.25];
          let fotoCompactada = "";

          for (const qualidade of qualidades) {
            fotoCompactada = canvas.toDataURL("image/jpeg", qualidade);
            if (
              estimarTamanhoTextoBytes(fotoCompactada) <=
              TAMANHO_MAXIMO_FOTO_BYTES
            ) {
              resolve(fotoCompactada);
              return;
            }
          }

          reject(
            new Error(
              "A foto ainda ficou muito grande após a compactação. Escolha uma imagem menor.",
            ),
          );
        };

        img.onerror = () => {
          reject(new Error("Não foi possível carregar a foto para compactar."));
        };

        img.src = imagem.uri;
      });
    }

    if (imagem.base64) {
      return validarFotoCompactada(`data:image/jpeg;base64,${imagem.base64}`);
    }

    return imagem.uri;
  }
  async function alterarFotoAluno() {
    try {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissao.granted) {
        setMensagem(
          "Permita o acesso às fotos para escolher uma imagem do aluno.",
        );
        return;
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.2,
        base64: Platform.OS !== "web",
      });

      if (resultado.canceled) return;

      const imagem = resultado.assets?.[0];
      if (!imagem) return;

      const fotoUri = await compactarFotoPerfil(imagem);

      const filhosAtualizados = filhos.map((item, index) => {
        if (index !== filhoSelecionado) return item;
        return { ...item, fotoUri };
      });

      setFilhos(filhosAtualizados);

      setMensagem("Foto atualizada e salva automaticamente.");
    } catch (erro) {
      console.log("Erro ao escolher foto:", erro);
      setMensagem(
        erro instanceof Error
          ? erro.message
          : "Não foi possível salvar a foto. Tente usar uma imagem menor.",
      );
    }
  }
  async function removerFotoAluno() {
    const filhosAtualizados = filhos.map((item, index) => {
      if (index !== filhoSelecionado) return item;
      return { ...item, fotoUri: "" };
    });

    setFilhos(filhosAtualizados);
    setMensagem("Foto removida.");
  }

  async function excluirAluno(indexAluno: number) {
    const aluno = filhos[indexAluno];

    if (!aluno) {
      setMensagem("Não foi possível localizar o aluno selecionado.");
      return;
    }

    if (filhos.length === 1) {
      setMensagem(
        "Não é possível excluir o único aluno cadastrado. Cadastre outro aluno antes de excluir este perfil.",
      );
      return;
    }

    const confirmou = await confirmarAcao(
      "Excluir aluno?",
      `Todos os dados, notas, anos letivos e a foto de ${aluno.nome} serão removidos deste dispositivo. Essa ação não pode ser desfeita.`,
    );

    if (!confirmou) {
      setMensagem("Exclusão cancelada. Nenhum dado foi alterado.");
      return;
    }

    const filhosAtualizados = filhos.filter((_, index) => index !== indexAluno);
    const novoIndice = Math.min(indexAluno, filhosAtualizados.length - 1);
    const novoAlunoSelecionado = filhosAtualizados[novoIndice];
    const novoAno =
      novoAlunoSelecionado?.anoLetivoAtivo ??
      Object.keys(novoAlunoSelecionado?.anosLetivos ?? {})
        .sort()
        .at(-1) ??
      ANO_LETIVO_PADRAO;

    setFilhos(filhosAtualizados);
    setFilhoSelecionado(novoIndice);
    setAnoLetivoSelecionado(novoAno);
    setDisciplinaSelecionada(0);
    setTrimestreSelecionado("t1");
    setModoFormulario(null);
    setPesquisaAluno("");
    setMensagem(`${aluno.nome} foi excluído com segurança.`);
  }
  async function exportarBackup() {
    try {
      const backup: BackupMediaCMB = {
        app: "MEDIA_CMB",
        versaoBackup: VERSAO_BACKUP_ATUAL,
        exportadoEm: new Date().toISOString(),
        filhos,
      };

      const conteudo = JSON.stringify(backup, null, 2);
      const nomeArquivo = gerarNomeArquivoBackup();

      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([conteudo], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        setMensagem(
          "Backup exportado com sucesso. Guarde o arquivo em local seguro.",
        );
        return;
      }

      setMensagem(
        "A exportação de backup está disponível na versão web/PWA do app.",
      );
    } catch (erro) {
      console.log("Erro ao exportar backup:", erro);
      setMensagem("Não foi possível exportar o backup agora.");
    }
  }

  function importarBackup() {
    try {
      if (Platform.OS !== "web" || typeof document === "undefined") {
        setMensagem(
          "A importação de backup está disponível na versão web/PWA do app.",
        );
        return;
      }

      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";

      input.onchange = () => {
        const arquivo = input.files?.[0];

        if (!arquivo) {
          return;
        }

        if (arquivo.size > TAMANHO_MAXIMO_BACKUP_BYTES) {
          setMensagem(
            "Este arquivo é grande demais para ser um backup válido do Média CMB.",
          );
          return;
        }

        const leitor = new FileReader();

        leitor.onload = async () => {
          try {
            const texto = String(leitor.result ?? "");

            if (estimarTamanhoTextoBytes(texto) > TAMANHO_MAXIMO_BACKUP_BYTES) {
              setMensagem("O arquivo de backup excede o limite permitido.");
              return;
            }

            const dados = JSON.parse(texto);

            if (dados?.app !== "MEDIA_CMB" || !Array.isArray(dados?.filhos)) {
              setMensagem("Arquivo de backup inválido para o Média CMB.");
              return;
            }

            const versaoBackup = Number(dados?.versaoBackup ?? 1);

            if (!Number.isInteger(versaoBackup) || versaoBackup < 1) {
              setMensagem("A versão deste backup é inválida.");
              return;
            }

            if (versaoBackup > VERSAO_BACKUP_ATUAL) {
              setMensagem(
                "Este backup foi criado por uma versão mais nova do Média CMB. Atualize o app antes de importar.",
              );
              return;
            }

            const confirmar =
              typeof window !== "undefined"
                ? window.confirm(
                    "Ao importar este backup, os dados atuais deste aparelho serão substituídos. Deseja continuar?",
                  )
                : true;

            if (!confirmar) {
              setMensagem("Importação cancelada.");
              return;
            }

            const filhosNormalizados = dados.filhos.map(
              (item: any, index: number) => normalizarFilho(item, index),
            );

            if (!filhosNormalizados.length) {
              setMensagem("O backup não possui alunos válidos.");
              return;
            }

            await salvarFilhosNoDispositivo(filhosNormalizados);
            setFilhos(filhosNormalizados);
            setFilhoSelecionado(0);
            setAnoLetivoSelecionado(
              filhosNormalizados[0].anoLetivoAtivo ?? ANO_LETIVO_PADRAO,
            );
            setDisciplinaSelecionada(0);
            setTrimestreSelecionado("t1");
            setAbaAtiva("inicio");
            setModoFormulario(null);
            setMensagem("Backup importado com sucesso neste dispositivo.");
          } catch (erro) {
            console.log("Erro ao importar backup:", erro);
            setMensagem("Não foi possível importar este arquivo de backup.");
          }
        };

        leitor.readAsText(arquivo);
      };

      input.click();
    } catch (erro) {
      console.log("Erro ao abrir importação:", erro);
      setMensagem("Não foi possível abrir o seletor de arquivo.");
    }
  }
  async function ativarLicenca() {
    const chave = normalizarChave(chaveAtivacao);

    if (!chave) {
      setMensagemLicenca("Informe a chave de acesso.");
      return;
    }

    if (!deviceId) {
      setMensagemLicenca(
        "Não foi possível identificar este dispositivo. Feche e abra o app novamente.",
      );
      return;
    }

    try {
      setValidandoLicenca(true);
      setMensagemLicenca("Validando chave de acesso...");

      if (__DEV__ && chave === "EVANDRO-TESTE-LOCAL") {
        const agora = new Date().toISOString();
        const licencaLocal: LicencaLocal = {
          ativa: true,
          chave,
          deviceId,
          ativadaEm: agora,
          ultimaValidacaoEm: agora,
        };
        await AsyncStorage.setItem(
          CHAVE_LICENCA_LOCAL,
          JSON.stringify(licencaLocal),
        );
        setDadosLicencaLocal(licencaLocal);
        setLicencaAtiva(true);
        setMensagemLicenca("Licença local de teste ativada.");
        return;
      }

      const controlador = new AbortController();
      const temporizador = setTimeout(
        () => controlador.abort(),
        TEMPO_LIMITE_API_MS,
      );

      let resposta: Response;

      try {
        resposta = await fetch(API_ATIVAR_LICENCA, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chave, deviceId }),
          signal: controlador.signal,
        });
      } finally {
        clearTimeout(temporizador);
      }

      let resultado: any = null;
      try {
        resultado = await resposta.json();
      } catch {
        resultado = null;
      }

      if (!resposta.ok || !resultado?.ok) {
        setMensagemLicenca(mensagemErroAtivacao(resposta.status, resultado));
        return;
      }

      const agora = new Date().toISOString();
      const licencaLocal: LicencaLocal = {
        ativa: true,
        chave,
        deviceId,
        ativadaEm: agora,
        ultimaValidacaoEm: agora,
      };
      await AsyncStorage.setItem(
        CHAVE_LICENCA_LOCAL,
        JSON.stringify(licencaLocal),
      );
      setDadosLicencaLocal(licencaLocal);
      setLicencaAtiva(true);
      setMensagemLicenca(resultado?.mensagem ?? "Licença ativada com sucesso.");
    } catch (erro: any) {
      console.log("Erro ao ativar licença:", erro);

      if (erro?.name === "AbortError") {
        setMensagemLicenca(
          "A validação demorou mais que o esperado. Verifique a conexão e tente novamente.",
        );
      } else {
        setMensagemLicenca(
          "Não foi possível acessar o servidor de licenças. Verifique a internet e tente novamente.",
        );
      }
    } finally {
      setValidandoLicenca(false);
    }
  }

  function prepararCompraPix() {
    const nome = nomeComprador.trim();
    const email = emailComprador.trim();

    if (!nome) {
      setMensagemLicenca("Informe o nome do comprador.");
      return;
    }

    if (!email || !email.includes("@")) {
      setMensagemLicenca("Informe um e-mail válido para receber a chave.");
      return;
    }

    setStatusCompraPix("aguardando");
    setPixCopiaCola("PIX-AINDA-NAO-CONFIGURADO-MERCADO-PAGO");
    setMensagemLicenca(
      "Área de compra preparada. Na próxima etapa, este botão vai gerar um Pix real pelo Mercado Pago.",
    );
  }

  function renderTelaLicenca() {
    return (
      <ScrollView contentContainerStyle={styles.containerLicencaNovo}>
        <View style={styles.barraTopoLicenca} />

        <View style={styles.cardLicencaNovo}>
          <View style={styles.areaLogoLicenca}>
            <Image
              source={require("../../assets/images/Icon-512-cmb.png")}
              style={styles.logoLicenca}
            />

            <Text style={styles.tituloLicenca}>Média CMB</Text>

            <Text style={styles.descricaoLicenca}>
              Acompanhe notas, trimestres e recuperação escolar com clareza.
            </Text>
          </View>

          <View style={styles.blocoLicenca}>
            <Text style={styles.cardTituloLicenca}>Ativar app</Text>

            <Text style={styles.infoLicenca}>
              Digite sua chave de acesso para liberar o uso neste dispositivo.
              Cada chave pode liberar até 2 dispositivos.
            </Text>

            <Text style={styles.labelLicenca}>Chave de acesso</Text>

            <TextInput
              style={styles.inputLicenca}
              value={chaveAtivacao}
              onChangeText={setChaveAtivacao}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Ex.: MEDIA-CMB-8K2P-91QD"
              placeholderTextColor="#94a3b8"
            />

            <Pressable
              style={[
                styles.botaoAtivarNovo,
                validandoLicenca && styles.botaoDesabilitado,
              ]}
              onPress={ativarLicenca}
              disabled={validandoLicenca}
            >
              <Text style={styles.botaoAtivarTextoNovo}>
                {validandoLicenca ? "Validando..." : "Ativar app"}
              </Text>
            </Pressable>

            {mensagemLicenca ? (
              <Text style={styles.mensagemLicencaNovo}>{mensagemLicenca}</Text>
            ) : null}
          </View>

          <View style={styles.divisorLicenca} />

          <View style={styles.blocoCompraPix}>
            <Text style={styles.cardTituloLicenca}>Ainda não tem chave?</Text>

            <Text style={styles.infoLicenca}>
              Em breve você poderá comprar a licença por Pix. Após a confirmação
              do pagamento, a chave será liberada automaticamente no app e
              enviada por e-mail.
            </Text>

            {!mostrarCompraPix ? (
              <Pressable
                style={styles.botaoComprarPix}
                onPress={() => {
                  setMostrarCompraPix(true);
                  setMensagemLicenca("");
                }}
              >
                <Text style={styles.botaoComprarPixTexto}>
                  Comprar licença por Pix
                </Text>
              </Pressable>
            ) : (
              <View style={styles.formCompraPix}>
                <Text style={styles.labelLicenca}>Nome do comprador</Text>
                <TextInput
                  style={styles.inputLicenca}
                  value={nomeComprador}
                  onChangeText={setNomeComprador}
                  placeholder="Ex.: Evandro Dias"
                  placeholderTextColor="#94a3b8"
                />

                <Text style={styles.labelLicenca}>
                  E-mail para receber a chave
                </Text>
                <TextInput
                  style={styles.inputLicenca}
                  value={emailComprador}
                  onChangeText={setEmailComprador}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="Ex.: email@exemplo.com"
                  placeholderTextColor="#94a3b8"
                />

                <Text style={styles.labelLicenca}>WhatsApp opcional</Text>
                <TextInput
                  style={styles.inputLicenca}
                  value={whatsappComprador}
                  onChangeText={setWhatsappComprador}
                  keyboardType="phone-pad"
                  placeholder="Ex.: (61) 99999-9999"
                  placeholderTextColor="#94a3b8"
                />

                <Pressable
                  style={styles.botaoGerarPix}
                  onPress={prepararCompraPix}
                >
                  <Text style={styles.botaoGerarPixTexto}>
                    Gerar Pix de R$ 14,99
                  </Text>
                </Pressable>

                {statusCompraPix === "aguardando" ? (
                  <View style={styles.caixaPixPreparado}>
                    <Text style={styles.pixTitulo}>
                      Pix preparado para integração
                    </Text>

                    <Text style={styles.infoLicenca}>
                      Quando conectarmos o Mercado Pago, aqui aparecerão o QR
                      Code Pix e o código Pix copia e cola.
                    </Text>

                    <Text style={styles.labelLicenca}>Pix copia e cola</Text>

                    <View style={styles.caixaCodigoPix}>
                      <Text style={styles.codigoPixTexto}>{pixCopiaCola}</Text>
                    </View>

                    <Text style={styles.avisoPix}>
                      Esta tela ainda não realiza cobrança real.
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  style={styles.botaoVoltarChave}
                  onPress={() => {
                    setMostrarCompraPix(false);
                    setStatusCompraPix("inicio");
                    setPixCopiaCola("");
                    setMensagemLicenca("");
                  }}
                >
                  <Text style={styles.botaoVoltarChaveTexto}>
                    Já tenho uma chave
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.caixaDeviceNovo}>
            <Text style={styles.deviceLabelNovo}>ID deste dispositivo</Text>
            <Text style={styles.deviceTextoNovo}>
              {deviceId || "Gerando identificação..."}
            </Text>
          </View>

          {__DEV__ ? (
            <Text style={styles.avisoDevLicenca}>
              Teste local: use a chave EVANDRO-TESTE-LOCAL.
            </Text>
          ) : null}

          <View style={styles.rodapeLicencaNovo}>
            <Text style={styles.rodape}>Desenvolvido por EDS e Dupont</Text>
            <Text style={styles.rodapeSub}>
              Este app guarda dados apenas no seu dispositivo.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }
  function renderSeletorAnoLetivo() {
    return (
      <View style={styles.cardAnoLetivoNovo}>
        <View style={styles.cardTopoLinhaNovo}>
          <Text style={styles.tituloSecaoNovo}>Ano letivo</Text>
          <Text style={styles.badgeSerieNovo}>
            {obterRotuloSerie(filho.serie)}
          </Text>
        </View>

        <Pressable
          style={styles.botaoDropdownAnoNovo}
          onPress={() => {
            setMostrarSeletorAno(!mostrarSeletorAno);
            setModoNovoAno(false);
          }}
        >
          <View>
            <Text style={styles.dropdownAnoLabelNovo}>Ano selecionado</Text>
            <Text style={styles.dropdownAnoValorNovo}>
              {anoLetivoSelecionado}
            </Text>
          </View>

          <Text style={styles.dropdownAnoSetaNovo}>
            {mostrarSeletorAno ? "▲" : "▼"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.botaoEditarAnoNovo}
          onPress={iniciarEdicaoAnoLetivoAtual}
        >
          <Text style={styles.botaoEditarAnoTextoNovo}>
            Editar série e turma de {anoLetivoSelecionado}
          </Text>
        </Pressable>

        {mostrarSeletorAno ? (
          <View style={styles.listaDropdownAnoNovo}>
            {obterAnosDisponiveis().map((ano) => (
              <Pressable
                key={ano}
                style={[
                  styles.itemDropdownAnoNovo,
                  anoLetivoSelecionado === ano &&
                    styles.itemDropdownAnoAtivoNovo,
                ]}
                onPress={() => {
                  void selecionarAnoLetivo(ano);
                }}
              >
                <Text
                  style={[
                    styles.itemDropdownAnoTextoNovo,
                    anoLetivoSelecionado === ano &&
                      styles.itemDropdownAnoTextoAtivoNovo,
                  ]}
                >
                  {ano}
                </Text>

                {anoLetivoSelecionado === ano ? (
                  <Text style={styles.itemDropdownAnoCheckNovo}>✓</Text>
                ) : null}
              </Pressable>
            ))}

            <Pressable
              style={styles.botaoCriarAnoNovo}
              onPress={() => {
                setModoNovoAno(true);
                setEditandoAnoExistente(false);
                setAnoNovoFormulario(String(Number(anoLetivoSelecionado) + 1));
                setSerieAnoFormulario(filho.serie);
                setTurmaAnoFormulario(turmaPadrao(filho.serie));
              }}
            >
              <Text style={styles.botaoCriarAnoTextoNovo}>
                ＋ Criar novo ano letivo
              </Text>
            </Pressable>
          </View>
        ) : null}

        {modoNovoAno ? (
          <View style={styles.formNovoAnoLetivoNovo}>
            <Text style={styles.labelSelecaoNovo}>
              {editandoAnoExistente
                ? `Ano letivo ${anoLetivoSelecionado}`
                : "Novo ano letivo"}
            </Text>

            <TextInput
              style={styles.inputLicenca}
              value={anoNovoFormulario}
              onChangeText={setAnoNovoFormulario}
              editable={!editandoAnoExistente}
              keyboardType="number-pad"
              placeholder="Ex.: 2027"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.labelSelecaoNovo}>Série neste ano</Text>

            <View style={styles.listaBotoes}>
              {SERIES.map((serie) => (
                <Pressable
                  key={serie.id}
                  style={[
                    styles.chipDisciplinaNovo,
                    serieAnoFormulario === serie.id &&
                      styles.chipDisciplinaAtivoNovo,
                  ]}
                  onPress={() => selecionarSerieNovoAno(serie.id)}
                >
                  <Text
                    style={[
                      styles.chipDisciplinaTextoNovo,
                      serieAnoFormulario === serie.id &&
                        styles.chipDisciplinaTextoAtivoNovo,
                    ]}
                  >
                    {serie.rotulo}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.labelSelecaoNovo}>Turma neste ano</Text>

            <View style={styles.listaBotoes}>
              {gerarTurmas(serieAnoFormulario).map((turma) => (
                <Pressable
                  key={turma}
                  style={[
                    styles.chipTurmaAlunoNovo,
                    turmaAnoFormulario === turma &&
                      styles.chipDisciplinaAtivoNovo,
                  ]}
                  onPress={() => setTurmaAnoFormulario(turma)}
                >
                  <Text
                    style={[
                      styles.chipDisciplinaTextoNovo,
                      turmaAnoFormulario === turma &&
                        styles.chipDisciplinaTextoAtivoNovo,
                    ]}
                  >
                    {turma}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.caixaAvisoPlanejamentoNovo}>
              <Text style={styles.avisoPlanejamentoTextoNovo}>
                {editandoAnoExistente
                  ? "A série e a turma serão alteradas somente neste ano. As notas das disciplinas equivalentes serão preservadas."
                  : "O novo ano será criado com disciplinas zeradas. As notas dos outros anos serão mantidas separadas."}
              </Text>
            </View>

            <View style={styles.botoesFormularioAlunoNovo}>
              <Pressable
                style={styles.botaoSalvarAlunoNovo}
                onPress={
                  editandoAnoExistente
                    ? salvarDadosAnoLetivoAtual
                    : salvarNovoAnoLetivo
                }
              >
                <Text style={styles.botaoSalvarAlunoTextoNovo}>
                  {editandoAnoExistente ? "Salvar alterações" : "Criar ano"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.botaoCancelarAlunoNovo}
                onPress={() => {
                  setModoNovoAno(false);
                  setEditandoAnoExistente(false);
                  setMensagem("");
                }}
              >
                <Text style={styles.botaoCancelarAlunoTextoNovo}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.infoAnoLetivoNovo}>
          As notas são salvas separadamente para cada ano letivo.
        </Text>
      </View>
    );
  }
  function renderCabecalho() {
    return (
      <>
        <View style={styles.topoAppNovo}>
          <View style={styles.topoMarcaNovo}>
            <Image
              source={require("../../assets/images/Icon-512-cmb.png")}
              style={styles.topoLogoNovo}
            />

            <View>
              <Text style={styles.topoTituloNovo}>Média CMB</Text>
              <Text style={styles.topoSubtituloNovo}>
                Notas e recuperação escolar
              </Text>
            </View>
          </View>

        </View>

        <View style={styles.cardHeroAlunoNovo}>
          <View style={styles.areaPerfilHeroNovo}>
            <View
              style={[
                styles.avatarHeroNovo,
                { backgroundColor: classificacaoGeral.corAvatar },
              ]}
            >
              {filho.fotoUri ? (
                <Image
                  source={{ uri: filho.fotoUri }}
                  style={styles.avatarImagemHeroNovo}
                />
              ) : (
                <Text style={styles.avatarTextoHeroNovo}>
                  {obterIniciais(filho.nome)}
                </Text>
              )}
            </View>

            <View style={styles.infoAlunoHeroNovo}>
              <Text style={styles.labelHeroNovo}>Estudante</Text>
              <Text style={styles.nomeAlunoHeroNovo}>{filho.nome}</Text>
              <Text style={styles.dadosAlunoHeroNovo}>
                {obterRotuloSerie(filho.serie)} • Turma {filho.turma}
              </Text>
            </View>
          </View>

          <View style={styles.linhaHeroNovo} />

          <View style={styles.areaMediaHeroNovo}>
            <View>
              <Text style={styles.labelHeroNovo}>Média geral</Text>
              <Text
                style={[
                  styles.mediaHeroNovo,
                  { color: classificacaoGeral.corTexto },
                ]}
              >
                {mostrarNota(mediaGeralAluno)}
              </Text>
            </View>

            <View style={styles.statusHeroNovo}>
              <Text
                style={[
                  styles.statusTituloHeroNovo,
                  { color: classificacaoGeral.corTexto },
                ]}
              >
                {classificacaoGeral.titulo}
              </Text>

              <Text
                style={[
                  styles.statusMensagemHeroNovo,
                  { color: classificacaoGeral.corTexto },
                ]}
              >
                {classificacaoGeral.mensagem}
              </Text>
            </View>
          </View>
        </View>

        {renderSeletorAnoLetivo()}
      </>
    );
  }
  function renderMenuInferior() {
    const itens: { aba: AbaApp; rotulo: string; icone: string }[] = [
      { aba: "inicio", rotulo: "Início", icone: "⌂" },
      { aba: "alunos", rotulo: "Alunos", icone: "♟" },
      { aba: "notas", rotulo: "Notas", icone: "★" },
      { aba: "planejamento", rotulo: "Planejar", icone: "▣" },
      { aba: "perfil", rotulo: "Perfil", icone: "⚙" },
    ];

    return (
      <View
        style={[
          styles.menuInferiorNovo,
          { left: margemMenuInferior, right: margemMenuInferior },
        ]}
      >
        {itens.map((item) => {
          const ativo = abaAtiva === item.aba;

          return (
            <Pressable
              key={item.aba}
              style={[
                styles.menuInferiorBotaoNovo,
                ativo && styles.menuInferiorBotaoAtivoNovo,
              ]}
              onPress={() => {
                if (item.aba === "notas") setVisualizacaoNotas("visao");
                setAbaAtiva(item.aba);
              }}
            >
              <Text
                style={[
                  styles.menuInferiorIconeNovo,
                  ativo && styles.menuInferiorIconeAtivoNovo,
                ]}
              >
                {item.icone}
              </Text>

              <Text
                style={[
                  styles.menuInferiorTextoNovo,
                  ativo && styles.menuInferiorTextoAtivoNovo,
                ]}
              >
                {item.rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  function navegarParaAluno(indice: number) {
    const indiceSeguro = Math.max(0, Math.min(indice, filhos.length - 1));

    carrosselAlunosRef.current?.scrollTo({
      x: indiceSeguro * larguraSlideAluno,
      animated: true,
    });

    setFilhoSelecionado(indiceSeguro);
    setDisciplinaSelecionada(0);
    setTrimestreSelecionado("t1");
    setMensagem("");
  }

  function renderSelecaoAluno() {
    return (
      <>
        <View style={styles.cardSelecaoTopoNovo}>
          <Text style={styles.labelHeroNovo}>Escolha o estudante</Text>
          <Text style={styles.tituloSelecaoAlunoNovo}>
            Quem você quer acompanhar?
          </Text>
          <Text style={styles.infoSelecaoAlunoNovo}>
            Toque no aluno para abrir as notas. No celular, arraste para o lado;
            no computador, use as setas abaixo.
          </Text>
        </View>

        <ScrollView
          ref={carrosselAlunosRef}
          horizontal
          snapToInterval={larguraSlideAluno}
          decelerationRate="fast"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          style={styles.carrosselAlunosNovo}
          onMomentumScrollEnd={(evento) => {
            const posicao = evento.nativeEvent.contentOffset.x;
            const novoIndice = Math.round(posicao / larguraSlideAluno);

            if (filhos[novoIndice]) {
              setFilhoSelecionado(novoIndice);
              setDisciplinaSelecionada(0);
              setTrimestreSelecionado("t1");
              setMensagem("");
            }
          }}
        >
          {filhos.map((item, index) => {
            const dadosAlunoAno = obterDadosAnoLetivo(
              item,
              anoLetivoSelecionado,
            );

            const alunoVisual: Filho = {
              ...item,
              serie: dadosAlunoAno.serie,
              turma: dadosAlunoAno.turma,
              disciplinas: dadosAlunoAno.disciplinas,
            };

            const mediaAluno = calcularMediaGeralAluno(alunoVisual);
            const classificacaoAluno = obterClassificacao(mediaAluno);

            return (
              <View
                key={item.id}
                style={[styles.slideAlunoNovo, { width: larguraSlideAluno }]}
              >
                <Pressable
                  style={[
                    styles.cardEscolhaAlunoNovo,
                    filhoSelecionado === index &&
                      styles.cardEscolhaAlunoAtivoNovo,
                  ]}
                  onPress={() => {
                    setFilhoSelecionado(index);
                    setDisciplinaSelecionada(0);
                    setTrimestreSelecionado("t1");
                    setAbaAtiva("inicio");
                    setMensagem("");
                  }}
                >
                  <View
                    style={[
                      styles.avatarEscolhaAlunoNovo,
                      { backgroundColor: classificacaoAluno.corAvatar },
                    ]}
                  >
                    {item.fotoUri ? (
                      <Image
                        source={{ uri: item.fotoUri }}
                        style={styles.avatarEscolhaImagemNovo}
                      />
                    ) : (
                      <Text style={styles.avatarEscolhaTextoNovo}>
                        {obterIniciais(item.nome)}
                      </Text>
                    )}
                  </View>

                  <Text style={styles.nomeEscolhaAlunoNovo}>{item.nome}</Text>

                  <Text style={styles.dadosEscolhaAlunoNovo}>
                    {obterRotuloSerie(alunoVisual.serie)} • Turma{" "}
                    {alunoVisual.turma}
                  </Text>

                  <View
                    style={[
                      styles.caixaMediaEscolhaNovo,
                      {
                        backgroundColor: classificacaoAluno.corFundo,
                        borderColor: classificacaoAluno.corBorda,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.mediaEscolhaValorNovo,
                        { color: classificacaoAluno.corTexto },
                      ]}
                    >
                      {mostrarNota(mediaAluno)}
                    </Text>

                    <Text
                      style={[
                        styles.mediaEscolhaStatusNovo,
                        { color: classificacaoAluno.corTexto },
                      ]}
                    >
                      {classificacaoAluno.titulo}
                    </Text>
                  </View>

                  <Text style={styles.textoAbrirAlunoNovo}>
                    Toque para abrir
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>

        {Platform.OS === "web" && filhos.length > 1 ? (
          <View style={styles.controlesCarrosselDesktopNovo}>
            <Pressable
              style={[
                styles.botaoCarrosselDesktopNovo,
                filhoSelecionado === 0 && styles.botaoCarrosselDesabilitadoNovo,
              ]}
              onPress={() => navegarParaAluno(filhoSelecionado - 1)}
              disabled={filhoSelecionado === 0}
            >
              <Text style={styles.botaoCarrosselTextoNovo}>‹ Anterior</Text>
            </Pressable>

            <Text style={styles.contadorCarrosselNovo}>
              {filhoSelecionado + 1} de {filhos.length}
            </Text>

            <Pressable
              style={[
                styles.botaoCarrosselDesktopNovo,
                filhoSelecionado === filhos.length - 1 &&
                  styles.botaoCarrosselDesabilitadoNovo,
              ]}
              onPress={() => navegarParaAluno(filhoSelecionado + 1)}
              disabled={filhoSelecionado === filhos.length - 1}
            >
              <Text style={styles.botaoCarrosselTextoNovo}>Próximo ›</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.indicadoresAlunosNovo}>
          {filhos.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => navegarParaAluno(index)}
              hitSlop={8}
              style={[
                styles.indicadorAlunoNovo,
                filhoSelecionado === index && styles.indicadorAlunoAtivoNovo,
              ]}
            />
          ))}
        </View>
      </>
    );
  }
  function abrirAlunoNoPainel(indice: number) {
    const alunoEscolhido = filhos[indice];
    if (!alunoEscolhido) return;

    setFilhoSelecionado(indice);
    setDisciplinaSelecionada(0);
    setTrimestreSelecionado("t1");
    setMensagem("");
    setVisualizacaoNotas("visao");
    setAbaAtiva("notas");
  }

  function renderPainelGeral() {
    return (
      <>
        <View style={styles.cardPainelGeralTopoNovo}>
          <Text style={styles.labelHeroNovo}>Painel geral</Text>
          <Text style={styles.tituloPainelGeralNovo}>Visão da família</Text>
          <Text style={styles.infoPainelGeralNovo}>
            Compare o desempenho dos alunos e identifique rapidamente quem
            precisa de mais atenção.
          </Text>

          <View style={styles.gradeIndicadoresPainelNovo}>
            <View style={styles.cardIndicadorPainelNovo}>
              <Text style={styles.indicadorPainelLabelNovo}>Alunos</Text>
              <Text style={styles.indicadorPainelValorNovo}>
                {filhos.length}
              </Text>
              <Text style={styles.indicadorPainelSubNovo}>cadastrados</Text>
            </View>

            <View style={styles.cardIndicadorPainelNovo}>
              <Text style={styles.indicadorPainelLabelNovo}>Em atenção</Text>
              <Text
                style={[
                  styles.indicadorPainelValorNovo,
                  alunosEmAtencaoGeral.length > 0 &&
                    styles.valorAtencaoCentralNovo,
                ]}
              >
                {alunosEmAtencaoGeral.length}
              </Text>
              <Text style={styles.indicadorPainelSubNovo}>
                média abaixo de 6
              </Text>
            </View>

            <View style={styles.cardIndicadorPainelNovo}>
              <Text style={styles.indicadorPainelLabelNovo}>Alertas</Text>
              <Text
                style={[
                  styles.indicadorPainelValorNovo,
                  totalDisciplinasEmAtencao > 0 &&
                    styles.valorAtencaoCentralNovo,
                ]}
              >
                {totalDisciplinasEmAtencao}
              </Text>
              <Text style={styles.indicadorPainelSubNovo}>
                disciplinas abaixo de 6
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardMelhorAlunoPainelNovo}>
          <Text style={styles.labelHeroNovo}>Melhor desempenho geral</Text>
          {melhorAlunoGeral ? (
            <View style={styles.linhaMelhorAlunoPainelNovo}>
              <View style={styles.avatarPainelNovo}>
                {melhorAlunoGeral.aluno.fotoUri ? (
                  <Image
                    source={{ uri: melhorAlunoGeral.aluno.fotoUri }}
                    style={styles.avatarImagemPainelNovo}
                  />
                ) : (
                  <Text style={styles.avatarTextoPainelNovo}>
                    {obterIniciais(melhorAlunoGeral.aluno.nome)}
                  </Text>
                )}
              </View>
              <View style={styles.infoMelhorAlunoPainelNovo}>
                <Text style={styles.nomeMelhorAlunoPainelNovo}>
                  {melhorAlunoGeral.aluno.nome}
                </Text>
                <Text style={styles.dadosMelhorAlunoPainelNovo}>
                  {obterRotuloSerie(melhorAlunoGeral.aluno.serie)} • Turma{" "}
                  {melhorAlunoGeral.aluno.turma}
                </Text>
              </View>
              <Text style={styles.mediaMelhorAlunoPainelNovo}>
                {mostrarNota(melhorAlunoGeral.media)}
              </Text>
            </View>
          ) : (
            <Text style={styles.painelSemDadosNovo}>
              Lance notas para visualizar o melhor desempenho.
            </Text>
          )}
        </View>

        <View style={styles.cardListaPainelNovo}>
          <View style={styles.cardTopoLinhaNovo}>
            <View>
              <Text style={styles.tituloSecaoNovo}>
                Classificação dos alunos
              </Text>
              <Text style={styles.infoInicioNovo}>
                Ordenação automática da maior para a menor média.
              </Text>
            </View>
            <Text style={styles.badgeSerieNovo}>{filhos.length} aluno(s)</Text>
          </View>

          <View style={styles.listaRankingPainelNovo}>
            {resumoGeralAlunos.map((item, posicao) => (
              <Pressable
                key={item.aluno.id}
                style={[
                  styles.cardAlunoPainelNovo,
                  larguraTela < 480 && styles.cardAlunoPainelCompactoNovo,
                ]}
                onPress={() => abrirAlunoNoPainel(item.index)}
              >
                <View style={styles.posicaoPainelNovo}>
                  <Text style={styles.posicaoPainelTextoNovo}>
                    {posicao + 1}
                  </Text>
                </View>

                <View
                  style={[
                    styles.avatarAlunoPainelNovo,
                    { backgroundColor: item.classificacao.corAvatar },
                  ]}
                >
                  {item.aluno.fotoUri ? (
                    <Image
                      source={{ uri: item.aluno.fotoUri }}
                      style={styles.avatarImagemPainelNovo}
                    />
                  ) : (
                    <Text style={styles.avatarAlunoPainelTextoNovo}>
                      {obterIniciais(item.aluno.nome)}
                    </Text>
                  )}
                </View>

                <View style={styles.infoAlunoPainelNovo}>
                  <Text
                    style={styles.nomeAlunoPainelNovo}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.aluno.nome}
                  </Text>
                  <Text
                    style={styles.dadosAlunoPainelNovo}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {obterRotuloSerie(item.aluno.serie)} • Turma{" "}
                    {item.aluno.turma} • {item.anoAtivo}
                  </Text>
                  <Text
                    style={styles.alertaAlunoPainelNovo}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.emAtencao > 0
                      ? `${item.emAtencao} disciplina(s) abaixo de 6,0`
                      : item.disciplinasComNota > 0
                        ? "Sem disciplinas abaixo de 6,0"
                        : "Sem notas lançadas"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.areaMediaAlunoPainelNovo,
                    larguraTela < 480 &&
                      styles.areaMediaAlunoPainelCompactoNovo,
                  ]}
                >
                  <Text
                    style={[
                      styles.mediaAlunoPainelNovo,
                      { color: item.classificacao.corTexto },
                    ]}
                  >
                    {mostrarNota(item.media)}
                  </Text>
                  <Text
                    style={[
                      styles.statusAlunoPainelNovo,
                      { color: item.classificacao.corTexto },
                    ]}
                  >
                    {item.classificacao.titulo}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </>
    );
  }

  async function compartilharBoletimPdf() {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      setMensagem(
        "O compartilhamento do boletim está disponível na versão web/PWA do Média CMB.",
      );
      return;
    }

    try {
      setMensagem("Gerando PDF para compartilhamento...");

      const jsPDF = await carregarBibliotecasPdf();
      const documento = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      const larguraPagina = documento.internal.pageSize.getWidth();
      const classificacaoAluno = obterClassificacao(mediaGeralAluno);
      const nomeArquivo = `Boletim_${filho.nome.replace(/[^a-zA-ZÀ-ÿ0-9]+/g, "_")}_${anoLetivoSelecionado}.pdf`;

      documento.setFont("helvetica", "bold");
      documento.setFontSize(18);
      documento.text("Média CMB — Boletim escolar detalhado", 14, 15);
      documento.setFont("helvetica", "normal");
      documento.setFontSize(10);
      documento.text(`Aluno: ${filho.nome}`, 14, 23);
      documento.text(
        `Série: ${obterRotuloSerie(filho.serie)} | Turma: ${filho.turma} | Ano letivo: ${anoLetivoSelecionado}`,
        14,
        29,
      );
      documento.text(
        `Média geral: ${mediaGeralAluno === null ? "Pendente" : mediaGeralAluno.toFixed(1)} | Situação: ${classificacaoAluno.titulo}`,
        14,
        35,
      );
      documento.text(
        `Emitido em ${new Date().toLocaleString("pt-BR")}`,
        larguraPagina - 14,
        15,
        { align: "right" },
      );

      let yAtual = 42;
      filho.disciplinas.forEach((disciplinaAtual, indice) => {
        const mediaDisciplina = calcularMediaFinalParcial(disciplinaAtual);
        const classificacao = obterClassificacao(mediaDisciplina);
        const linhas = (["t1", "t2", "t3"] as Trimestre[]).map(
          (trimestreAtual) => {
            const notas = disciplinaAtual.trimestres[trimestreAtual];
            const mediaAps = calcularMediaAP(notas);
            const npAtual = calcularNP(disciplinaAtual, notas);
            const nprAtual = calcularNPR(disciplinaAtual, notas);
            const considerada = calcularNotaConsiderada(disciplinaAtual, notas);
            return [
              tituloTrimestre(trimestreAtual),
              formatarValorBoletim(notas.ap1),
              formatarValorBoletim(notas.ap2),
              mediaAps === null ? "—" : mediaAps.toFixed(1),
              formatarValorBoletim(notas.gip),
              disciplinaAtual.usaAE ? formatarValorBoletim(notas.ae) : "N/A",
              npAtual === null ? "—" : npAtual.toFixed(1),
              formatarValorBoletim(notas.ar),
              nprAtual === null ? "—" : nprAtual.toFixed(1),
              considerada === null ? "—" : considerada.toFixed(1),
            ];
          },
        );

        if (yAtual > 165) {
          documento.addPage();
          yAtual = 16;
        }

        documento.setFont("helvetica", "bold");
        documento.setFontSize(11);
        documento.text(
          `${disciplinaAtual.nome} — Média: ${mediaDisciplina === null ? "Pendente" : mediaDisciplina.toFixed(1)} — ${classificacao.titulo}`,
          14,
          yAtual,
        );

        documento.autoTable({
          startY: yAtual + 3,
          head: [
            [
              "Trimestre",
              "AP.1",
              "AP.2",
              "Média AP",
              "GIP",
              "AE",
              "NP",
              "AR",
              "NPR",
              "Considerada",
            ],
          ],
          body: linhas,
          margin: { left: 14, right: 14 },
          styles: { fontSize: 7.5, cellPadding: 1.8, halign: "center" },
          headStyles: { fillColor: [0, 55, 176] },
          columnStyles: { 0: { halign: "left", cellWidth: 28 } },
          pageBreak: "avoid",
        });

        const ultimaTabela = (documento as any).lastAutoTable;
        yAtual = (ultimaTabela?.finalY ?? yAtual + 28) + 8;

        if (indice === filho.disciplinas.length - 1) {
          documento.setFont("helvetica", "normal");
          documento.setFontSize(8);
          documento.text(
            "Campos não preenchidos aparecem como —. Disciplinas sem AE exibem N/A. Documento gerado localmente pelo Média CMB.",
            14,
            Math.min(yAtual, 195),
          );
        }
      });

      const blobPdf = documento.output("blob");
      const arquivoPdf = new File([blobPdf], nomeArquivo, {
        type: "application/pdf",
      });
      const navegador = navigator as Navigator & {
        canShare?: (dados?: ShareData) => boolean;
        share?: (dados?: ShareData) => Promise<void>;
      };

      if (
        navegador.share &&
        (!navegador.canShare || navegador.canShare({ files: [arquivoPdf] }))
      ) {
        await navegador.share({
          title: `Boletim de ${filho.nome}`,
          text: `Boletim detalhado de ${filho.nome} — ${anoLetivoSelecionado}`,
          files: [arquivoPdf],
        });
        setMensagem("PDF compartilhado com sucesso.");
        return;
      }

      const urlPdf = URL.createObjectURL(blobPdf);
      const link = document.createElement("a");
      link.href = urlPdf;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(urlPdf), 30000);
      setMensagem(
        "Este navegador não permite compartilhar arquivos diretamente. O PDF foi baixado para você compartilhar pelo WhatsApp ou e-mail.",
      );
    } catch (erro: any) {
      if (erro?.name === "AbortError") {
        setMensagem("Compartilhamento cancelado.");
        return;
      }
      console.log("Erro ao compartilhar boletim:", erro);
      setMensagem(
        "Não foi possível gerar o PDF compartilhável. Verifique a conexão com a internet e tente novamente.",
      );
    }
  }

  function gerarBoletimDetalhado() {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      setMensagem(
        "A geração do boletim em PDF está disponível na versão web/PWA do Média CMB.",
      );
      return;
    }

    const dataEmissao = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const classificacaoAluno = obterClassificacao(mediaGeralAluno);
    const fotoAluno = filho.fotoUri
      ? `<img class="foto-aluno" src="${escaparHtml(filho.fotoUri)}" alt="Foto do aluno" />`
      : `<div class="foto-iniciais">${escaparHtml(obterIniciais(filho.nome))}</div>`;

    const disciplinasHtml = filho.disciplinas
      .map((disciplinaAtual) => {
        const mediaDisciplina = calcularMediaFinalParcial(disciplinaAtual);
        const classificacao = obterClassificacao(mediaDisciplina);

        const linhasTrimestres = (["t1", "t2", "t3"] as Trimestre[])
          .map((trimestreAtual) => {
            const notas = disciplinaAtual.trimestres[trimestreAtual];
            const mediaAps = calcularMediaAP(notas);
            const npAtual = calcularNP(disciplinaAtual, notas);
            const nprAtual = calcularNPR(disciplinaAtual, notas);
            const considerada = calcularNotaConsiderada(disciplinaAtual, notas);

            return `
              <tr>
                <td class="col-trimestre">${escaparHtml(tituloTrimestre(trimestreAtual))}</td>
                <td>${formatarValorBoletim(notas.ap1)}</td>
                <td>${formatarValorBoletim(notas.ap2)}</td>
                <td>${mediaAps === null ? "—" : mediaAps.toFixed(1)}</td>
                <td>${formatarValorBoletim(notas.gip)}</td>
                <td>${disciplinaAtual.usaAE ? formatarValorBoletim(notas.ae) : "N/A"}</td>
                <td>${npAtual === null ? "—" : npAtual.toFixed(1)}</td>
                <td>${formatarValorBoletim(notas.ar)}</td>
                <td>${nprAtual === null ? "—" : nprAtual.toFixed(1)}</td>
                <td class="nota-considerada">${considerada === null ? "—" : considerada.toFixed(1)}</td>
              </tr>`;
          })
          .join("");

        return `
          <section class="disciplina">
            <div class="disciplina-cabecalho">
              <div>
                <div class="disciplina-nome">${escaparHtml(disciplinaAtual.nome)}</div>
                <div class="disciplina-sigla">${escaparHtml(obterSiglaDisciplina(disciplinaAtual.nome))}</div>
              </div>
              <div class="disciplina-resumo">
                <span class="media-disciplina">${mediaDisciplina === null ? "Pendente" : mediaDisciplina.toFixed(1)}</span>
                <span class="situacao-disciplina">${escaparHtml(classificacao.titulo)}</span>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Trimestre</th>
                  <th>AP.1</th>
                  <th>AP.2</th>
                  <th>Média AP</th>
                  <th>GIP</th>
                  <th>AE</th>
                  <th>NP</th>
                  <th>AR</th>
                  <th>NPR</th>
                  <th>Considerada</th>
                </tr>
              </thead>
              <tbody>${linhasTrimestres}</tbody>
            </table>
          </section>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Boletim detalhado - ${escaparHtml(filho.nome)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; }
    .pagina { max-width: 1120px; margin: 0 auto; padding: 24px; }
    .topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom: 4px solid #0037b0; padding-bottom: 16px; }
    .marca h1 { margin: 0; color: #0037b0; font-size: 28px; }
    .marca p { margin: 5px 0 0; color: #64748b; font-size: 13px; }
    .emissao { text-align: right; font-size: 12px; color: #475569; }
    .aluno { margin-top: 18px; display: flex; gap: 16px; align-items: center; padding: 16px; background: #f8fafc; border: 1px solid #dbeafe; border-radius: 14px; }
    .foto-aluno, .foto-iniciais { width: 74px; height: 74px; border-radius: 18px; object-fit: cover; flex: 0 0 auto; }
    .foto-iniciais { display: flex; align-items: center; justify-content: center; background: #0037b0; color: white; font-size: 24px; font-weight: 700; }
    .dados-aluno { flex: 1; }
    .dados-aluno h2 { margin: 0 0 5px; font-size: 23px; }
    .dados-aluno p { margin: 2px 0; color: #475569; font-size: 13px; }
    .resumo-geral { min-width: 150px; text-align: right; }
    .resumo-geral .rotulo { display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: .5px; }
    .resumo-geral .media { display: block; margin-top: 2px; color: #0037b0; font-size: 34px; font-weight: 800; }
    .resumo-geral .status { color: #475569; font-size: 12px; font-weight: 700; }
    .legenda { margin: 14px 0 18px; color: #64748b; font-size: 11px; line-height: 1.5; }
    .disciplina { margin: 0 0 16px; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
    .disciplina-cabecalho { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 11px 13px; background: #eff6ff; border-bottom: 1px solid #bfdbfe; }
    .disciplina-nome { color: #0037b0; font-size: 16px; font-weight: 800; }
    .disciplina-sigla { margin-top: 2px; color: #64748b; font-size: 10px; font-weight: 700; }
    .disciplina-resumo { text-align: right; }
    .media-disciplina { display: block; color: #0037b0; font-size: 20px; font-weight: 800; }
    .situacao-disciplina { color: #475569; font-size: 10px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 7px 5px; text-align: center; font-size: 10px; }
    th:last-child, td:last-child { border-right: 0; }
    tbody tr:last-child td { border-bottom: 0; }
    th { background: #f8fafc; color: #334155; font-size: 9px; text-transform: uppercase; }
    .col-trimestre { width: 15%; text-align: left; font-weight: 700; }
    .nota-considerada { background: #ecfdf5; color: #166534; font-weight: 800; }
    .rodape { margin-top: 18px; padding-top: 12px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 10px; text-align: center; }
    .acoes { position: sticky; top: 0; z-index: 2; display: flex; justify-content: flex-end; gap: 8px; padding: 10px 0; background: rgba(255,255,255,.96); }
    .acoes button { border: 0; border-radius: 10px; padding: 10px 14px; cursor: pointer; font-weight: 700; }
    .imprimir { background: #0037b0; color: white; }
    .fechar { background: #e2e8f0; color: #334155; }
    @page { size: A4 landscape; margin: 10mm; }
    @media print {
      .pagina { max-width: none; padding: 0; }
      .acoes { display: none !important; }
      .disciplina { margin-bottom: 10px; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
    @media (max-width: 700px) {
      .pagina { padding: 12px; }
      .topo, .aluno { flex-direction: column; align-items: flex-start; }
      .emissao, .resumo-geral { text-align: left; }
      .disciplina { overflow-x: auto; }
      table { min-width: 880px; }
    }
  </style>
</head>
<body>
  <main class="pagina">
    <div class="acoes">
      <button class="fechar" onclick="window.close()">Fechar</button>
      <button class="imprimir" onclick="window.print()">Salvar como PDF / Imprimir</button>
    </div>
    <header class="topo">
      <div class="marca">
        <h1>Média CMB</h1>
        <p>Boletim escolar detalhado</p>
      </div>
      <div class="emissao">
        <strong>Emitido em</strong><br />${escaparHtml(dataEmissao)}
      </div>
    </header>
    <section class="aluno">
      ${fotoAluno}
      <div class="dados-aluno">
        <h2>${escaparHtml(filho.nome)}</h2>
        <p><strong>Série:</strong> ${escaparHtml(obterRotuloSerie(filho.serie))}</p>
        <p><strong>Turma:</strong> ${escaparHtml(filho.turma)} &nbsp; <strong>Ano letivo:</strong> ${escaparHtml(anoLetivoSelecionado)}</p>
      </div>
      <div class="resumo-geral">
        <span class="rotulo">Média geral</span>
        <span class="media">${mediaGeralAluno === null ? "Pendente" : mediaGeralAluno.toFixed(1)}</span>
        <span class="status">${escaparHtml(classificacaoAluno.titulo)} — ${escaparHtml(classificacaoAluno.mensagem)}</span>
      </div>
    </section>
    <div class="legenda">
      Campos ainda não preenchidos aparecem como “—”. Disciplinas sem AE exibem “N/A”. A nota considerada corresponde ao maior valor entre NP e NPR quando houver recuperação.
    </div>
    ${disciplinasHtml}
    <footer class="rodape">
      Relatório gerado localmente pelo Média CMB. Nenhum dado deste boletim foi enviado para servidor.
    </footer>
  </main>
</body>
</html>`;

    const arquivoHtml = new Blob([html], {
      type: "text/html;charset=utf-8",
    });
    const urlBoletim = URL.createObjectURL(arquivoHtml);
    const janelaBoletim = window.open(urlBoletim, "_blank");

    if (!janelaBoletim) {
      URL.revokeObjectURL(urlBoletim);
      setMensagem(
        "O navegador bloqueou a abertura do boletim. Permita pop-ups para o Média CMB e tente novamente.",
      );
      return;
    }

    window.setTimeout(() => URL.revokeObjectURL(urlBoletim), 60000);
    setMensagem(
      "Boletim aberto em uma nova aba. Use “Salvar como PDF / Imprimir” para gerar o arquivo.",
    );
  }

  function renderInicio() {
    const totalAlertasFamilia = resumoGeralAlunos.reduce(
      (total, item) => total + item.emAtencao,
      0,
    );
    const alunosSemNotasFamilia = resumoGeralAlunos.filter(
      (item) => item.media === null,
    ).length;

    return (
      <>
        <View style={styles.topoInicioFamiliaNovo}>
          <View style={styles.marcaInicioFamiliaNovo}>
            <Image
              source={require("../../assets/images/Icon-512-cmb.png")}
              style={styles.logoInicioFamiliaNovo}
            />
            <View style={styles.textosMarcaInicioNovo}>
              <Text style={styles.tituloMarcaInicioNovo}>Média CMB</Text>
              <Text style={styles.subtituloMarcaInicioNovo}>
                Acompanhamento de notas e desempenho escolar
              </Text>
            </View>
          </View>

        </View>

        <View style={styles.cardBoasVindasFamiliaNovo}>
          <Text style={styles.saudacaoFamiliaNovo}>Olá!</Text>
          <Text style={styles.descricaoFamiliaNovo}>
            Neste app você consegue lançar, consultar e simular notas e cenários, gerenciando de forma efetiva as médias, metas e resultados escolares.
          </Text>

          <View style={styles.gradeResumoFamiliaNovo}>
            <View style={styles.cardResumoFamiliaNovo}>
              <Text style={styles.rotuloResumoFamiliaNovo}>Alunos</Text>
              <Text style={styles.valorResumoFamiliaNovo}>{filhos.length}</Text>
              <Text style={styles.subResumoFamiliaNovo}>cadastrados</Text>
            </View>

            <View style={styles.cardResumoFamiliaNovo}>
              <Text style={styles.rotuloResumoFamiliaNovo}>Alertas</Text>
              <Text style={styles.valorResumoFamiliaNovo}>
                {totalAlertasFamilia}
              </Text>
              <Text style={styles.subResumoFamiliaNovo}>
                disciplinas abaixo de 6
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.blocoAcoesFamiliaNovo}>
          <Text style={styles.tituloSecaoInicioNovo}>Ações rápidas</Text>
          <View style={styles.linhaAcoesFamiliaNovo}>
            <Pressable
              style={styles.acaoRapidaFamiliaNovo}
              onPress={abrirNovoFilho}
            >
              <Text style={styles.iconeAcaoFamiliaNovo}>＋</Text>
              <Text style={styles.textoAcaoFamiliaNovo}>Adicionar</Text>
            </Pressable>

            <Pressable
              style={styles.acaoRapidaFamiliaNovo}
              onPress={() => {
                setVisualizacaoNotas("visao");
                setAbaAtiva("notas");
              }}
            >
              <Text style={styles.iconeAcaoFamiliaNovo}>★</Text>
              <Text style={styles.textoAcaoFamiliaNovo}>Notas</Text>
            </Pressable>

            <Pressable
              style={styles.acaoRapidaFamiliaNovo}
              onPress={() => setAbaAtiva("planejamento")}
            >
              <Text style={styles.iconeAcaoFamiliaNovo}>□</Text>
              <Text style={styles.textoAcaoFamiliaNovo}>Planejar</Text>
            </Pressable>

            <Pressable
              style={styles.acaoRapidaFamiliaNovo}
              onPress={() => void compartilharBoletimPdf()}
            >
              <Text style={styles.iconeAcaoFamiliaNovo}>▤</Text>
              <Text style={styles.textoAcaoFamiliaNovo}>Boletim PDF</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.cabecalhoAlunoAtivoInicioNovo}>
          <View>
            <Text style={styles.tituloSecaoInicioNovo}>Aluno selecionado</Text>
            <Text style={styles.subtituloAlunoAtivoInicioNovo}>
              Arraste para o lado para trocar de aluno.
            </Text>
          </View>
          <Text style={styles.contadorAlunoAtivoInicioNovo}>
            {Math.max(
              1,
              resumoGeralAlunos.findIndex(
                (item) => item.index === filhoSelecionado,
              ) + 1,
            )}
            /{resumoGeralAlunos.length}
          </Text>
        </View>

        <ScrollView
          ref={carrosselInicioRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={larguraCardAlunoInicio + 12}
          decelerationRate="fast"
          disableIntervalMomentum
          style={styles.carrosselAlunoAtivoInicioNovo}
          contentContainerStyle={styles.conteudoCarrosselAlunoAtivoInicioNovo}
          onContentSizeChange={() => {
            const posicaoSelecionada = resumoGeralAlunos.findIndex(
              (item) => item.index === filhoSelecionado,
            );
            if (posicaoSelecionada >= 0) {
              carrosselInicioRef.current?.scrollTo({
                x: posicaoSelecionada * (larguraCardAlunoInicio + 12),
                animated: false,
              });
            }
          }}
          onMomentumScrollEnd={(evento) => {
            const posicao = evento.nativeEvent.contentOffset.x;
            const indiceVisual = Math.round(
              posicao / (larguraCardAlunoInicio + 12),
            );
            const itemSelecionado = resumoGeralAlunos[indiceVisual];

            if (!itemSelecionado) return;

            setFilhoSelecionado(itemSelecionado.index);
            setAnoLetivoSelecionado(itemSelecionado.anoAtivo);
            setDisciplinaSelecionada(0);
            setTrimestreSelecionado("t1");
            setMensagem(
              `${itemSelecionado.aluno.nome} selecionado para as próximas ações.`,
            );
          }}
        >
          {resumoGeralAlunos.map((item) => {
            const selecionado = item.index === filhoSelecionado;

            return (
              <Pressable
                key={item.aluno.id}
                style={[
                  styles.cardDestaqueFamiliaNovo,
                  { width: larguraCardAlunoInicio },
                  selecionado && styles.cardAlunoAtivoSelecionadoInicioNovo,
                ]}
                onPress={() => {
                  setFilhoSelecionado(item.index);
                  setAnoLetivoSelecionado(item.anoAtivo);
                  setDisciplinaSelecionada(0);
                  setTrimestreSelecionado("t1");
                  setMensagem(
                    `${item.aluno.nome} selecionado para as próximas ações.`,
                  );
                }}
              >
                <View style={styles.avatarDestaqueFamiliaNovo}>
                  {item.aluno.fotoUri ? (
                    <Image
                      source={{ uri: item.aluno.fotoUri }}
                      style={styles.avatarImagemDestaqueFamiliaNovo}
                    />
                  ) : (
                    <Text style={styles.avatarTextoDestaqueFamiliaNovo}>
                      {obterIniciais(item.aluno.nome)}
                    </Text>
                  )}
                </View>

                <View style={styles.infoDestaqueFamiliaNovo}>
                  <Text style={styles.rotuloDestaqueFamiliaNovo}>
                    {selecionado ? "Aluno ativo" : "Toque para selecionar"}
                  </Text>
                  <Text style={styles.nomeDestaqueFamiliaNovo} numberOfLines={1}>
                    {item.aluno.nome}
                  </Text>
                  <Text style={styles.dadosDestaqueFamiliaNovo} numberOfLines={1}>
                    {obterRotuloSerie(item.aluno.serie)} • Turma{" "}
                    {item.aluno.turma} • {item.anoAtivo}
                  </Text>
                </View>

                <View style={styles.mediaDestaqueFamiliaNovo}>
                  <Text
                    style={[
                      styles.mediaDestaqueValorNovo,
                      { color: item.classificacao.corTexto },
                    ]}
                  >
                    {mostrarNota(item.media)}
                  </Text>
                  <Text style={styles.mediaDestaqueRotuloNovo}>média</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.indicadoresAlunoAtivoInicioNovo}>
          {resumoGeralAlunos.map((item) => (
            <View
              key={item.aluno.id}
              style={[
                styles.indicadorAlunoAtivoInicioNovo,
                item.index === filhoSelecionado &&
                  styles.indicadorAlunoAtivoSelecionadoInicioNovo,
              ]}
            />
          ))}
        </View>

        <View style={styles.cabecalhoListaFamiliaNovo}>
          <View style={styles.titulosListaFamiliaNovo}>
            <Text style={styles.tituloSecaoInicioNovo}>Seus alunos</Text>
            <Text style={styles.subtituloSecaoInicioNovo}>
              Toque em um aluno para abrir o acompanhamento.
            </Text>
          </View>
          <Pressable onPress={() => setAbaAtiva("alunos")}>
            <Text style={styles.linkVerTodosFamiliaNovo}>Gerenciar</Text>
          </Pressable>
        </View>

        <View style={styles.listaCompactaFamiliaNovo}>
          {resumoGeralAlunos.map((item) => (
            <Pressable
              key={item.aluno.id}
              style={styles.cardAlunoFamiliaNovo}
              onPress={() => abrirAlunoNoPainel(item.index)}
            >
              <View
                style={[
                  styles.avatarAlunoFamiliaNovo,
                  { backgroundColor: item.classificacao.corAvatar },
                ]}
              >
                {item.aluno.fotoUri ? (
                  <Image
                    source={{ uri: item.aluno.fotoUri }}
                    style={styles.avatarImagemAlunoFamiliaNovo}
                  />
                ) : (
                  <Text style={styles.avatarTextoAlunoFamiliaNovo}>
                    {obterIniciais(item.aluno.nome)}
                  </Text>
                )}
              </View>

              <View style={styles.infoAlunoFamiliaNovo}>
                <Text style={styles.nomeAlunoFamiliaNovo} numberOfLines={1}>
                  {item.aluno.nome}
                </Text>
                <Text style={styles.dadosAlunoFamiliaNovo} numberOfLines={1}>
                  {obterRotuloSerie(item.aluno.serie)} • Turma{" "}
                  {item.aluno.turma} • {item.anoAtivo}
                </Text>
                <Text
                  style={[
                    styles.statusAlunoFamiliaNovo,
                    { color: item.classificacao.corTexto },
                  ]}
                  numberOfLines={1}
                >
                  {item.emAtencao > 0
                    ? `${item.emAtencao} disciplina(s) em atenção`
                    : item.disciplinasComNota > 0
                      ? item.classificacao.titulo
                      : "Sem notas lançadas"}
                </Text>
              </View>

              <View style={styles.areaMediaAlunoFamiliaNovo}>
                <Text
                  style={[
                    styles.mediaAlunoFamiliaNovo,
                    { color: item.classificacao.corTexto },
                  ]}
                >
                  {mostrarNota(item.media)}
                </Text>
                <Text style={styles.rotuloMediaAlunoFamiliaNovo}>média</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {alunosSemNotasFamilia > 0 ? (
          <View style={styles.avisoInicioFamiliaNovo}>
            <Text style={styles.avisoInicioFamiliaTextoNovo}>
              {alunosSemNotasFamilia} aluno(s) ainda não possuem notas lançadas.
            </Text>
          </View>
        ) : null}
      </>
    );
  }

  function renderSeletorVisualizacaoNotas() {
    return (
      <View style={styles.seletorVisualizacaoNotasNovo}>
        <Pressable
          style={[
            styles.botaoVisualizacaoNotasNovo,
            visualizacaoNotas === "visao" &&
              styles.botaoVisualizacaoNotasAtivoNovo,
          ]}
          onPress={() => setVisualizacaoNotas("visao")}
        >
          <Text
            style={[
              styles.textoVisualizacaoNotasNovo,
              visualizacaoNotas === "visao" &&
                styles.textoVisualizacaoNotasAtivoNovo,
            ]}
          >
            Visão geral
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.botaoVisualizacaoNotasNovo,
            visualizacaoNotas === "lancamento" &&
              styles.botaoVisualizacaoNotasAtivoNovo,
          ]}
          onPress={() => setVisualizacaoNotas("lancamento")}
        >
          <Text
            style={[
              styles.textoVisualizacaoNotasNovo,
              visualizacaoNotas === "lancamento" &&
                styles.textoVisualizacaoNotasAtivoNovo,
            ]}
          >
            Lançar notas
          </Text>
        </Pressable>
      </View>
    );
  }

  function renderVisaoGeralNotas() {
    return (
      <>
        <View style={styles.cardCabecalhoVisaoNotasNovo}>
          <View style={styles.linhaCabecalhoVisaoNotasNovo}>
            <View style={styles.infoCabecalhoVisaoNotasNovo}>
              <Text style={styles.labelHeroNovo}>Visão geral</Text>
              <Text style={styles.tituloVisaoNotasNovo}>{filho.nome}</Text>
              <Text style={styles.subtituloVisaoNotasNovo}>
                {obterRotuloSerie(filho.serie)} • Turma {filho.turma} • {anoLetivoSelecionado}
              </Text>
            </View>
            <View style={styles.badgeMediaVisaoNotasNovo}>
              <Text style={styles.badgeMediaVisaoNotasLabelNovo}>Média geral</Text>
              <Text
                style={[
                  styles.badgeMediaVisaoNotasValorNovo,
                  { color: classificacaoGeral.corTexto },
                ]}
              >
                {mostrarNota(mediaGeralAluno)}
              </Text>
            </View>
          </View>

          <Text style={styles.textoExplicativoVisaoNotasNovo}>
            A média geral considera todas as notas periódicas já lançadas nas disciplinas do aluno.
          </Text>
        </View>

        {renderSeletorVisualizacaoNotas()}

        <View style={styles.blocoSelecaoNovo}>
          <Text style={styles.labelSelecaoNovo}>Trimestre para consulta</Text>
          <View style={styles.trimestresNovo}>
            {(["t1", "t2", "t3"] as Trimestre[]).map((trimestreItem) => (
              <Pressable
                key={trimestreItem}
                style={[
                  styles.trimestreBotaoNovo,
                  trimestreSelecionado === trimestreItem &&
                    styles.trimestreBotaoAtivoNovo,
                ]}
                onPress={() => setTrimestreSelecionado(trimestreItem)}
              >
                <Text
                  style={[
                    styles.trimestreTextoNovo,
                    trimestreSelecionado === trimestreItem &&
                      styles.trimestreTextoAtivoNovo,
                  ]}
                >
                  {tituloTrimestre(trimestreItem)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.gradeVisaoDisciplinasNovo}>
          {resumoDisciplinas.map((item, index) => {
            const disciplinaAtual = filho.disciplinas[index];
            const notaTrimestre = calcularNotaConsiderada(
              disciplinaAtual,
              disciplinaAtual.trimestres[trimestreSelecionado],
            );

            return (
              <Pressable
                key={item.nome}
                style={[
                  styles.cardVisaoDisciplinaNovo,
                  {
                    width: larguraCardVisaoNotas,
                    backgroundColor: item.classificacao.corFundo,
                    borderColor: item.classificacao.corBorda,
                  },
                ]}
                onPress={() => {
                  setDisciplinaSelecionada(index);
                  setVisualizacaoNotas("lancamento");
                }}
              >
                <Text
                  style={[
                    styles.siglaVisaoDisciplinaNovo,
                    { color: item.classificacao.corTexto },
                  ]}
                >
                  {item.sigla}
                </Text>
                <Text
                  style={[
                    styles.mediaVisaoDisciplinaNovo,
                    { color: item.classificacao.corTexto },
                  ]}
                >
                  {mostrarNota(item.media)}
                </Text>
                <Text
                  style={[
                    styles.statusVisaoDisciplinaNovo,
                    { color: item.classificacao.corTexto },
                  ]}
                  numberOfLines={1}
                >
                  {item.classificacao.titulo}
                </Text>
                <View style={styles.divisorCardVisaoDisciplinaNovo} />
                <Text style={styles.notaTrimestreVisaoDisciplinaNovo}>
                  {tituloTrimestre(trimestreSelecionado)}: {mostrarNota(notaTrimestre)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.caixaDicaVisaoNotasNovo}>
          <Text style={styles.caixaDicaVisaoNotasTextoNovo}>
            Toque em uma disciplina para abrir diretamente o lançamento detalhado das notas.
          </Text>
        </View>
      </>
    );
  }

  function renderNotas() {
    if (visualizacaoNotas === "visao") return renderVisaoGeralNotas();

    return (
      <>
        {renderSeletorVisualizacaoNotas()}
        {renderLancamentoNotas()}
      </>
    );
  }

  function renderLancamentoNotas() {
    return (
      <>
        <View style={styles.cardNotasAlunoNovo}>
          <View>
            <Text style={styles.labelHeroNovo}>Estudante</Text>
            <Text style={styles.nomeNotasAlunoNovo}>{filho.nome}</Text>
            <Text style={styles.dadosAlunoHeroNovo}>
              {obterRotuloSerie(filho.serie)} • Turma {filho.turma}
            </Text>
          </View>

          <View style={styles.badgeMediaNotasNovo}>
            <Text style={styles.badgeMediaTextoNovo}>
              {mostrarNota(mediaGeralAluno)}
            </Text>
            <Text style={styles.badgeMediaSubNovo}>Média geral</Text>
          </View>
        </View>

        <View style={styles.blocoSelecaoNovo}>
          <Text style={styles.labelSelecaoNovo}>Trimestre</Text>
          <View style={styles.trimestresNovo}>
            {(["t1", "t2", "t3"] as Trimestre[]).map((trimestreItem) => (
              <Pressable
                key={trimestreItem}
                style={[
                  styles.trimestreBotaoNovo,
                  trimestreSelecionado === trimestreItem &&
                    styles.trimestreBotaoAtivoNovo,
                ]}
                onPress={() => setTrimestreSelecionado(trimestreItem)}
              >
                <Text
                  style={[
                    styles.trimestreTextoNovo,
                    trimestreSelecionado === trimestreItem &&
                      styles.trimestreTextoAtivoNovo,
                  ]}
                >
                  {tituloTrimestre(trimestreItem)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.blocoSelecaoNovo}>
          <Text style={styles.labelSelecaoNovo}>Disciplina</Text>
          <View style={styles.listaBotoes}>
            {filho.disciplinas.map((item, index) => (
              <Pressable
                key={item.nome}
                style={[
                  styles.chipDisciplinaNovo,
                  disciplinaSelecionada === index &&
                    styles.chipDisciplinaAtivoNovo,
                ]}
                onPress={() => setDisciplinaSelecionada(index)}
              >
                <Text
                  style={[
                    styles.chipDisciplinaTextoNovo,
                    disciplinaSelecionada === index &&
                      styles.chipDisciplinaTextoAtivoNovo,
                  ]}
                >
                  {obterSiglaDisciplina(item.nome)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.cardNotasNovo}>
          <View style={styles.cardNotasTopoNovo}>
            <View>
              <Text style={styles.tituloDisciplinaNotasNovo}>
                {disciplina.nome}
              </Text>
              <Text style={styles.subtituloDisciplinaNotasNovo}>
                {tituloTrimestre(trimestreSelecionado)}
              </Text>
            </View>

            <Text style={styles.badgeSerieNovo}>
              {obterSiglaDisciplina(disciplina.nome)}
            </Text>
          </View>

          <View style={styles.divisorNotasNovo} />

          <Text style={styles.labelSelecaoNovo}>Avaliações periódicas</Text>

          <View style={styles.linhaInputsNotasNovo}>
            <View style={styles.caixaNotaEditavelNovo}>
              <Text style={styles.miniLabelNotasNovo}>{nomeAP}.1</Text>
              <TextInput
                style={styles.inputNotaGrandeNovo}
                value={trimestre.ap1}
                onChangeText={(valor) => atualizarCampo("ap1", valor)}
                keyboardType="decimal-pad"
                placeholder="0,0"
                placeholderTextColor="#cbd5e1"
              />
            </View>

            <View style={styles.caixaNotaEditavelNovo}>
              <Text style={styles.miniLabelNotasNovo}>{nomeAP}.2</Text>
              <TextInput
                style={styles.inputNotaGrandeNovo}
                value={trimestre.ap2}
                onChangeText={(valor) => atualizarCampo("ap2", valor)}
                keyboardType="decimal-pad"
                placeholder="0,0"
                placeholderTextColor="#cbd5e1"
              />
            </View>
          </View>

          <View style={styles.linhaResumoNotasNovo}>
            <Text style={styles.resumoNotasLabelNovo}>Média das APs</Text>
            <Text style={styles.resumoNotasValorNovo}>
              {mostrarNota(mediaAP)}
            </Text>
          </View>

          <Text style={styles.labelSelecaoNovo}>
            GIP - Incentivo de Participação
          </Text>

          <View style={styles.caixaGipNovo}>
            <Text style={styles.gipLabelNovo}>Pontuação adicional</Text>
            <TextInput
              style={styles.inputGipNovo}
              value={trimestre.gip}
              onChangeText={(valor) => atualizarCampo("gip", valor)}
              keyboardType="decimal-pad"
              placeholder="+0,0"
              placeholderTextColor="#94a3b8"
            />
          </View>

          {disciplina.usaAE ? (
            <>
              <Text style={styles.labelSelecaoNovo}>
                AE - Avaliação de Estudo
              </Text>

              <View style={styles.caixaNotaEditavelCheiaNovo}>
                <Text style={styles.miniLabelNotasNovo}>Nota da AE</Text>
                <TextInput
                  style={styles.inputNotaGrandeNovo}
                  value={trimestre.ae}
                  onChangeText={(valor) => atualizarCampo("ae", valor)}
                  keyboardType="decimal-pad"
                  placeholder="0,0"
                  placeholderTextColor="#cbd5e1"
                />
              </View>
            </>
          ) : (
            <View style={styles.caixaInfoNotasNovo}>
              <Text style={styles.infoNotasTextoNovo}>
                Esta disciplina não possui AE. A NP será calculada pela média
                das APs + GIP.
              </Text>
            </View>
          )}

          <View style={styles.caixaNpNovo}>
            <View>
              <Text style={styles.npLabelNovo}>NP</Text>
              <Text style={styles.npSubNovo}>Nota periódica do trimestre</Text>
            </View>

            <Text style={styles.npValorNovo}>{mostrarNota(np)}</Text>
          </View>

          <Text style={styles.labelSelecaoNovo}>
            AR - Avaliação de Recuperação
          </Text>

          <View style={styles.caixaNotaEditavelCheiaNovo}>
            <Text style={styles.miniLabelNotasNovo}>Nota da AR</Text>
            <TextInput
              style={styles.inputNotaGrandeNovo}
              value={trimestre.ar}
              onChangeText={(valor) => atualizarCampo("ar", valor)}
              keyboardType="decimal-pad"
              placeholder="Opcional"
              placeholderTextColor="#cbd5e1"
            />
          </View>

          <View style={styles.gridResultadoNotasNovo}>
            <View style={styles.caixaResultadoPequenaNovo}>
              <Text style={styles.resultadoPequenoLabelNovo}>NPR</Text>
              <Text style={styles.resultadoPequenoValorNovo}>
                {mostrarNota(npr)}
              </Text>
            </View>

            <View style={styles.caixaResultadoPequenaNovo}>
              <Text style={styles.resultadoPequenoLabelNovo}>
                Nota considerada
              </Text>
              <Text style={styles.resultadoPequenoValorNovo}>
                {mostrarNota(notaConsiderada)}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.cardResumoDisciplinaNovo,
            {
              backgroundColor: classificacaoDisciplina.corFundo,
              borderColor: classificacaoDisciplina.corBorda,
            },
          ]}
        >
          <Text style={styles.labelHeroNovo}>Resumo da disciplina</Text>

          <Text
            style={[
              styles.mediaResumoDisciplinaNovo,
              { color: classificacaoDisciplina.corTexto },
            ]}
          >
            {mostrarNota(mediaFinalParcial)}
          </Text>

          <Text
            style={[
              styles.statusResumoDisciplinaNovo,
              { color: classificacaoDisciplina.corTexto },
            ]}
          >
            {classificacaoDisciplina.titulo} —{" "}
            {classificacaoDisciplina.mensagem}
          </Text>

          <Text style={styles.infoResumoDisciplinaNovo}>
            {calcularNecessidadeFinal(disciplina, 6.0)}
          </Text>
        </View>
      </>
    );
  }

  function renderPlanejamento() {
    return (
      <>
        <View style={styles.cardPlanejamentoTopoNovo}>
          <Text style={styles.labelHeroNovo}>Planejamento</Text>
          <Text style={styles.tituloPlanejamentoNovo}>
            Quanto precisa tirar na AE?
          </Text>
          <Text style={styles.infoPlanejamentoNovo}>
            Informe a NP desejada no trimestre. O app calcula a nota mínima
            necessária na AE considerando as APs e o GIP já lançados.
          </Text>
        </View>

        <View style={styles.blocoSelecaoNovo}>
          <Text style={styles.labelSelecaoNovo}>Disciplina</Text>
          <View style={styles.listaBotoes}>
            {filho.disciplinas.map((item, index) => (
              <Pressable
                key={item.nome}
                style={[
                  styles.chipDisciplinaNovo,
                  disciplinaSelecionada === index &&
                    styles.chipDisciplinaAtivoNovo,
                ]}
                onPress={() => setDisciplinaSelecionada(index)}
              >
                <Text
                  style={[
                    styles.chipDisciplinaTextoNovo,
                    disciplinaSelecionada === index &&
                      styles.chipDisciplinaTextoAtivoNovo,
                  ]}
                >
                  {obterSiglaDisciplina(item.nome)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.blocoSelecaoNovo}>
          <Text style={styles.labelSelecaoNovo}>Trimestre</Text>
          <View style={styles.trimestresNovo}>
            {(["t1", "t2", "t3"] as Trimestre[]).map((trimestreItem) => (
              <Pressable
                key={trimestreItem}
                style={[
                  styles.trimestreBotaoNovo,
                  trimestreSelecionado === trimestreItem &&
                    styles.trimestreBotaoAtivoNovo,
                ]}
                onPress={() => setTrimestreSelecionado(trimestreItem)}
              >
                <Text
                  style={[
                    styles.trimestreTextoNovo,
                    trimestreSelecionado === trimestreItem &&
                      styles.trimestreTextoAtivoNovo,
                  ]}
                >
                  {tituloTrimestre(trimestreItem)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.cardPlanejamentoNovo}>
          <View style={styles.cardNotasTopoNovo}>
            <View>
              <Text style={styles.tituloDisciplinaNotasNovo}>
                {disciplina.nome}
              </Text>
              <Text style={styles.subtituloDisciplinaNotasNovo}>
                {tituloTrimestre(trimestreSelecionado)}
              </Text>
            </View>

            <Text style={styles.badgeSerieNovo}>
              {obterSiglaDisciplina(disciplina.nome)}
            </Text>
          </View>

          <View style={styles.divisorNotasNovo} />

          {disciplina.usaAE ? (
            <>
              <View style={styles.resumoPlanejamentoNovo}>
                <View style={styles.itemResumoPlanejamentoNovo}>
                  <Text style={styles.resumoPlanejamentoLabelNovo}>
                    Média das APs
                  </Text>
                  <Text style={styles.resumoPlanejamentoValorNovo}>
                    {mostrarNota(mediaAP)}
                  </Text>
                </View>

                <View style={styles.itemResumoPlanejamentoNovo}>
                  <Text style={styles.resumoPlanejamentoLabelNovo}>
                    GIP informado
                  </Text>
                  <Text style={styles.resumoPlanejamentoValorNovo}>
                    {trimestre.gip || "0"}
                  </Text>
                </View>
              </View>

              <Text style={styles.labelSelecaoNovo}>
                NP desejada neste trimestre
              </Text>

              <View style={styles.caixaNpDesejadaNovo}>
                <TextInput
                  style={styles.inputNpDesejadaNovo}
                  value={npDesejada}
                  onChangeText={(valor) =>
                    setNpDesejada(normalizarEntradaNota(valor))
                  }
                  keyboardType="decimal-pad"
                  placeholder="Ex.: 8,0"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.caixaResultadoPlanejamentoNovo}>
                <Text style={styles.resultadoPlanejamentoLabelNovo}>
                  Resultado do planejamento
                </Text>

                <Text style={styles.resultadoPlanejamentoTextoNovo}>
                  {calcularAENecessaria(
                    disciplina,
                    trimestre,
                    npDesejadaNumero,
                  )}
                </Text>
              </View>

              <View style={styles.caixaAvisoPlanejamentoNovo}>
                <Text style={styles.avisoPlanejamentoTextoNovo}>
                  Dica: se ainda não lançou as APs, preencha primeiro a aba
                  Notas para o cálculo ficar correto.
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.caixaInfoNotasNovo}>
              <Text style={styles.infoNotasTextoNovo}>
                Esta disciplina não usa AE. Para melhorar a NP, foque nas APs e
                no GIP.
              </Text>
            </View>
          )}
        </View>
      </>
    );
  }

  function renderSimulador() {
    const resultadoMeta =
      mediaAnualSimulada === null
        ? "Preencha as notas hipotéticas para calcular a projeção."
        : diferencaMetaSimulador !== null && diferencaMetaSimulador >= 0
          ? `Meta atingida com margem de ${diferencaMetaSimulador.toFixed(1)} ponto(s).`
          : `Faltam ${Math.abs(diferencaMetaSimulador ?? 0).toFixed(1)} ponto(s) para a meta.`;

    return (
      <>
        <View style={styles.cardSimuladorTopoNovo}>
          <Text style={styles.labelHeroNovo}>Simulador de notas</Text>
          <Text style={styles.tituloSimuladorNovo}>
            Teste cenários sem alterar as notas reais
          </Text>
          <Text style={styles.infoSimuladorNovo}>
            Escolha uma disciplina e um trimestre. Os valores informados aqui
            são temporários e não são gravados no cadastro do aluno.
          </Text>
        </View>

        <View style={styles.blocoSelecaoNovo}>
          <Text style={styles.labelSelecaoNovo}>Disciplina</Text>
          <View style={styles.listaBotoes}>
            {filho.disciplinas.map((item, index) => (
              <Pressable
                key={item.nome}
                style={[
                  styles.chipDisciplinaNovo,
                  disciplinaSimulador === index &&
                    styles.chipDisciplinaAtivoNovo,
                ]}
                onPress={() => trocarDisciplinaSimulador(index)}
              >
                <Text
                  style={[
                    styles.chipDisciplinaTextoNovo,
                    disciplinaSimulador === index &&
                      styles.chipDisciplinaTextoAtivoNovo,
                  ]}
                >
                  {obterSiglaDisciplina(item.nome)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.blocoSelecaoNovo}>
          <Text style={styles.labelSelecaoNovo}>Trimestre</Text>
          <View style={styles.trimestresNovo}>
            {(["t1", "t2", "t3"] as Trimestre[]).map((item) => (
              <Pressable
                key={item}
                style={[
                  styles.trimestreBotaoNovo,
                  trimestreSimulador === item && styles.trimestreBotaoAtivoNovo,
                ]}
                onPress={() => trocarTrimestreSimulador(item)}
              >
                <Text
                  style={[
                    styles.trimestreTextoNovo,
                    trimestreSimulador === item &&
                      styles.trimestreTextoAtivoNovo,
                  ]}
                >
                  {tituloTrimestre(item)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.cardSimuladorNovo}>
          <View style={styles.cardNotasTopoNovo}>
            <View>
              <Text style={styles.tituloDisciplinaNotasNovo}>
                {disciplinaBaseSimulador.nome}
              </Text>
              <Text style={styles.subtituloDisciplinaNotasNovo}>
                {tituloTrimestre(trimestreSimulador)} • cenário hipotético
              </Text>
            </View>
            <Text style={styles.badgeSerieNovo}>
              {obterSiglaDisciplina(disciplinaBaseSimulador.nome)}
            </Text>
          </View>

          <View style={styles.divisorNotasNovo} />

          <View style={styles.acoesSimuladorNovo}>
            <Pressable
              style={styles.botaoCarregarSimuladorNovo}
              onPress={carregarNotasAtuaisNoSimulador}
            >
              <Text style={styles.botaoCarregarSimuladorTextoNovo}>
                Usar notas atuais
              </Text>
            </Pressable>
            <Pressable
              style={styles.botaoLimparSimuladorNovo}
              onPress={limparSimulacao}
            >
              <Text style={styles.botaoLimparSimuladorTextoNovo}>Limpar</Text>
            </Pressable>
          </View>

          <Text style={styles.labelSelecaoNovo}>Avaliações periódicas</Text>
          <View style={styles.linhaInputsNotasNovo}>
            <View style={styles.caixaNotaEditavelNovo}>
              <Text style={styles.miniLabelNotasNovo}>
                {prefixoAP(trimestreSimulador)}.1
              </Text>
              <TextInput
                style={styles.inputNotaGrandeNovo}
                value={notasSimuladas.ap1}
                onChangeText={(valor) => atualizarCampoSimulacao("ap1", valor)}
                keyboardType="decimal-pad"
                placeholder="0,0"
                placeholderTextColor="#cbd5e1"
              />
            </View>
            <View style={styles.caixaNotaEditavelNovo}>
              <Text style={styles.miniLabelNotasNovo}>
                {prefixoAP(trimestreSimulador)}.2
              </Text>
              <TextInput
                style={styles.inputNotaGrandeNovo}
                value={notasSimuladas.ap2}
                onChangeText={(valor) => atualizarCampoSimulacao("ap2", valor)}
                keyboardType="decimal-pad"
                placeholder="0,0"
                placeholderTextColor="#cbd5e1"
              />
            </View>
          </View>

          <View style={styles.linhaResumoNotasNovo}>
            <Text style={styles.resumoNotasLabelNovo}>
              Média simulada das APs
            </Text>
            <Text style={styles.resumoNotasValorNovo}>
              {mostrarNota(mediaAPSimulada)}
            </Text>
          </View>

          <Text style={styles.labelSelecaoNovo}>GIP</Text>
          <View style={styles.caixaGipNovo}>
            <Text style={styles.gipLabelNovo}>
              Pontuação adicional hipotética
            </Text>
            <TextInput
              style={styles.inputGipNovo}
              value={notasSimuladas.gip}
              onChangeText={(valor) => atualizarCampoSimulacao("gip", valor)}
              keyboardType="decimal-pad"
              placeholder="+0,0"
              placeholderTextColor="#94a3b8"
            />
          </View>

          {disciplinaBaseSimulador.usaAE ? (
            <>
              <Text style={styles.labelSelecaoNovo}>AE</Text>
              <View style={styles.caixaNotaEditavelCheiaNovo}>
                <Text style={styles.miniLabelNotasNovo}>
                  Nota hipotética da AE
                </Text>
                <TextInput
                  style={styles.inputNotaGrandeNovo}
                  value={notasSimuladas.ae}
                  onChangeText={(valor) => atualizarCampoSimulacao("ae", valor)}
                  keyboardType="decimal-pad"
                  placeholder="0,0"
                  placeholderTextColor="#cbd5e1"
                />
              </View>
            </>
          ) : (
            <View style={styles.caixaInfoNotasNovo}>
              <Text style={styles.infoNotasTextoNovo}>
                Esta disciplina não utiliza AE.
              </Text>
            </View>
          )}

          <Text style={styles.labelSelecaoNovo}>AR</Text>
          <View style={styles.caixaNotaEditavelCheiaNovo}>
            <Text style={styles.miniLabelNotasNovo}>Nota hipotética da AR</Text>
            <TextInput
              style={styles.inputNotaGrandeNovo}
              value={notasSimuladas.ar}
              onChangeText={(valor) => atualizarCampoSimulacao("ar", valor)}
              keyboardType="decimal-pad"
              placeholder="Opcional"
              placeholderTextColor="#cbd5e1"
            />
          </View>

          <View style={styles.gridResultadoSimuladorNovo}>
            <View style={styles.caixaResultadoPequenaNovo}>
              <Text style={styles.resultadoPequenoLabelNovo}>NP simulada</Text>
              <Text style={styles.resultadoPequenoValorNovo}>
                {mostrarNota(npSimulada)}
              </Text>
            </View>
            <View style={styles.caixaResultadoPequenaNovo}>
              <Text style={styles.resultadoPequenoLabelNovo}>NPR simulada</Text>
              <Text style={styles.resultadoPequenoValorNovo}>
                {mostrarNota(nprSimulada)}
              </Text>
            </View>
            <View style={styles.caixaResultadoPequenaNovo}>
              <Text style={styles.resultadoPequenoLabelNovo}>
                Nota considerada
              </Text>
              <Text style={styles.resultadoPequenoValorNovo}>
                {mostrarNota(notaConsideradaSimulada)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardMetaSimuladorNovo}>
          <Text style={styles.labelHeroNovo}>Projeção anual</Text>
          <Text style={styles.tituloMetaSimuladorNovo}>Meta de média</Text>
          <TextInput
            style={styles.inputMetaSimuladorNovo}
            value={mediaDesejadaSimulador}
            onChangeText={(valor) =>
              setMediaDesejadaSimulador(normalizarEntradaNota(valor))
            }
            keyboardType="decimal-pad"
            placeholder="Ex.: 6,0"
            placeholderTextColor="#94a3b8"
          />

          <View style={styles.linhaMetaSimuladorNovo}>
            <View>
              <Text style={styles.metaSimuladorLabelNovo}>Média projetada</Text>
              <Text style={styles.metaSimuladorValorNovo}>
                {mostrarNota(mediaAnualSimulada)}
              </Text>
            </View>
            <View style={styles.statusMetaSimuladorNovo}>
              <Text style={styles.statusMetaSimuladorTextoNovo}>
                {resultadoMeta}
              </Text>
            </View>
          </View>

          <View style={styles.caixaAvisoPlanejamentoNovo}>
            <Text style={styles.avisoPlanejamentoTextoNovo}>
              A simulação não altera nem salva as notas reais do aluno.
            </Text>
          </View>
        </View>
      </>
    );
  }

  function renderPlanejamentoUnificado() {
    return (
      <>
        <View style={styles.cardFerramentasPlanejamentoNovo}>
          <Text style={styles.labelHeroNovo}>Planejamento</Text>
          <Text style={styles.tituloFerramentasPlanejamentoNovo}>
            Escolha uma ferramenta
          </Text>
          <Text style={styles.infoFerramentasPlanejamentoNovo}>
            Calcule a AE necessária ou teste cenários sem alterar as notas reais.
          </Text>

          <View style={styles.seletorFerramentaPlanejamentoNovo}>
            <Pressable
              style={[
                styles.botaoFerramentaPlanejamentoNovo,
                ferramentaPlanejamento === "ae" &&
                  styles.botaoFerramentaPlanejamentoAtivoNovo,
              ]}
              onPress={() => setFerramentaPlanejamento("ae")}
            >
              <Text
                style={[
                  styles.botaoFerramentaPlanejamentoTextoNovo,
                  ferramentaPlanejamento === "ae" &&
                    styles.botaoFerramentaPlanejamentoTextoAtivoNovo,
                ]}
              >
                Quanto preciso tirar?
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.botaoFerramentaPlanejamentoNovo,
                ferramentaPlanejamento === "simulador" &&
                  styles.botaoFerramentaPlanejamentoAtivoNovo,
              ]}
              onPress={() => setFerramentaPlanejamento("simulador")}
            >
              <Text
                style={[
                  styles.botaoFerramentaPlanejamentoTextoNovo,
                  ferramentaPlanejamento === "simulador" &&
                    styles.botaoFerramentaPlanejamentoTextoAtivoNovo,
                ]}
              >
                Simular notas
              </Text>
            </Pressable>
          </View>
        </View>

        {ferramentaPlanejamento === "ae"
          ? renderPlanejamento()
          : renderSimulador()}
      </>
    );
  }

  function renderPerfil() {
    return (
      <>
        <View style={styles.cardAlunosTopoNovo}>
          <Text style={styles.labelHeroNovo}>Perfil</Text>
          <Text style={styles.tituloAlunosNovo}>Configurações do app</Text>
          <Text style={styles.infoAlunosNovo}>
            Backup, licença, privacidade e informações do Média CMB.
          </Text>
        </View>

        <View style={styles.cardBackupNovo}>
          <Text style={styles.labelHeroNovo}>Dados e segurança</Text>
          <Text style={styles.tituloBackupNovo}>Backup dos dados</Text>

          <Text style={styles.infoBackupNovo}>
            Exporte um arquivo para guardar ou transferir as notas para outro
            aparelho. O Média CMB não envia nem armazena suas notas em servidor.
          </Text>

          <View style={styles.botoesBackupNovo}>
            <Pressable
              style={styles.botaoExportarBackupNovo}
              onPress={exportarBackup}
            >
              <Text style={styles.botaoExportarBackupTextoNovo}>
                Exportar backup
              </Text>
            </Pressable>

            <Pressable
              style={styles.botaoImportarBackupNovo}
              onPress={importarBackup}
            >
              <Text style={styles.botaoImportarBackupTextoNovo}>
                Importar backup
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.cardPerfilInfoNovo}>
          <Text style={styles.labelHeroNovo}>Licença</Text>
          <Text style={styles.tituloPerfilInfoNovo}>
            App ativado neste dispositivo
          </Text>

          <Text style={styles.infoPerfilInfoNovo}>
            A licença do Média CMB fica vinculada ao aparelho usado na ativação.
            Cada chave pode ser usada em até 2 dispositivos autorizados.
          </Text>

          <View style={styles.caixaStatusLicencaPerfilNovo}>
            <Text style={styles.statusLicencaPerfilTextoNovo}>
              Licença ativa
            </Text>
          </View>

          <View style={styles.caixaDetalhesLicencaPerfilNovo}>
            <View style={styles.linhaDetalheLicencaPerfilNovo}>
              <Text style={styles.rotuloDetalheLicencaPerfilNovo}>Chave</Text>
              <Text style={styles.valorDetalheLicencaPerfilNovo}>
                {ocultarChaveLicenca(dadosLicencaLocal?.chave ?? chaveAtivacao)}
              </Text>
            </View>

            <View style={styles.linhaDetalheLicencaPerfilNovo}>
              <Text style={styles.rotuloDetalheLicencaPerfilNovo}>
                Plataforma
              </Text>
              <Text style={styles.valorDetalheLicencaPerfilNovo}>
                {obterNomePlataforma()}
              </Text>
            </View>

            <View style={styles.linhaDetalheLicencaPerfilNovo}>
              <Text style={styles.rotuloDetalheLicencaPerfilNovo}>
                Ativada em
              </Text>
              <Text style={styles.valorDetalheLicencaPerfilNovo}>
                {formatarDataHora(dadosLicencaLocal?.ativadaEm)}
              </Text>
            </View>

            <View style={styles.linhaDetalheLicencaPerfilNovo}>
              <Text style={styles.rotuloDetalheLicencaPerfilNovo}>
                Última validação
              </Text>
              <Text style={styles.valorDetalheLicencaPerfilNovo}>
                {formatarDataHora(
                  dadosLicencaLocal?.ultimaValidacaoEm ??
                    dadosLicencaLocal?.ativadaEm,
                )}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.cardPerfilInfoNovo}>
          <Text style={styles.labelHeroNovo}>Sobre o app</Text>
          <Text style={styles.tituloPerfilInfoNovo}>Média CMB</Text>

          <Text style={styles.infoPerfilInfoNovo}>
            Aplicativo desenvolvido para auxiliar no acompanhamento das médias
            escolares, planejamento de recuperação e organização das notas por
            ano letivo.
          </Text>

          <Text style={styles.infoPerfilInfoNovo}>
            Desenvolvido por EDS e Dupont.
          </Text>
        </View>
        {mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}
      </>
    );
  }

  function renderAlunos() {
    const termoPesquisa = normalizarTextoBusca(pesquisaAluno);

    const alunosFiltrados = filhos
      .map((item, indexOriginal) => ({ item, indexOriginal }))
      .filter(({ item }) => {
        if (!termoPesquisa) return true;

        const dadosAlunoAno = obterDadosAnoLetivo(item, anoLetivoSelecionado);
        const textoPesquisavel = normalizarTextoBusca(
          `${item.nome} ${obterRotuloSerie(dadosAlunoAno.serie)} ${dadosAlunoAno.serie} ${dadosAlunoAno.turma}`,
        );

        return textoPesquisavel.includes(termoPesquisa);
      });

    return (
      <>
        <View style={styles.cardAlunosTopoNovo}>
          <View>
            <Text style={styles.labelHeroNovo}>Alunos</Text>
            <Text style={styles.tituloAlunosNovo}>Gerenciar estudantes</Text>
            <Text style={styles.infoAlunosNovo}>
              Cadastre, edite e organize os perfis dos alunos.
            </Text>
          </View>
          <View style={styles.cardSecaoPerfilNovo}>
            <View>
              <Text style={styles.labelHeroNovo}>Cadastro</Text>
              <Text style={styles.tituloSecaoPerfilNovo}>Alunos</Text>
              <Text style={styles.infoSecaoPerfilNovo}>
                {filhos.length}{" "}
                {filhos.length === 1
                  ? "aluno cadastrado"
                  : "alunos cadastrados"}{" "}
                neste dispositivo.
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.botaoAdicionarAlunoNovo}
            onPress={abrirNovoFilho}
          >
            <Text style={styles.botaoAdicionarAlunoTextoNovo}>
              ＋ Adicionar aluno
            </Text>
          </Pressable>
        </View>

        <View style={styles.cardBuscaAlunoNovo}>
          <Text style={styles.labelBuscaAlunoNovo}>Pesquisar aluno</Text>

          <View style={styles.caixaBuscaAlunoNovo}>
            <Text style={styles.iconeBuscaAlunoNovo}>⌕</Text>
            <TextInput
              style={styles.inputBuscaAlunoNovo}
              value={pesquisaAluno}
              onChangeText={setPesquisaAluno}
              placeholder="Nome, série ou turma"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {pesquisaAluno ? (
              <Pressable
                style={styles.botaoLimparBuscaNovo}
                onPress={() => setPesquisaAluno("")}
              >
                <Text style={styles.botaoLimparBuscaTextoNovo}>×</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.resultadoBuscaAlunoNovo}>
            {termoPesquisa
              ? `${alunosFiltrados.length} ${alunosFiltrados.length === 1 ? "aluno encontrado" : "alunos encontrados"}`
              : `${filhos.length} ${filhos.length === 1 ? "aluno cadastrado" : "alunos cadastrados"}`}
          </Text>
        </View>

        <View style={styles.listaAlunosCardsNovo}>
          {alunosFiltrados.map(({ item, indexOriginal: index }) => {
            const dadosAlunoAno = obterDadosAnoLetivo(
              item,
              anoLetivoSelecionado,
            );
            const alunoVisual: Filho = {
              ...item,
              serie: dadosAlunoAno.serie,
              turma: dadosAlunoAno.turma,
              disciplinas: dadosAlunoAno.disciplinas,
            };

            const mediaAluno = calcularMediaGeralAluno(alunoVisual);
            const classificacaoAluno = obterClassificacao(mediaAluno);
            const selecionado = filhoSelecionado === index;

            return (
              <Pressable
                key={item.id}
                style={[
                  styles.cardAlunoListaNovo,
                  selecionado && styles.cardAlunoListaSelecionadoNovo,
                ]}
                onPress={() => {
                  setFilhoSelecionado(index);
                  setDisciplinaSelecionada(0);
                  setTrimestreSelecionado("t1");
                  setMensagem("");
                }}
              >
                <View style={styles.cardAlunoListaTopoNovo}>
                  <View style={styles.areaFotoAlunoListaNovo}>
                    <View style={styles.fotoAlunoListaNovo}>
                      {item.fotoUri ? (
                        <Image
                          source={{ uri: item.fotoUri }}
                          style={styles.fotoAlunoImagemListaNovo}
                        />
                      ) : (
                        <Text style={styles.fotoAlunoIniciaisNovo}>
                          {obterIniciais(item.nome)}
                        </Text>
                      )}
                    </View>

                    {selecionado ? (
                      <Pressable
                        style={styles.botaoMiniFotoNovo}
                        onPress={alterarFotoAluno}
                      >
                        <Text style={styles.botaoMiniFotoTextoNovo}>✎</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.areaMediaAlunoListaNovo}>
                    <Text
                      style={[
                        styles.badgeStatusAlunoNovo,
                        {
                          backgroundColor: classificacaoAluno.corFundo,
                          color: classificacaoAluno.corTexto,
                        },
                      ]}
                    >
                      {classificacaoAluno.titulo}
                    </Text>

                    <Text
                      style={[
                        styles.mediaAlunoListaNovo,
                        { color: classificacaoAluno.corTexto },
                      ]}
                    >
                      {mostrarNota(mediaAluno)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardAlunoListaCorpoNovo}>
                  <Text style={styles.nomeAlunoListaNovo}>{item.nome}</Text>
                  <Text style={styles.dadosAlunoListaNovo}>
                    {obterRotuloSerie(alunoVisual.serie)} • Turma{" "}
                    {alunoVisual.turma}
                  </Text>
                </View>

                <View style={styles.linhaAlunoListaNovo} />

                <View style={styles.acoesAlunoListaNovo}>
                  <Pressable
                    style={styles.botaoAcaoAlunoNovo}
                    onPress={() => {
                      setFilhoSelecionado(index);
                      setDisciplinaSelecionada(0);
                      setTrimestreSelecionado("t1");
                      setMensagem(
                        "Role até o formulário abaixo para editar e salvar os dados do aluno.",
                      );
                      setModoFormulario("editar");
                      setNomeFormulario(item.nome);
                      setSerieFormulario(alunoVisual.serie);
                      setTurmaFormulario(alunoVisual.turma);
                      rolarParaFormularioAluno();
                    }}
                  >
                    <Text style={styles.botaoAcaoAlunoTextoNovo}>Editar</Text>
                  </Pressable>

                  <Pressable
                    style={styles.botaoAcaoAlunoNovo}
                    onPress={() => {
                      setFilhoSelecionado(index);
                      setAbaAtiva("inicio");
                    }}
                  >
                    <Text style={styles.botaoAcaoAlunoTextoSecNovo}>
                      Ver notas
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.botaoAcaoAlunoNovo,
                      styles.botaoExcluirAlunoNovo,
                    ]}
                    onPress={() => {
                      void excluirAluno(index);
                    }}
                  >
                    <Text style={styles.botaoExcluirAlunoTextoNovo}>
                      Excluir
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          {alunosFiltrados.length === 0 ? (
            <View style={styles.cardBuscaVaziaNovo}>
              <Text style={styles.iconeBuscaVaziaNovo}>⌕</Text>
              <Text style={styles.tituloBuscaVaziaNovo}>
                Nenhum aluno encontrado
              </Text>
              <Text style={styles.infoBuscaVaziaNovo}>
                Confira o nome, a série ou a turma pesquisada.
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable style={styles.cardVagaAlunoNovo} onPress={abrirNovoFilho}>
          <Text style={styles.iconeVagaAlunoNovo}>＋</Text>
          <Text style={styles.tituloVagaAlunoNovo}>Adicionar outro aluno</Text>
          <Text style={styles.infoVagaAlunoNovo}>
            Cadastre quantos alunos desejar
          </Text>
        </Pressable>

        {mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}

        {modoFormulario && (
          <View style={styles.cardFormularioAlunoNovo}>
            <Text style={styles.tituloFormularioAlunoNovo}>
              {modoFormulario === "novo" ? "Adicionar aluno" : "Editar aluno"}
            </Text>

            <Text style={styles.labelSelecaoNovo}>Nome do aluno</Text>
            <TextInput
              style={styles.inputLicenca}
              value={nomeFormulario}
              onChangeText={setNomeFormulario}
              placeholder="Ex.: Pedro Henrique"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.labelSelecaoNovo}>Série</Text>
            <View style={styles.listaBotoes}>
              {SERIES.map((serie) => (
                <Pressable
                  key={serie.id}
                  style={[
                    styles.chipDisciplinaNovo,
                    serieFormulario === serie.id &&
                      styles.chipDisciplinaAtivoNovo,
                  ]}
                  onPress={() => selecionarSerie(serie.id)}
                >
                  <Text
                    style={[
                      styles.chipDisciplinaTextoNovo,
                      serieFormulario === serie.id &&
                        styles.chipDisciplinaTextoAtivoNovo,
                    ]}
                  >
                    {serie.rotulo}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.labelSelecaoNovo}>Turma</Text>
            <View style={styles.listaBotoes}>
              {gerarTurmas(serieFormulario).map((turma) => (
                <Pressable
                  key={turma}
                  style={[
                    styles.chipTurmaAlunoNovo,
                    turmaFormulario === turma && styles.chipDisciplinaAtivoNovo,
                  ]}
                  onPress={() => setTurmaFormulario(turma)}
                >
                  <Text
                    style={[
                      styles.chipDisciplinaTextoNovo,
                      turmaFormulario === turma &&
                        styles.chipDisciplinaTextoAtivoNovo,
                    ]}
                  >
                    {turma}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.caixaAvisoPlanejamentoNovo}>
              <Text style={styles.avisoPlanejamentoTextoNovo}>
                Ao mudar a série de um aluno já cadastrado, a lista de
                disciplinas será ajustada para a nova série no ano letivo
                selecionado.
              </Text>
            </View>

            <View style={styles.botoesFormularioAlunoNovo}>
              <Pressable
                style={styles.botaoSalvarAlunoNovo}
                onPress={salvarFilho}
              >
                <Text style={styles.botaoSalvarAlunoTextoNovo}>
                  Salvar aluno
                </Text>
              </Pressable>

              <Pressable
                style={styles.botaoCancelarAlunoNovo}
                onPress={cancelarFormulario}
              >
                <Text style={styles.botaoCancelarAlunoTextoNovo}>Cancelar</Text>
              </Pressable>
            </View>

            {filho.fotoUri ? (
              <Pressable
                style={styles.botaoRemoverFotoNovo}
                onPress={removerFotoAluno}
              >
                <Text style={styles.botaoRemoverFotoTextoNovo}>
                  Remover foto do aluno selecionado
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </>
    );
  }

  if (!licencaCarregada) {
    return (
      <ScrollView contentContainerStyle={styles.containerLicenca}>
        <View style={styles.cardLicenca}>
          <Text style={styles.titulo}>Média CMB</Text>
          <Text style={styles.info}>Carregando licença...</Text>
        </View>
      </ScrollView>
    );
  }

  if (!licencaAtiva) {
    return renderTelaLicenca();
  }

  return (
    <View style={styles.appShellNovo}>
      <ScrollView
        ref={scrollPrincipalRef}
        contentContainerStyle={[
          styles.containerComMenuInferiorNovo,
          { width: larguraConteudo, alignSelf: "center" },
        ]}
      >
        {(abaAtiva === "notas" || abaAtiva === "planejamento") &&
          renderCabecalho()}

        {abaAtiva === "inicio" && renderInicio()}
        {abaAtiva === "alunos" && renderAlunos()}
        {abaAtiva === "notas" && renderNotas()}
        {abaAtiva === "planejamento" && renderPlanejamentoUnificado()}
        {abaAtiva === "perfil" && renderPerfil()}

        <>
            <Text style={styles.rodape}>Desenvolvido por EDS e Dupont</Text>
            <Text style={styles.rodapeSub}>
              Seus dados ficam salvos apenas neste dispositivo.
            </Text>
        </>
      </ScrollView>

      {renderMenuInferior()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 58,
    paddingBottom: 80,
    backgroundColor: "#f3f6fb",
    flexGrow: 1,
  },
  areaLogoTitulo: {
    alignItems: "center",
    marginBottom: 8,
  },
  cardAnoLetivo: {
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },

  labelAnoLetivo: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1f2937",
  },

  botaoAno: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  caixaBackup: {
    marginTop: 18,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  logoApp: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 10,
  },

  titulo: {
    fontSize: 38,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },

  descricao: {
    marginTop: 8,
    fontSize: 16,
    color: "#4b5563",
    lineHeight: 22,
    textAlign: "center",
  },

  topoAppNovo: {
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  topoMarcaNovo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  topoLogoNovo: {
    width: 42,
    height: 42,
    borderRadius: 14,
  },

  topoTituloNovo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0037b0",
  },

  topoSubtituloNovo: {
    marginTop: 1,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },

  botaoConfigNovo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },

  botaoConfigTextoNovo: {
    fontSize: 18,
    color: "#0037b0",
  },

  cardHeroAlunoNovo: {
    backgroundColor: "#ecfdf5",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    elevation: 3,
  },

  areaPerfilHeroNovo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  avatarHeroNovo: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#ffffff",
  },

  avatarImagemHeroNovo: {
    width: "100%",
    height: "100%",
  },

  avatarTextoHeroNovo: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "bold",
  },

  infoAlunoHeroNovo: {
    flex: 1,
  },

  labelHeroNovo: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  nomeAlunoHeroNovo: {
    marginTop: 4,
    fontSize: 25,
    color: "#111827",
    fontWeight: "bold",
  },

  dadosAlunoHeroNovo: {
    marginTop: 3,
    fontSize: 14,
    color: "#475569",
    fontWeight: "600",
  },

  linhaHeroNovo: {
    height: 1,
    backgroundColor: "#bbf7d0",
    marginVertical: 16,
  },

  areaMediaHeroNovo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },

  mediaHeroNovo: {
    marginTop: 2,
    fontSize: 46,
    fontWeight: "bold",
  },

  statusHeroNovo: {
    alignItems: "flex-end",
    flex: 1,
  },

  statusTituloHeroNovo: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "right",
  },

  statusMensagemHeroNovo: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },

  cardAnoLetivoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  cardTopoLinhaNovo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  tituloSecaoNovo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },

  badgeSerieNovo: {
    fontSize: 11,
    color: "#0037b0",
    fontWeight: "bold",
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  listaAnosNovo: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  botaoAnoNovo: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },

  botaoAnoAtivoNovo: {
    backgroundColor: "#0037b0",
    borderColor: "#0037b0",
  },

  botaoAnoTextoNovo: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "bold",
  },

  botaoAnoTextoAtivoNovo: {
    color: "#ffffff",
  },

  infoAnoLetivoNovo: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },

  menuPrincipalNovo: {
    marginTop: 18,
    marginBottom: 4,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 6,
    flexDirection: "row",
    gap: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  menuBotaoNovo: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 11,
    alignItems: "center",
  },

  menuBotaoAtivoNovo: {
    backgroundColor: "#dbeafe",
  },

  menuTextoNovo: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "bold",
  },

  menuTextoAtivoNovo: {
    color: "#0037b0",
  },
  cardCentralAlunoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#dbeafe",
    elevation: 3,
  },

  centralAlunoCabecalhoNovo: {
    flex: 1,
  },

  tituloCentralAlunoNovo: {
    marginTop: 6,
    fontSize: 25,
    color: "#111827",
    fontWeight: "bold",
  },

  gradeIndicadoresCentralNovo: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  cardIndicadorCentralNovo: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 112,
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "space-between",
  },

  indicadorCentralLabelNovo: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  indicadorCentralValorNovo: {
    marginTop: 5,
    fontSize: 34,
    color: "#0037b0",
    fontWeight: "bold",
  },

  valorAtencaoCentralNovo: {
    color: "#b91c1c",
  },

  indicadorCentralSubNovo: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },

  gradeDestaquesCentralNovo: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  cardDestaqueCentralNovo: {
    flexGrow: 1,
    flexBasis: 260,
    minHeight: 150,
    backgroundColor: "#ecfdf5",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },

  cardAtencaoCentralNovo: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },

  destaqueCentralTituloNovo: {
    marginTop: 10,
    fontSize: 20,
    color: "#111827",
    fontWeight: "bold",
  },

  destaqueCentralValorNovo: {
    marginTop: 8,
    fontSize: 38,
    color: "#166534",
    fontWeight: "bold",
  },

  destaqueCentralValorAtencaoNovo: {
    marginTop: 8,
    fontSize: 38,
    color: "#b91c1c",
    fontWeight: "bold",
  },

  destaqueCentralVazioNovo: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    fontWeight: "600",
  },

  cardAtalhosCentralNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  infoAtalhosCentralNovo: {
    marginTop: 5,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },

  gradeAtalhosCentralNovo: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  botaoAtalhoCentralNovo: {
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 128,
    backgroundColor: "#eff6ff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },

  iconeAtalhoCentralNovo: {
    fontSize: 24,
    color: "#0037b0",
    fontWeight: "bold",
  },

  tituloAtalhoCentralNovo: {
    marginTop: 7,
    fontSize: 17,
    color: "#0037b0",
    fontWeight: "bold",
  },

  infoAtalhoCentralNovo: {
    marginTop: 4,
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    fontWeight: "600",
  },

  badgePendenteCentralNovo: {
    fontSize: 11,
    color: "#92400e",
    fontWeight: "bold",
    backgroundColor: "#fffbeb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  cardInicioNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  infoInicioNovo: {
    marginTop: 6,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    maxWidth: 260,
  },

  gradeResumoNovo: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  cardDisciplinaNovo: {
    width: "47.8%",
    minHeight: 132,
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    justifyContent: "space-between",
    elevation: 2,
  },

  siglaDisciplinaNovo: {
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  mediaDisciplinaNovo: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
  },

  statusDisciplinaNovo: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },

  cardLegendaNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  itemLegendaNovo: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  barraLegendaNovo: {
    width: 6,
    height: 44,
    borderRadius: 999,
  },

  textoLegendaTituloNovo: {
    fontSize: 15,
    fontWeight: "bold",
  },

  textoLegendaSubNovo: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  cardFerramentasPlanejamentoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },
  tituloFerramentasPlanejamentoNovo: {
    marginTop: 6,
    fontSize: 24,
    color: "#111827",
    fontWeight: "bold",
  },
  infoFerramentasPlanejamentoNovo: {
    marginTop: 7,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  seletorFerramentaPlanejamentoNovo: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    padding: 5,
  },
  botaoFerramentaPlanejamentoNovo: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  botaoFerramentaPlanejamentoAtivoNovo: {
    backgroundColor: "#075fab",
  },
  botaoFerramentaPlanejamentoTextoNovo: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  botaoFerramentaPlanejamentoTextoAtivoNovo: {
    color: "#ffffff",
  },

  appShellNovo: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },

  containerComMenuInferiorNovo: {
    padding: 20,
    paddingTop: 58,
    paddingBottom: 132,
    backgroundColor: "#f3f6fb",
    flexGrow: 1,
  },

  menuInferiorNovo: {
    position: "absolute",
    bottom: 16,
    height: 82,
    backgroundColor: "#ffffff",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#dbeafe",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    elevation: 8,
  },

  menuInferiorBotaoNovo: {
    flex: 1,
    height: 66,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  menuInferiorBotaoAtivoNovo: {
    backgroundColor: "#dbeafe",
  },

  menuInferiorIconeNovo: {
    fontSize: 24,
    color: "#475569",
    fontWeight: "bold",
    lineHeight: 28,
  },

  menuInferiorIconeAtivoNovo: {
    color: "#0037b0",
  },

  menuInferiorTextoNovo: {
    marginTop: 3,
    fontSize: 12,
    color: "#475569",
    fontWeight: "bold",
  },

  menuInferiorTextoAtivoNovo: {
    color: "#0037b0",
  },
  cardNotasAlunoNovo: {
    marginTop: 18,
    backgroundColor: "#ecfdf5",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    elevation: 2,
  },

  nomeNotasAlunoNovo: {
    marginTop: 4,
    fontSize: 24,
    color: "#111827",
    fontWeight: "bold",
  },

  badgeMediaNotasNovo: {
    minWidth: 82,
    alignItems: "flex-end",
  },

  badgeMediaTextoNovo: {
    fontSize: 36,
    color: "#00714d",
    fontWeight: "bold",
  },

  badgeMediaSubNovo: {
    fontSize: 11,
    color: "#00714d",
    fontWeight: "bold",
  },

  blocoSelecaoNovo: {
    marginTop: 18,
  },

  labelSelecaoNovo: {
    marginBottom: 10,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  trimestresNovo: {
    flexDirection: "row",
    gap: 8,
  },

  trimestreBotaoNovo: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
  },

  trimestreBotaoAtivoNovo: {
    backgroundColor: "#0037b0",
    borderColor: "#0037b0",
  },

  trimestreTextoNovo: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "bold",
  },

  trimestreTextoAtivoNovo: {
    color: "#ffffff",
  },

  chipDisciplinaNovo: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },

  chipDisciplinaAtivoNovo: {
    backgroundColor: "#0037b0",
    borderColor: "#0037b0",
  },

  chipDisciplinaTextoNovo: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "bold",
  },

  chipDisciplinaTextoAtivoNovo: {
    color: "#ffffff",
  },

  cardNotasNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 3,
  },

  cardNotasTopoNovo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  tituloDisciplinaNotasNovo: {
    fontSize: 22,
    color: "#0037b0",
    fontWeight: "bold",
  },

  subtituloDisciplinaNotasNovo: {
    marginTop: 3,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },

  divisorNotasNovo: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 18,
  },

  linhaInputsNotasNovo: {
    flexDirection: "row",
    gap: 12,
  },

  caixaNotaEditavelNovo: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },

  caixaNotaEditavelCheiaNovo: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },

  miniLabelNotasNovo: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  inputNotaGrandeNovo: {
    fontSize: 26,
    color: "#111827",
    fontWeight: "bold",
    paddingVertical: 4,
    paddingHorizontal: 0,
  },

  linhaResumoNotasNovo: {
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  resumoNotasLabelNovo: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },

  resumoNotasValorNovo: {
    fontSize: 16,
    color: "#0037b0",
    fontWeight: "bold",
  },

  caixaGipNovo: {
    marginBottom: 16,
    backgroundColor: "#ecfdf5",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  gipLabelNovo: {
    flex: 1,
    fontSize: 14,
    color: "#166534",
    fontWeight: "bold",
  },

  inputGipNovo: {
    minWidth: 86,
    fontSize: 24,
    color: "#166534",
    fontWeight: "bold",
    textAlign: "right",
  },

  caixaInfoNotasNovo: {
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  infoNotasTextoNovo: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 19,
    fontWeight: "600",
  },

  caixaNpNovo: {
    marginTop: 18,
    marginBottom: 18,
    backgroundColor: "#dbeafe",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  npLabelNovo: {
    fontSize: 14,
    color: "#0037b0",
    fontWeight: "bold",
  },

  npSubNovo: {
    marginTop: 3,
    fontSize: 12,
    color: "#1d4ed8",
    fontWeight: "600",
  },

  npValorNovo: {
    fontSize: 42,
    color: "#0037b0",
    fontWeight: "bold",
  },

  gridResultadoNotasNovo: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },

  caixaResultadoPequenaNovo: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  resultadoPequenoLabelNovo: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  resultadoPequenoValorNovo: {
    marginTop: 6,
    fontSize: 24,
    color: "#111827",
    fontWeight: "bold",
  },

  cardResumoDisciplinaNovo: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    elevation: 2,
  },

  mediaResumoDisciplinaNovo: {
    marginTop: 8,
    fontSize: 42,
    fontWeight: "bold",
  },

  statusResumoDisciplinaNovo: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "bold",
  },

  infoResumoDisciplinaNovo: {
    marginTop: 12,
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    fontWeight: "600",
  },
  cardPlanejamentoTopoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  tituloPlanejamentoNovo: {
    marginTop: 6,
    fontSize: 25,
    color: "#0037b0",
    fontWeight: "bold",
  },

  infoPlanejamentoNovo: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    fontWeight: "600",
  },

  cardPlanejamentoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 3,
  },

  resumoPlanejamentoNovo: {
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    marginBottom: 18,
    gap: 10,
  },

  itemResumoPlanejamentoNovo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  resumoPlanejamentoLabelNovo: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "700",
  },

  resumoPlanejamentoValorNovo: {
    fontSize: 16,
    color: "#00714d",
    fontWeight: "bold",
  },

  caixaNpDesejadaNovo: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },

  inputNpDesejadaNovo: {
    fontSize: 28,
    color: "#0037b0",
    fontWeight: "bold",
    paddingVertical: 4,
  },

  caixaResultadoPlanejamentoNovo: {
    marginTop: 18,
    backgroundColor: "#ecfdf5",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },

  resultadoPlanejamentoLabelNovo: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  resultadoPlanejamentoTextoNovo: {
    marginTop: 8,
    fontSize: 22,
    color: "#166534",
    fontWeight: "bold",
    lineHeight: 30,
  },

  caixaAvisoPlanejamentoNovo: {
    marginTop: 14,
    backgroundColor: "#eff6ff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },

  avisoPlanejamentoTextoNovo: {
    fontSize: 13,
    color: "#1d4ed8",
    lineHeight: 19,
    fontWeight: "600",
  },
  cardBuscaAlunoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  labelBuscaAlunoNovo: {
    marginBottom: 10,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  caixaBuscaAlunoNovo: {
    minHeight: 54,
    backgroundColor: "#f8fafc",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  iconeBuscaAlunoNovo: {
    marginRight: 10,
    fontSize: 24,
    color: "#0037b0",
    fontWeight: "bold",
  },

  inputBuscaAlunoNovo: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },

  botaoLimparBuscaNovo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  botaoLimparBuscaTextoNovo: {
    fontSize: 23,
    color: "#475569",
    fontWeight: "bold",
    lineHeight: 25,
  },

  resultadoBuscaAlunoNovo: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },

  cardBuscaVaziaNovo: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    alignItems: "center",
  },

  iconeBuscaVaziaNovo: {
    fontSize: 34,
    color: "#94a3b8",
    fontWeight: "bold",
  },

  tituloBuscaVaziaNovo: {
    marginTop: 8,
    fontSize: 17,
    color: "#475569",
    fontWeight: "bold",
    textAlign: "center",
  },

  infoBuscaVaziaNovo: {
    marginTop: 5,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
  },

  cardAlunosTopoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  tituloAlunosNovo: {
    marginTop: 6,
    fontSize: 26,
    color: "#111827",
    fontWeight: "bold",
  },

  infoAlunosNovo: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },

  barraLimiteAlunosNovo: {
    marginTop: 14,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },

  barraLimitePreenchidaNovo: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0037b0",
  },

  botaoAdicionarAlunoNovo: {
    marginTop: 18,
    backgroundColor: "#0037b0",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },

  botaoAdicionarAlunoTextoNovo: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },

  listaAlunosCardsNovo: {
    marginTop: 18,
    gap: 14,
  },

  cardAlunoListaNovo: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  cardAlunoListaSelecionadoNovo: {
    borderColor: "#0037b0",
    backgroundColor: "#f8fbff",
  },

  cardAlunoListaTopoNovo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  areaFotoAlunoListaNovo: {
    position: "relative",
  },

  fotoAlunoListaNovo: {
    width: 82,
    height: 82,
    borderRadius: 22,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  fotoAlunoImagemListaNovo: {
    width: "100%",
    height: "100%",
  },

  fotoAlunoIniciaisNovo: {
    color: "#0037b0",
    fontSize: 24,
    fontWeight: "bold",
  },

  botaoMiniFotoNovo: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },

  botaoMiniFotoTextoNovo: {
    color: "#0037b0",
    fontSize: 16,
    fontWeight: "bold",
  },

  areaMediaAlunoListaNovo: {
    alignItems: "flex-end",
  },

  badgeStatusAlunoNovo: {
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "bold",
  },

  mediaAlunoListaNovo: {
    marginTop: 6,
    fontSize: 42,
    fontWeight: "bold",
  },

  cardAlunoListaCorpoNovo: {
    marginTop: 14,
  },

  nomeAlunoListaNovo: {
    fontSize: 21,
    color: "#111827",
    fontWeight: "bold",
  },

  dadosAlunoListaNovo: {
    marginTop: 4,
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },

  linhaAlunoListaNovo: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 14,
  },

  acoesAlunoListaNovo: {
    flexDirection: "row",
    gap: 10,
  },

  botaoAcaoAlunoNovo: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },

  botaoAcaoAlunoTextoNovo: {
    color: "#0037b0",
    fontWeight: "bold",
  },

  botaoAcaoAlunoTextoSecNovo: {
    color: "#475569",
    fontWeight: "bold",
  },

  botaoExcluirAlunoNovo: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },

  botaoExcluirAlunoTextoNovo: {
    color: "#b91c1c",
    fontWeight: "bold",
  },

  cardVagaAlunoNovo: {
    marginTop: 14,
    borderRadius: 24,
    padding: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },

  iconeVagaAlunoNovo: {
    fontSize: 30,
    color: "#64748b",
    fontWeight: "bold",
  },

  tituloVagaAlunoNovo: {
    marginTop: 4,
    fontSize: 17,
    color: "#475569",
    fontWeight: "bold",
  },

  infoVagaAlunoNovo: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },

  cardBackupNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  tituloBackupNovo: {
    marginTop: 6,
    fontSize: 22,
    color: "#0037b0",
    fontWeight: "bold",
  },

  infoBackupNovo: {
    marginTop: 10,
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    fontWeight: "600",
  },

  botoesBackupNovo: {
    marginTop: 18,
    gap: 10,
  },

  botaoExportarBackupNovo: {
    backgroundColor: "#0037b0",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },

  botaoExportarBackupTextoNovo: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },

  botaoImportarBackupNovo: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },

  botaoImportarBackupTextoNovo: {
    color: "#0037b0",
    fontWeight: "bold",
    fontSize: 15,
  },

  cardFormularioAlunoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 3,
  },

  tituloFormularioAlunoNovo: {
    fontSize: 23,
    color: "#111827",
    fontWeight: "bold",
    marginBottom: 16,
  },

  chipTurmaAlunoNovo: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },

  botoesFormularioAlunoNovo: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },

  botaoSalvarAlunoNovo: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },

  botaoSalvarAlunoTextoNovo: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },

  botaoCancelarAlunoNovo: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },

  botaoCancelarAlunoTextoNovo: {
    color: "#475569",
    fontWeight: "bold",
    fontSize: 15,
  },

  botaoRemoverFotoNovo: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 10,
  },

  botaoRemoverFotoTextoNovo: {
    color: "#dc2626",
    fontWeight: "bold",
    fontSize: 14,
  },
  cardSecaoPerfilNovo: {
    marginTop: 18,
    backgroundColor: "#f8fafc",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  tituloSecaoPerfilNovo: {
    marginTop: 4,
    fontSize: 22,
    color: "#0037b0",
    fontWeight: "bold",
  },

  infoSecaoPerfilNovo: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },

  cardPerfilInfoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  tituloPerfilInfoNovo: {
    marginTop: 6,
    fontSize: 21,
    color: "#111827",
    fontWeight: "bold",
  },

  infoPerfilInfoNovo: {
    marginTop: 10,
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    fontWeight: "600",
  },

  caixaStatusLicencaPerfilNovo: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: "#ecfdf5",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },

  statusLicencaPerfilTextoNovo: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "bold",
  },

  caixaDetalhesLicencaPerfilNovo: {
    marginTop: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },

  linhaDetalheLicencaPerfilNovo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  rotuloDetalheLicencaPerfilNovo: {
    flex: 1,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "bold",
  },

  valorDetalheLicencaPerfilNovo: {
    flex: 1.3,
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
    textAlign: "right",
  },
  cardSelecaoTopoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },

  tituloSelecaoAlunoNovo: {
    marginTop: 6,
    fontSize: 28,
    color: "#111827",
    fontWeight: "bold",
  },

  infoSelecaoAlunoNovo: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    fontWeight: "600",
  },

  carrosselAlunosNovo: {
    marginTop: 18,
    marginHorizontal: -20,
  },

  slideAlunoNovo: {
    paddingHorizontal: 10,
  },

  cardEscolhaAlunoNovo: {
    minHeight: 410,
    backgroundColor: "#ffffff",
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },

  cardEscolhaAlunoAtivoNovo: {
    borderColor: "#0037b0",
    backgroundColor: "#f8fbff",
  },

  avatarEscolhaAlunoNovo: {
    width: 126,
    height: 126,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#ffffff",
  },

  avatarEscolhaImagemNovo: {
    width: "100%",
    height: "100%",
  },

  avatarEscolhaTextoNovo: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "bold",
  },

  nomeEscolhaAlunoNovo: {
    marginTop: 18,
    fontSize: 27,
    color: "#111827",
    fontWeight: "bold",
    textAlign: "center",
  },

  dadosEscolhaAlunoNovo: {
    marginTop: 6,
    fontSize: 15,
    color: "#475569",
    fontWeight: "700",
    textAlign: "center",
  },

  caixaMediaEscolhaNovo: {
    marginTop: 20,
    width: "100%",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
  },

  mediaEscolhaValorNovo: {
    fontSize: 48,
    fontWeight: "bold",
  },

  mediaEscolhaStatusNovo: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "bold",
  },

  textoAbrirAlunoNovo: {
    marginTop: 18,
    fontSize: 14,
    color: "#0037b0",
    fontWeight: "bold",
  },

  controlesCarrosselDesktopNovo: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },

  botaoCarrosselDesktopNovo: {
    minWidth: 118,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
  },

  botaoCarrosselDesabilitadoNovo: {
    opacity: 0.35,
  },

  botaoCarrosselTextoNovo: {
    color: "#0037b0",
    fontSize: 14,
    fontWeight: "bold",
  },

  contadorCarrosselNovo: {
    minWidth: 56,
    textAlign: "center",
    color: "#475569",
    fontSize: 13,
    fontWeight: "bold",
  },

  indicadoresAlunosNovo: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },

  indicadorAlunoNovo: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
  },

  indicadorAlunoAtivoNovo: {
    width: 24,
    backgroundColor: "#0037b0",
  },
  botaoEditarAnoNovo: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  botaoEditarAnoTextoNovo: {
    color: "#0037b0",
    fontSize: 13,
    fontWeight: "700",
  },
  botaoDropdownAnoNovo: {
    marginTop: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  dropdownAnoLabelNovo: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  dropdownAnoValorNovo: {
    marginTop: 3,
    fontSize: 26,
    color: "#0037b0",
    fontWeight: "bold",
  },

  dropdownAnoSetaNovo: {
    fontSize: 18,
    color: "#0037b0",
    fontWeight: "bold",
  },

  listaDropdownAnoNovo: {
    marginTop: 10,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },

  itemDropdownAnoNovo: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  itemDropdownAnoAtivoNovo: {
    backgroundColor: "#eff6ff",
  },

  itemDropdownAnoTextoNovo: {
    fontSize: 17,
    color: "#475569",
    fontWeight: "bold",
  },

  itemDropdownAnoTextoAtivoNovo: {
    color: "#0037b0",
  },

  itemDropdownAnoCheckNovo: {
    color: "#0037b0",
    fontSize: 18,
    fontWeight: "bold",
  },

  botaoCriarAnoNovo: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: "#ecfdf5",
  },

  botaoCriarAnoTextoNovo: {
    color: "#166534",
    fontSize: 15,
    fontWeight: "bold",
  },

  formNovoAnoLetivoNovo: {
    marginTop: 14,
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  subtitulo: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 21,
    fontWeight: "bold",
    color: "#1f2937",
  },
  cardAluno: { marginTop: 20, borderRadius: 24, padding: 18, borderWidth: 1 },
  areaPerfil: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
    overflow: "hidden",
  },
  avatarImagem: { width: "100%", height: "100%", borderRadius: 39 },
  avatarTexto: { color: "#ffffff", fontSize: 24, fontWeight: "bold" },
  areaDadosAluno: { flex: 1 },
  alunoNome: { fontSize: 25, fontWeight: "bold", color: "#111827" },
  blocoMediaGeral: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },

  containerLicencaNovo: {
    padding: 20,
    paddingTop: 54,
    paddingBottom: 70,
    backgroundColor: "#f7f9fb",
    flexGrow: 1,
    justifyContent: "center",
  },

  barraTopoLicenca: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: "#1d4ed8",
    opacity: 0.18,
  },

  cardLicencaNovo: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 4,
  },

  areaLogoLicenca: {
    alignItems: "center",
    marginBottom: 26,
  },

  logoLicenca: {
    width: 74,
    height: 74,
    borderRadius: 20,
    marginBottom: 12,
  },

  tituloLicenca: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#0037b0",
    textAlign: "center",
  },

  descricaoLicenca: {
    marginTop: 8,
    fontSize: 15,
    color: "#475569",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },

  blocoLicenca: {
    marginTop: 4,
  },

  cardTituloLicenca: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },

  infoLicenca: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 22,
    marginBottom: 14,
  },

  labelLicenca: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  inputLicenca: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 17,
    backgroundColor: "#ffffff",
    color: "#111827",
  },

  botaoAtivarNovo: {
    marginTop: 18,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#0037b0",
    elevation: 3,
  },

  botaoAtivarTextoNovo: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 18,
  },

  mensagemLicencaNovo: {
    marginTop: 14,
    fontSize: 15,
    color: "#1d4ed8",
    fontWeight: "bold",
    lineHeight: 21,
  },

  divisorLicenca: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 22,
  },

  blocoCompraPix: {
    backgroundColor: "#f8fafc",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },

  botaoComprarPix: {
    marginTop: 4,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#006c49",
  },

  botaoComprarPixTexto: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },

  formCompraPix: {
    marginTop: 4,
  },

  botaoGerarPix: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#006c49",
  },

  botaoGerarPixTexto: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },

  caixaPixPreparado: {
    marginTop: 16,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },

  pixTitulo: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#166534",
    marginBottom: 6,
  },

  caixaCodigoPix: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },

  codigoPixTexto: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "bold",
  },

  avisoPix: {
    marginTop: 10,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },

  botaoVoltarChave: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 10,
  },

  botaoVoltarChaveTexto: {
    color: "#1d4ed8",
    fontWeight: "bold",
    fontSize: 15,
  },

  caixaDeviceNovo: {
    marginTop: 20,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  deviceLabelNovo: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  deviceTextoNovo: {
    marginTop: 6,
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },

  avisoDevLicenca: {
    marginTop: 14,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    textAlign: "center",
  },

  rodapeLicencaNovo: {
    marginTop: 12,
  },
  colunaNotaGeral: { flexShrink: 0 },
  colunaStatusGeral: { flex: 1, alignItems: "flex-end" },
  rotuloMediaGeral: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#64748b",
    marginBottom: 2,
  },
  mediaGeral: { fontSize: 34, fontWeight: "bold" },
  statusTitulo: { fontSize: 20, fontWeight: "bold", textAlign: "right" },
  alertaMedia: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "right",
  },
  menuPrincipal: {
    marginTop: 16,
    backgroundColor: "#e5e7eb",
    borderRadius: 18,
    padding: 5,
    flexDirection: "row",
    gap: 4,
  },
  menuBotao: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  menuBotaoAtivo: { backgroundColor: "#ffffff", elevation: 2 },
  menuTexto: { fontSize: 12, fontWeight: "bold", color: "#64748b" },
  menuTextoAtivo: { color: "#1d4ed8" },
  card: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    elevation: 3,
  },
  cardDestaque: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
  },
  cardTopo: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  cardTitulo: {
    fontSize: 21,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 10,
  },
  badgeTexto: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1d4ed8",
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  gradeResumo: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  disciplinaResumo: {
    width: "30.8%",
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    justifyContent: "space-between",
  },
  disciplinaSigla: { fontSize: 15, fontWeight: "bold" },
  disciplinaMedia: { fontSize: 25, fontWeight: "bold" },
  disciplinaStatus: { fontSize: 11, fontWeight: "bold" },
  legendaLinha: { marginTop: 8, fontSize: 15, color: "#374151" },
  listaBotoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  botao: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  botaoTurma: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  botaoAtivo: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" },
  botaoTexto: { fontSize: 14, color: "#374151", fontWeight: "600" },
  botaoTextoAtivo: { color: "#ffffff" },
  trimestres: { flexDirection: "row", gap: 8 },
  trimestreBotao: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  linhaInputs: { flexDirection: "row", gap: 10 },
  grupoInput: { flex: 1 },
  miniLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#4b5563",
    textAlign: "center",
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    padding: 13,
    fontSize: 18,
    backgroundColor: "#ffffff",
  },
  inputPequeno: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    padding: 13,
    fontSize: 18,
    backgroundColor: "#ffffff",
    textAlign: "center",
  },
  caixaResultado: {
    marginTop: 18,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#f8fafc",
  },
  resultado: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "bold",
    color: "#166534",
  },
  resultadoGrande: { fontSize: 27, fontWeight: "bold" },
  info: { marginTop: 10, fontSize: 16, color: "#374151", lineHeight: 22 },
  infoCompacta: {
    marginTop: 3,
    fontSize: 14,
    color: "#475569",
    lineHeight: 19,
  },
  cardMiniResumo: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    padding: 14,
  },
  linhaAcoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  botaoSecundario: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  botaoSecundarioTexto: { fontWeight: "bold", color: "#1d4ed8" },
  botaoSalvar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#16a34a",
  },
  botaoSalvarTexto: { fontWeight: "bold", color: "#ffffff" },
  botaoCancelar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  botaoCancelarTexto: { fontWeight: "bold", color: "#374151" },
  mensagem: { marginTop: 10, color: "#1d4ed8", fontWeight: "bold" },
  avisoFormulario: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  rodape: {
    marginTop: 18,
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    fontWeight: "700",
  },
  rodapeSub: {
    marginTop: 2,
    marginBottom: 30,
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    fontWeight: "600",
  },
  containerLicenca: {
    padding: 20,
    paddingTop: 70,
    paddingBottom: 70,
    backgroundColor: "#f3f6fb",
    flexGrow: 1,
    justifyContent: "center",
  },
  cardLicenca: {
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 22,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  botaoAtivar: {
    marginTop: 18,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#1d4ed8",
  },
  botaoDesabilitado: { opacity: 0.6 },
  botaoAtivarTexto: { color: "#ffffff", fontWeight: "bold", fontSize: 17 },
  mensagemLicenca: {
    marginTop: 14,
    fontSize: 15,
    color: "#1d4ed8",
    fontWeight: "bold",
    lineHeight: 21,
  },
  caixaDevice: {
    marginTop: 18,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  deviceTexto: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  cardSimuladorTopoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },
  tituloSimuladorNovo: {
    marginTop: 6,
    fontSize: 25,
    color: "#0037b0",
    fontWeight: "bold",
  },
  infoSimuladorNovo: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    fontWeight: "600",
  },
  cardSimuladorNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 3,
  },
  acoesSimuladorNovo: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  botaoCarregarSimuladorNovo: {
    flex: 1,
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  botaoCarregarSimuladorTextoNovo: {
    color: "#1d4ed8",
    fontWeight: "bold",
    fontSize: 13,
  },
  botaoLimparSimuladorNovo: {
    minWidth: 96,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  botaoLimparSimuladorTextoNovo: {
    color: "#475569",
    fontWeight: "bold",
    fontSize: 13,
  },
  gridResultadoSimuladorNovo: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cardMetaSimuladorNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },
  tituloMetaSimuladorNovo: {
    marginTop: 5,
    fontSize: 21,
    color: "#111827",
    fontWeight: "bold",
  },
  inputMetaSimuladorNovo: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 26,
    backgroundColor: "#f8fafc",
    color: "#0037b0",
    fontWeight: "bold",
  },
  linhaMetaSimuladorNovo: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  metaSimuladorLabelNovo: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  metaSimuladorValorNovo: {
    marginTop: 3,
    fontSize: 42,
    color: "#166534",
    fontWeight: "bold",
  },
  statusMetaSimuladorNovo: {
    flex: 1,
    alignItems: "flex-end",
  },
  statusMetaSimuladorTextoNovo: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "bold",
    lineHeight: 20,
    textAlign: "right",
  },

  cardPainelGeralTopoNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: "#dbeafe",
    elevation: 3,
  },
  tituloPainelGeralNovo: {
    marginTop: 6,
    fontSize: 28,
    color: "#0037b0",
    fontWeight: "bold",
  },
  infoPainelGeralNovo: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    fontWeight: "600",
  },
  gradeIndicadoresPainelNovo: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cardIndicadorPainelNovo: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 112,
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  indicadorPainelLabelNovo: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  indicadorPainelValorNovo: {
    marginTop: 5,
    fontSize: 34,
    color: "#0037b0",
    fontWeight: "bold",
  },
  indicadorPainelSubNovo: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  cardMelhorAlunoPainelNovo: {
    marginTop: 18,
    backgroundColor: "#ecfdf5",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    elevation: 2,
  },
  linhaMelhorAlunoPainelNovo: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarPainelNovo: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImagemPainelNovo: {
    width: "100%",
    height: "100%",
  },
  avatarTextoPainelNovo: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
  },
  infoMelhorAlunoPainelNovo: {
    flex: 1,
  },
  nomeMelhorAlunoPainelNovo: {
    fontSize: 20,
    color: "#111827",
    fontWeight: "bold",
  },
  dadosMelhorAlunoPainelNovo: {
    marginTop: 3,
    fontSize: 13,
    color: "#475569",
    fontWeight: "600",
  },
  mediaMelhorAlunoPainelNovo: {
    fontSize: 38,
    color: "#166534",
    fontWeight: "bold",
  },
  painelSemDadosNovo: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    fontWeight: "600",
  },
  cardListaPainelNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },
  listaRankingPainelNovo: {
    marginTop: 16,
    gap: 10,
  },
  cardAlunoPainelNovo: {
    minHeight: 92,
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardAlunoPainelCompactoNovo: {
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: 10,
  },
  posicaoPainelNovo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  posicaoPainelTextoNovo: {
    color: "#0037b0",
    fontSize: 13,
    fontWeight: "bold",
  },
  avatarAlunoPainelNovo: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarAlunoPainelTextoNovo: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  infoAlunoPainelNovo: {
    flex: 1,
    minWidth: 0,
  },
  nomeAlunoPainelNovo: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "bold",
  },
  dadosAlunoPainelNovo: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  alertaAlunoPainelNovo: {
    marginTop: 4,
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  areaMediaAlunoPainelNovo: {
    alignItems: "flex-end",
    minWidth: 65,
  },
  areaMediaAlunoPainelCompactoNovo: {
    width: "100%",
    minWidth: 0,
    paddingTop: 10,
    paddingLeft: 92,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mediaAlunoPainelNovo: {
    fontSize: 28,
    fontWeight: "bold",
  },
  statusAlunoPainelNovo: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: "bold",
  },
  topoInicioFamiliaNovo: {
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  marcaInicioFamiliaNovo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  logoInicioFamiliaNovo: {
    width: 46,
    height: 46,
    borderRadius: 15,
  },
  textosMarcaInicioNovo: {
    flex: 1,
  },
  tituloMarcaInicioNovo: {
    fontSize: 22,
    color: "#075fab",
    fontWeight: "bold",
  },
  subtituloMarcaInicioNovo: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  botaoConfigInicioNovo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  botaoConfigInicioTextoNovo: {
    fontSize: 20,
    color: "#075fab",
  },
  cardBoasVindasFamiliaNovo: {
    backgroundColor: "#dbeafe",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    elevation: 2,
  },
  saudacaoFamiliaNovo: {
    fontSize: 28,
    color: "#0f3f75",
    fontWeight: "bold",
  },
  descricaoFamiliaNovo: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#315b86",
    fontWeight: "600",
  },
  gradeResumoFamiliaNovo: {
    marginTop: 20,
    flexDirection: "row",
    gap: 12,
  },
  cardResumoFamiliaNovo: {
    flex: 1,
    minHeight: 106,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    justifyContent: "space-between",
  },
  rotuloResumoFamiliaNovo: {
    color: "#315b86",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  valorResumoFamiliaNovo: {
    color: "#075fab",
    fontSize: 30,
    fontWeight: "bold",
  },
  subResumoFamiliaNovo: {
    color: "#315b86",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  blocoAcoesFamiliaNovo: {
    marginTop: 20,
  },
  tituloSecaoInicioNovo: {
    fontSize: 21,
    color: "#111827",
    fontWeight: "bold",
  },
  linhaAcoesFamiliaNovo: {
    marginTop: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  acaoRapidaFamiliaNovo: {
    flex: 1,
    alignItems: "center",
  },
  iconeAcaoFamiliaNovo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#e8eeff",
    color: "#075fab",
    fontSize: 23,
    fontWeight: "bold",
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 56,
    overflow: "hidden",
  },
  textoAcaoFamiliaNovo: {
    marginTop: 7,
    fontSize: 11,
    color: "#334155",
    fontWeight: "700",
    textAlign: "center",
  },
  cabecalhoAlunoAtivoInicioNovo: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  subtituloAlunoAtivoInicioNovo: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  contadorAlunoAtivoInicioNovo: {
    fontSize: 12,
    color: "#075fab",
    fontWeight: "bold",
  },
  carrosselAlunoAtivoInicioNovo: {
    marginTop: 12,
    marginHorizontal: -20,
  },
  conteudoCarrosselAlunoAtivoInicioNovo: {
    paddingHorizontal: 20,
    paddingRight: 32,
  },
  cardAlunoAtivoSelecionadoInicioNovo: {
    borderColor: "#075fab",
    borderWidth: 2,
    backgroundColor: "#f8fbff",
  },
  indicadoresAlunoAtivoInicioNovo: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },
  indicadorAlunoAtivoInicioNovo: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
  },
  indicadorAlunoAtivoSelecionadoInicioNovo: {
    width: 22,
    backgroundColor: "#075fab",
  },
  cardDestaqueFamiliaNovo: {
    marginRight: 12,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    elevation: 2,
  },
  avatarDestaqueFamiliaNovo: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImagemDestaqueFamiliaNovo: {
    width: "100%",
    height: "100%",
  },
  avatarTextoDestaqueFamiliaNovo: {
    fontSize: 20,
    color: "#075fab",
    fontWeight: "bold",
  },
  infoDestaqueFamiliaNovo: {
    flex: 1,
    minWidth: 0,
  },
  rotuloDestaqueFamiliaNovo: {
    color: "#075fab",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  nomeDestaqueFamiliaNovo: {
    marginTop: 5,
    fontSize: 18,
    color: "#111827",
    fontWeight: "bold",
  },
  dadosDestaqueFamiliaNovo: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  mediaDestaqueFamiliaNovo: {
    alignItems: "flex-end",
  },
  mediaDestaqueValorNovo: {
    fontSize: 28,
    color: "#075fab",
    fontWeight: "bold",
  },
  mediaDestaqueRotuloNovo: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  cabecalhoListaFamiliaNovo: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  titulosListaFamiliaNovo: {
    flex: 1,
  },
  subtituloSecaoInicioNovo: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  linkVerTodosFamiliaNovo: {
    color: "#075fab",
    fontSize: 13,
    fontWeight: "bold",
  },
  listaCompactaFamiliaNovo: {
    gap: 12,
  },
  cardAlunoFamiliaNovo: {
    minHeight: 94,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 1,
  },
  avatarAlunoFamiliaNovo: {
    width: 54,
    height: 54,
    borderRadius: 17,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImagemAlunoFamiliaNovo: {
    width: "100%",
    height: "100%",
  },
  avatarTextoAlunoFamiliaNovo: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "bold",
  },
  infoAlunoFamiliaNovo: {
    flex: 1,
    minWidth: 0,
  },
  nomeAlunoFamiliaNovo: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "bold",
  },
  dadosAlunoFamiliaNovo: {
    marginTop: 3,
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  statusAlunoFamiliaNovo: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "bold",
  },
  areaMediaAlunoFamiliaNovo: {
    minWidth: 58,
    alignItems: "flex-end",
  },
  mediaAlunoFamiliaNovo: {
    fontSize: 25,
    fontWeight: "bold",
  },
  rotuloMediaAlunoFamiliaNovo: {
    marginTop: 1,
    fontSize: 9,
    color: "#64748b",
    fontWeight: "600",
  },
  avisoInicioFamiliaNovo: {
    marginTop: 16,
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  avisoInicioFamiliaTextoNovo: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
  },

  seletorVisualizacaoNotasNovo: {
    marginTop: 18,
    padding: 5,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbeafe",
    flexDirection: "row",
    gap: 6,
  },
  botaoVisualizacaoNotasNovo: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  botaoVisualizacaoNotasAtivoNovo: {
    backgroundColor: "#dbeafe",
  },
  textoVisualizacaoNotasNovo: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "bold",
  },
  textoVisualizacaoNotasAtivoNovo: {
    color: "#0037b0",
  },
  cardCabecalhoVisaoNotasNovo: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },
  linhaCabecalhoVisaoNotasNovo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  infoCabecalhoVisaoNotasNovo: {
    flex: 1,
    minWidth: 0,
  },
  tituloVisaoNotasNovo: {
    marginTop: 5,
    fontSize: 24,
    color: "#111827",
    fontWeight: "bold",
  },
  subtituloVisaoNotasNovo: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  badgeMediaVisaoNotasNovo: {
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    alignItems: "center",
  },
  badgeMediaVisaoNotasLabelNovo: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  badgeMediaVisaoNotasValorNovo: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: "bold",
  },
  textoExplicativoVisaoNotasNovo: {
    marginTop: 16,
    fontSize: 14,
    color: "#475569",
    lineHeight: 21,
  },
  gradeVisaoDisciplinasNovo: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardVisaoDisciplinaNovo: {
    minHeight: 144,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    justifyContent: "space-between",
    elevation: 1,
  },
  siglaVisaoDisciplinaNovo: {
    fontSize: 15,
    fontWeight: "bold",
  },
  mediaVisaoDisciplinaNovo: {
    marginTop: 7,
    fontSize: 28,
    fontWeight: "bold",
  },
  statusVisaoDisciplinaNovo: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: "bold",
  },
  divisorCardVisaoDisciplinaNovo: {
    height: 1,
    backgroundColor: "rgba(100, 116, 139, 0.18)",
    marginVertical: 8,
  },
  notaTrimestreVisaoDisciplinaNovo: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: "600",
  },
  caixaDicaVisaoNotasNovo: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  caixaDicaVisaoNotasTextoNovo: {
    fontSize: 12,
    color: "#1d4ed8",
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
  },


});
