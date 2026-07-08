import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Trimestre = "t1" | "t2" | "t3";
type SerieEscolar = "6EF" | "7EF" | "8EF" | "9EF" | "1EM" | "2EM" | "3EM";
type ModoFormulario = "novo" | "editar" | null;
type AbaApp = "inicio" | "notas" | "planejamento" | "alunos";

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

type DadosSalvos = { filhos: Filho[] };
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
};
type BackupMediaCMB = {
  app: "MEDIA_CMB";
  versaoBackup: 1;
  exportadoEm: string;
  filhos: Filho[];
};

const CHAVE_STORAGE = "media-escolar-dados";
const CHAVE_DEVICE_ID = "media-cmb-device-id";
const CHAVE_LICENCA_LOCAL = "media-cmb-licenca-local";
const LIMITE_FILHOS = 5;

const ANO_LETIVO_PADRAO = String(new Date().getFullYear());

const SERIES: SerieConfig[] = [
  { id: "6EF", rotulo: "6º Ano EF", turmaInicial: 601, turmaFinal: 620, nivel: "Ensino Fundamental" },
  { id: "7EF", rotulo: "7º Ano EF", turmaInicial: 701, turmaFinal: 720, nivel: "Ensino Fundamental" },
  { id: "8EF", rotulo: "8º Ano EF", turmaInicial: 801, turmaFinal: 820, nivel: "Ensino Fundamental" },
  { id: "9EF", rotulo: "9º Ano EF", turmaInicial: 901, turmaFinal: 920, nivel: "Ensino Fundamental" },
  { id: "1EM", rotulo: "1º Ano EM", turmaInicial: 101, turmaFinal: 120, nivel: "Ensino Médio" },
  { id: "2EM", rotulo: "2º Ano EM", turmaInicial: 201, turmaFinal: 220, nivel: "Ensino Médio" },
  { id: "3EM", rotulo: "3º Ano EM", turmaInicial: 301, turmaFinal: 320, nivel: "Ensino Médio" },
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
  return obterConfigSerie(serie).nivel === "Ensino Médio" ? DISCIPLINAS_EM : DISCIPLINAS_EF;
}

function criarDisciplinasPorSerie(serie: SerieEscolar): Disciplina[] {
  return obterDisciplinasBasePorSerie(serie).map((disciplina) => ({
    nome: disciplina.nome,
    usaAE: disciplina.usaAE,
    trimestres: { t1: criarTrimestre(), t2: criarTrimestre(), t3: criarTrimestre() },
  }));
}

function gerarTurmas(serie: SerieEscolar) {
  const config = obterConfigSerie(serie);
  const turmas: string[] = [];

  for (let numero = config.turmaInicial; numero <= config.turmaFinal; numero++) {
    turmas.push(String(numero));
  }

  return turmas;
}

function turmaPadrao(serie: SerieEscolar) {
  return String(obterConfigSerie(serie).turmaInicial);
}

function criarFilho(nome = "Aluno 1", serie: SerieEscolar = "7EF", turma = turmaPadrao("7EF")): Filho {
  const disciplinas = criarDisciplinasPorSerie(serie);

  return {
    id: String(Date.now()),
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

function normalizarTrimestre(valor: any): NotasTrimestre {
  return { ap1: valor?.ap1 ?? "", ap2: valor?.ap2 ?? "", gip: valor?.gip ?? "", ae: valor?.ae ?? "", ar: valor?.ar ?? "" };
}

function normalizarDisciplinas(serie: SerieEscolar, disciplinasSalvas: any): Disciplina[] {
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
function normalizarAnoLetivo(valor: any, serieFallback: SerieEscolar, turmaFallback: string, disciplinasFallback: any): DadosAnoLetivo {
  const serie = migrarSerieAntiga(valor?.serie ?? serieFallback);
  const turmas = gerarTurmas(serie);
  const turma = turmas.includes(String(valor?.turma ?? turmaFallback))
    ? String(valor?.turma ?? turmaFallback)
    : turmaPadrao(serie);

  return {
    serie,
    turma,
    disciplinas: normalizarDisciplinas(serie, valor?.disciplinas ?? disciplinasFallback),
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
    disciplinas: filho.disciplinas,
  };
}
function normalizarFilho(valor: any, indice: number): Filho {
  const serie = migrarSerieAntiga(valor?.serie);
  const turmas = gerarTurmas(serie);
  const turma = turmas.includes(String(valor?.turma)) ? String(valor?.turma) : turmaPadrao(serie);
  const disciplinas = normalizarDisciplinas(serie, valor?.disciplinas);

  const anosLetivosOriginais = valor?.anosLetivos && typeof valor.anosLetivos === "object" ? valor.anosLetivos : {};
  const anosLetivosNormalizados: Record<string, DadosAnoLetivo> = {};

  Object.keys(anosLetivosOriginais).forEach((ano) => {
    anosLetivosNormalizados[ano] = normalizarAnoLetivo(
      anosLetivosOriginais[ano],
      serie,
      turma,
      disciplinas
    );
  });

  if (!anosLetivosNormalizados[ANO_LETIVO_PADRAO]) {
    anosLetivosNormalizados[ANO_LETIVO_PADRAO] = {
      serie,
      turma,
      disciplinas,
    };
  }

  const anoLetivoAtivo = String(valor?.anoLetivoAtivo ?? ANO_LETIVO_PADRAO);
  const dadosAnoAtivo = anosLetivosNormalizados[anoLetivoAtivo] ?? anosLetivosNormalizados[ANO_LETIVO_PADRAO];

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
  const notasAP = [textoParaNumero(trimestre.ap1), textoParaNumero(trimestre.ap2)];
  const notasValidas = notasAP.filter((nota): nota is number => nota !== null);
  if (notasValidas.length === 0) return null;
  const soma = notasValidas.reduce((total, nota) => total + nota, 0);
  return arredondar(soma / notasValidas.length);
}

function calcularNP(disciplina: Disciplina, trimestre: NotasTrimestre): number | null {
  const mediaAP = calcularMediaAP(trimestre);
  const gip = textoParaNumero(trimestre.gip) ?? 0;
  if (mediaAP === null) return null;

  const apMaisGip = limitarNota(mediaAP + gip);

  if (!disciplina.usaAE) return arredondar(apMaisGip);

  const ae = textoParaNumero(trimestre.ae);
  if (ae === null) return null;

  return arredondar(0.4 * apMaisGip + 0.6 * ae);
}

function calcularNPR(disciplina: Disciplina, trimestre: NotasTrimestre): number | null {
  const np = calcularNP(disciplina, trimestre);
  const ar = textoParaNumero(trimestre.ar);
  if (np === null || ar === null) return null;
  return arredondar((ar + np) / 2);
}

function calcularNotaConsiderada(disciplina: Disciplina, trimestre: NotasTrimestre): number | null {
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

  if (notas.length === 0) return "Lance pelo menos uma nota periódica para calcular.";

  const totalNecessario = mediaMinima * 3;
  const somaAtual = notas.reduce((total, nota) => total + nota, 0);
  const faltamTrimestres = 3 - notas.length;
  const falta = totalNecessario - somaAtual;

  if (falta <= 0) return "Já atingiu a média mínima, mantendo os dados atuais.";
  if (faltamTrimestres === 0) return "Não atingiu a média mínima.";

  const precisaPorTrimestre = falta / faltamTrimestres;
  if (precisaPorTrimestre > 10) return "Precisaria de mais de 10 nos trimestres restantes.";

  return `Para fechar o ano com média 6,0: precisa de ${precisaPorTrimestre.toFixed(1)} em cada trimestre restante.`;
}

function calcularAENecessaria(disciplina: Disciplina, trimestre: NotasTrimestre, npDesejada: number) {
  if (!disciplina.usaAE) return "Esta disciplina não usa AE. Para melhorar a NP, foque nas APs e no GIP.";

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
    return { titulo: "Sem dados", mensagem: "Sem média lançada", corFundo: "#f1f5f9", corBorda: "#cbd5e1", corTexto: "#475569", corAvatar: "#64748b" };
  }

  if (media < 6) {
    return { titulo: "Atenção", mensagem: "Você precisa estudar", corFundo: "#fef2f2", corBorda: "#fecaca", corTexto: "#b91c1c", corAvatar: "#dc2626" };
  }

  if (media < 8) {
    return { titulo: "Bom", mensagem: "Você pode melhorar", corFundo: "#fffbeb", corBorda: "#fde68a", corTexto: "#92400e", corAvatar: "#d97706" };
  }

  if (media < 9) {
    return { titulo: "Muito bom", mensagem: "Continue assim", corFundo: "#eff6ff", corBorda: "#bfdbfe", corTexto: "#1d4ed8", corAvatar: "#2563eb" };
  }

  return { titulo: "Excelente", mensagem: "Parabéns", corFundo: "#ecfdf5", corBorda: "#bbf7d0", corTexto: "#166534", corAvatar: "#16a34a" };
}

function situacao(media: number | null) {
  const classificacao = obterClassificacao(media);
  if (media === null) return classificacao.titulo;
  return `${classificacao.titulo} — ${classificacao.mensagem}`;
}

function mostrarNota(nota: number | null) {
  if (nota === null) return "Pendente";
  return nota.toFixed(1);
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
  const notas: number[] = [];

  filho.disciplinas.forEach((disciplina) => {
    const notaT1 = calcularNotaConsiderada(disciplina, disciplina.trimestres.t1);
    const notaT2 = calcularNotaConsiderada(disciplina, disciplina.trimestres.t2);
    const notaT3 = calcularNotaConsiderada(disciplina, disciplina.trimestres.t3);
    if (notaT1 !== null) notas.push(notaT1);
    if (notaT2 !== null) notas.push(notaT2);
    if (notaT3 !== null) notas.push(notaT3);
  });

  if (notas.length === 0) return null;
  const soma = notas.reduce((total, nota) => total + nota, 0);
  return arredondar(soma / notas.length);
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
    return { nome: disciplina.nome, sigla: obterSiglaDisciplina(disciplina.nome), media, classificacao };
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
function gerarNomeArquivoBackup() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");

  return `media-cmb-backup-${ano}-${mes}-${dia}-${hora}${minuto}.json`;
}
export default function HomeScreen() {
  const [filhos, setFilhos] = useState<Filho[]>([criarFilho("Aluno 1", "7EF", turmaPadrao("7EF"))]);
  const [filhoSelecionado, setFilhoSelecionado] = useState(0);
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState(0);
  const [trimestreSelecionado, setTrimestreSelecionado] = useState<Trimestre>("t1");
  const [npDesejada, setNpDesejada] = useState("8.0");
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null);
  const [nomeFormulario, setNomeFormulario] = useState("");
  const [serieFormulario, setSerieFormulario] = useState<SerieEscolar>("7EF");
  const [turmaFormulario, setTurmaFormulario] = useState(turmaPadrao("7EF"));
  const [mensagem, setMensagem] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<AbaApp>("inicio");
  const [anoLetivoSelecionado, setAnoLetivoSelecionado] = useState(ANO_LETIVO_PADRAO);
  const [licencaCarregada, setLicencaCarregada] = useState(false);
  const [licencaAtiva, setLicencaAtiva] = useState(false);
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
        const dadosSalvos = await AsyncStorage.getItem(CHAVE_STORAGE);
        if (dadosSalvos) {
          const dados = JSON.parse(dadosSalvos);
          if (Array.isArray(dados)) {
            const filhoMigrado: Filho = {
              id: String(Date.now()),
              nome: "Aluno 1",
              serie: "7EF",
              turma: turmaPadrao("7EF"),
              disciplinas: normalizarDisciplinas("7EF", dados),
            };
            setFilhos([filhoMigrado]);
          } else if (dados && Array.isArray(dados.filhos)) {
            const filhosNormalizados = dados.filhos.map((item: any, index: number) => normalizarFilho(item, index));
            setFilhos(filhosNormalizados.length ? filhosNormalizados : [criarFilho()]);
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
    async function salvarDados() {
      try {
        if (dadosCarregados) {
          const dados: DadosSalvos = { filhos };
          await AsyncStorage.setItem(CHAVE_STORAGE, JSON.stringify(dados));
        }
      } catch (erro) {
        console.log("Erro ao salvar dados:", erro);
      }
    }
    salvarDados();
  }, [filhos, dadosCarregados]);

  const filhoBase = filhos[filhoSelecionado] ?? filhos[0];
const dadosAnoLetivo = obterDadosAnoLetivo(filhoBase, anoLetivoSelecionado);

const filho: Filho = {
  ...filhoBase,
  serie: dadosAnoLetivo.serie,
  turma: dadosAnoLetivo.turma,
  disciplinas: dadosAnoLetivo.disciplinas,
};

const disciplina = filho.disciplinas[disciplinaSelecionada] ?? filho.disciplinas[0];
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
  const npDesejadaNumero = textoParaNumero(npDesejada) ?? 8.0;
  const nomeAP = prefixoAP(trimestreSelecionado);
function obterAnosDisponiveis() {
  const anos = new Set<string>();

  filhos.forEach((item) => {
    if (item.anosLetivos) {
      Object.keys(item.anosLetivos).forEach((ano) => anos.add(ano));
    }
  });

  anos.add(ANO_LETIVO_PADRAO);

  const anoAtualNumero = Number(ANO_LETIVO_PADRAO);
  anos.add(String(anoAtualNumero + 1));

  return Array.from(anos).sort();
}
  function atualizarCampo(campo: keyof NotasTrimestre, valor: string) {
  const novosFilhos = filhos.map((filhoAtual, indexFilho) => {
    if (indexFilho !== filhoSelecionado) return filhoAtual;

    const dadosAtuais = obterDadosAnoLetivo(filhoAtual, anoLetivoSelecionado);

    const disciplinasAtualizadas = dadosAtuais.disciplinas.map((disc, indexDisciplina) => {
      if (indexDisciplina !== disciplinaSelecionada) return disc;

      return {
        ...disc,
        trimestres: {
          ...disc.trimestres,
          [trimestreSelecionado]: {
            ...disc.trimestres[trimestreSelecionado],
            [campo]: valor,
          },
        },
      };
    });

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
    if (filhos.length >= LIMITE_FILHOS) {
      setMensagem("Limite de 5 alunos atingido.");
      return;
    }
    setMensagem("");
    setModoFormulario("novo");
    setNomeFormulario("");
    setSerieFormulario("7EF");
    setTurmaFormulario(turmaPadrao("7EF"));
    setAbaAtiva("alunos");
  }

  function abrirEditarFilho() {
    setMensagem("");
    setModoFormulario("editar");
    setNomeFormulario(filho.nome);
    setSerieFormulario(filho.serie);
    setTurmaFormulario(filho.turma);
    setAbaAtiva("alunos");
  }

  function cancelarFormulario() {
    setModoFormulario(null);
    setMensagem("");
  }

  function selecionarSerie(serie: SerieEscolar) {
    setSerieFormulario(serie);
    setTurmaFormulario(turmaPadrao(serie));
  }

  function salvarFilho() {
    const nomeLimpo = nomeFormulario.trim();
    if (!nomeLimpo) {
      setMensagem("Informe o nome do aluno.");
      return;
    }

    if (modoFormulario === "novo") {
      if (filhos.length >= LIMITE_FILHOS) {
        setMensagem("Limite de 5 alunos atingido.");
        return;
      }
      const novoFilho = criarFilho(nomeLimpo, serieFormulario, turmaFormulario);
      setFilhos([...filhos, novoFilho]);
      setFilhoSelecionado(filhos.length);
      setDisciplinaSelecionada(0);
      setTrimestreSelecionado("t1");
      setModoFormulario(null);
      setMensagem("Aluno adicionado com sucesso.");
      setAbaAtiva("inicio");
      return;
    }

   if (modoFormulario === "editar") {
  const filhosAtualizados = filhos.map((item, index) => {
    if (index !== filhoSelecionado) return item;

    const dadosAtuais = obterDadosAnoLetivo(item, anoLetivoSelecionado);
    const mudouSerie = dadosAtuais.serie !== serieFormulario;

    const disciplinasAtualizadas = mudouSerie
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

  async function alterarFotoAluno() {
    try {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissao.granted) {
        setMensagem("Permita o acesso às fotos para escolher uma imagem do aluno.");
        return;
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.45,
        base64: true,
      });

      if (resultado.canceled) return;

      const imagem = resultado.assets?.[0];
      if (!imagem) return;

      const fotoUri = imagem.base64
        ? `data:image/jpeg;base64,${imagem.base64}`
        : imagem.uri;

      const filhosAtualizados = filhos.map((item, index) => {
        if (index !== filhoSelecionado) return item;
        return { ...item, fotoUri };
      });

      setFilhos(filhosAtualizados);
      setMensagem("Foto do aluno atualizada.");
    } catch (erro) {
      console.log("Erro ao escolher foto:", erro);
      setMensagem("Não foi possível escolher a foto agora.");
    }
  }

  function removerFotoAluno() {
    const filhosAtualizados = filhos.map((item, index) => {
      if (index !== filhoSelecionado) return item;
      return { ...item, fotoUri: "" };
    });

    setFilhos(filhosAtualizados);
    setMensagem("Foto removida.");
  }
async function exportarBackup() {
  try {
    const backup: BackupMediaCMB = {
      app: "MEDIA_CMB",
      versaoBackup: 1,
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

      setMensagem("Backup exportado com sucesso. Guarde o arquivo em local seguro.");
      return;
    }

    setMensagem("A exportação de backup está disponível na versão web/PWA do app.");
  } catch (erro) {
    console.log("Erro ao exportar backup:", erro);
    setMensagem("Não foi possível exportar o backup agora.");
  }
}

function importarBackup() {
  try {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      setMensagem("A importação de backup está disponível na versão web/PWA do app.");
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

      const leitor = new FileReader();

      leitor.onload = async () => {
        try {
          const texto = String(leitor.result ?? "");
          const dados = JSON.parse(texto);

          if (dados?.app !== "MEDIA_CMB" || !Array.isArray(dados?.filhos)) {
            setMensagem("Arquivo de backup inválido para o Média CMB.");
            return;
          }

          const confirmar =
            typeof window !== "undefined"
              ? window.confirm(
                  "Ao importar este backup, os dados atuais deste aparelho serão substituídos. Deseja continuar?"
                )
              : true;

          if (!confirmar) {
            setMensagem("Importação cancelada.");
            return;
          }

          const filhosNormalizados = dados.filhos
            .slice(0, LIMITE_FILHOS)
            .map((item: any, index: number) => normalizarFilho(item, index));

          if (!filhosNormalizados.length) {
            setMensagem("O backup não possui alunos válidos.");
            return;
          }

          setFilhos(filhosNormalizados);
          setFilhoSelecionado(0);
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
      setMensagemLicenca("Não foi possível identificar este dispositivo. Feche e abra o app novamente.");
      return;
    }

    try {
      setValidandoLicenca(true);
      setMensagemLicenca("Validando chave de acesso...");

      if (__DEV__ && chave === "EVANDRO-TESTE-LOCAL") {
        const licencaLocal: LicencaLocal = { ativa: true, chave, deviceId, ativadaEm: new Date().toISOString() };
        await AsyncStorage.setItem(CHAVE_LICENCA_LOCAL, JSON.stringify(licencaLocal));
        setLicencaAtiva(true);
        setMensagemLicenca("Licença local de teste ativada.");
        return;
      }

      const resposta = await fetch("/api/ativar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave, deviceId }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado?.ok) {
        setMensagemLicenca(resultado?.mensagem ?? "Chave não autorizada.");
        return;
      }

      const licencaLocal: LicencaLocal = { ativa: true, chave, deviceId, ativadaEm: new Date().toISOString() };
      await AsyncStorage.setItem(CHAVE_LICENCA_LOCAL, JSON.stringify(licencaLocal));
      setLicencaAtiva(true);
      setMensagemLicenca(resultado?.mensagem ?? "Licença ativada com sucesso.");
    } catch (erro) {
      console.log("Erro ao ativar licença:", erro);
      setMensagemLicenca("Não foi possível validar a chave. Verifique a internet e tente novamente.");
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
      "Área de compra preparada. Na próxima etapa, este botão vai gerar um Pix real pelo Mercado Pago."
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
            do pagamento, a chave será liberada automaticamente no app e enviada
            por e-mail.
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

              <Text style={styles.labelLicenca}>E-mail para receber a chave</Text>
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
                  <Text style={styles.pixTitulo}>Pix preparado para integração</Text>

                  <Text style={styles.infoLicenca}>
                    Quando conectarmos o Mercado Pago, aqui aparecerão o QR Code
                    Pix e o código Pix copia e cola.
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
              <Text style={styles.topoSubtituloNovo}>Notas e recuperação escolar</Text>
            </View>
          </View>

          <Pressable style={styles.botaoConfigNovo} onPress={() => setAbaAtiva("alunos")}>
            <Text style={styles.botaoConfigTextoNovo}>⚙</Text>
          </Pressable>
        </View>

        <View style={styles.cardHeroAlunoNovo}>
          <View style={styles.areaPerfilHeroNovo}>
            <View style={[styles.avatarHeroNovo, { backgroundColor: classificacaoGeral.corAvatar }]}>
              {filho.fotoUri ? (
                <Image source={{ uri: filho.fotoUri }} style={styles.avatarImagemHeroNovo} />
              ) : (
                <Text style={styles.avatarTextoHeroNovo}>{obterIniciais(filho.nome)}</Text>
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
              <Text style={[styles.mediaHeroNovo, { color: classificacaoGeral.corTexto }]}>
                {mostrarNota(mediaGeralAluno)}
              </Text>
            </View>

            <View style={styles.statusHeroNovo}>
              <Text style={[styles.statusTituloHeroNovo, { color: classificacaoGeral.corTexto }]}>
                {classificacaoGeral.titulo}
              </Text>
              <Text style={[styles.statusMensagemHeroNovo, { color: classificacaoGeral.corTexto }]}>
                {classificacaoGeral.mensagem}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardAnoLetivoNovo}>
          <View style={styles.cardTopoLinhaNovo}>
            <Text style={styles.tituloSecaoNovo}>Ano letivo</Text>
            <Text style={styles.badgeSerieNovo}>{obterRotuloSerie(filho.serie)}</Text>
          </View>

          <View style={styles.listaAnosNovo}>
            {obterAnosDisponiveis().map((ano) => (
              <Pressable
                key={ano}
                style={[
                  styles.botaoAnoNovo,
                  anoLetivoSelecionado === ano && styles.botaoAnoAtivoNovo,
                ]}
                onPress={() => {
                  setAnoLetivoSelecionado(ano);
                  setDisciplinaSelecionada(0);
                  setTrimestreSelecionado("t1");
                  setMensagem("");
                }}
              >
                <Text
                  style={[
                    styles.botaoAnoTextoNovo,
                    anoLetivoSelecionado === ano && styles.botaoAnoTextoAtivoNovo,
                  ]}
                >
                  {ano}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.infoAnoLetivoNovo}>
            As notas são salvas separadamente para cada ano letivo.
          </Text>
        </View>
      </>
    );
  }
  function renderMenuInferior() {
    const itens: { aba: AbaApp; rotulo: string; icone: string }[] = [
      { aba: "inicio", rotulo: "Início", icone: "⌂" },
      { aba: "notas", rotulo: "Notas", icone: "★" },
      { aba: "planejamento", rotulo: "Planejamento", icone: "□" },
      { aba: "alunos", rotulo: "Alunos", icone: "👥" },
    ];

    return (
      <View style={styles.menuInferiorNovo}>
        {itens.map((item) => {
          const ativo = abaAtiva === item.aba;

          return (
            <Pressable
              key={item.aba}
              style={[styles.menuInferiorBotaoNovo, ativo && styles.menuInferiorBotaoAtivoNovo]}
              onPress={() => setAbaAtiva(item.aba)}
            >
              <Text style={[styles.menuInferiorIconeNovo, ativo && styles.menuInferiorIconeAtivoNovo]}>
                {item.icone}
              </Text>

              <Text style={[styles.menuInferiorTextoNovo, ativo && styles.menuInferiorTextoAtivoNovo]}>
                {item.rotulo}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  function renderSeletorAlunoCompacto() {
    return (
      <View style={styles.listaBotoes}>
        {filhos.map((item, index) => (
          <Pressable
            key={item.id}
            style={[styles.botao, filhoSelecionado === index && styles.botaoAtivo]}
            onPress={() => {
              setFilhoSelecionado(index);
              setDisciplinaSelecionada(0);
              setTrimestreSelecionado("t1");
              setMensagem("");
            }}
          >
            <Text style={[styles.botaoTexto, filhoSelecionado === index && styles.botaoTextoAtivo]}>{item.nome}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  function renderSeletorDisciplina() {
    return (
      <View style={styles.listaBotoes}>
        {filho.disciplinas.map((item, index) => (
          <Pressable key={item.nome} style={[styles.botao, disciplinaSelecionada === index && styles.botaoAtivo]} onPress={() => setDisciplinaSelecionada(index)}>
            <Text style={[styles.botaoTexto, disciplinaSelecionada === index && styles.botaoTextoAtivo]}>{obterSiglaDisciplina(item.nome)}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  function renderSeletorTrimestre() {
    return (
      <View style={styles.trimestres}>
        {(["t1", "t2", "t3"] as Trimestre[]).map((trimestreItem) => (
          <Pressable key={trimestreItem} style={[styles.trimestreBotao, trimestreSelecionado === trimestreItem && styles.botaoAtivo]} onPress={() => setTrimestreSelecionado(trimestreItem)}>
            <Text style={[styles.botaoTexto, trimestreSelecionado === trimestreItem && styles.botaoTextoAtivo]}>{tituloTrimestre(trimestreItem)}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

   function renderInicio() {
    return (
      <>
        <View style={styles.cardInicioNovo}>
          <View style={styles.cardTopoLinhaNovo}>
            <View>
              <Text style={styles.tituloSecaoNovo}>Visão geral</Text>
              <Text style={styles.infoInicioNovo}>
                A média geral considera todas as notas periódicas já lançadas.
              </Text>
            </View>

            <Text style={styles.badgeSerieNovo}>{obterRotuloSerie(filho.serie)}</Text>
          </View>
        </View>

        <View style={styles.gradeResumoNovo}>
          {resumoDisciplinas.map((item, index) => (
            <Pressable
              key={item.nome}
              style={[
                styles.cardDisciplinaNovo,
                {
                  backgroundColor: item.classificacao.corFundo,
                  borderColor: item.classificacao.corBorda,
                },
              ]}
              onPress={() => {
                setDisciplinaSelecionada(index);
                setAbaAtiva("notas");
              }}
            >
              <Text
                style={[
                  styles.siglaDisciplinaNovo,
                  { color: item.classificacao.corTexto },
                ]}
              >
                {item.sigla}
              </Text>

              <Text
                style={[
                  styles.mediaDisciplinaNovo,
                  { color: item.classificacao.corTexto },
                ]}
              >
                {mostrarNota(item.media)}
              </Text>

              <Text
                style={[
                  styles.statusDisciplinaNovo,
                  { color: item.classificacao.corTexto },
                ]}
              >
                {item.classificacao.titulo}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.cardLegendaNovo}>
          <Text style={styles.tituloSecaoNovo}>Legenda de desempenho</Text>

          <View style={styles.itemLegendaNovo}>
            <View style={[styles.barraLegendaNovo, { backgroundColor: "#16a34a" }]} />
            <View>
              <Text style={[styles.textoLegendaTituloNovo, { color: "#166534" }]}>
                9,0 ou mais: Excelente
              </Text>
              <Text style={styles.textoLegendaSubNovo}>Parabéns</Text>
            </View>
          </View>

          <View style={styles.itemLegendaNovo}>
            <View style={[styles.barraLegendaNovo, { backgroundColor: "#2563eb" }]} />
            <View>
              <Text style={[styles.textoLegendaTituloNovo, { color: "#1d4ed8" }]}>
                8,0 a 8,9: Muito bom
              </Text>
              <Text style={styles.textoLegendaSubNovo}>Continue assim</Text>
            </View>
          </View>

          <View style={styles.itemLegendaNovo}>
            <View style={[styles.barraLegendaNovo, { backgroundColor: "#d97706" }]} />
            <View>
              <Text style={[styles.textoLegendaTituloNovo, { color: "#92400e" }]}>
                6,0 a 7,9: Bom
              </Text>
              <Text style={styles.textoLegendaSubNovo}>Você pode melhorar</Text>
            </View>
          </View>

          <View style={styles.itemLegendaNovo}>
            <View style={[styles.barraLegendaNovo, { backgroundColor: "#dc2626" }]} />
            <View>
              <Text style={[styles.textoLegendaTituloNovo, { color: "#b91c1c" }]}>
                Abaixo de 6,0: Atenção
              </Text>
              <Text style={styles.textoLegendaSubNovo}>Você precisa estudar</Text>
            </View>
          </View>
        </View>
      </>
    );
  }

    function renderNotas() {
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
            <Text style={styles.badgeMediaTextoNovo}>{mostrarNota(mediaGeralAluno)}</Text>
            <Text style={styles.badgeMediaSubNovo}>Média geral</Text>
          </View>
        </View>

        <View style={styles.blocoSelecaoNovo}>
          <Text style={styles.labelSelecaoNovo}>Ano letivo</Text>

          <View style={styles.listaAnosNovo}>
            {obterAnosDisponiveis().map((ano) => (
              <Pressable
                key={ano}
                style={[
                  styles.botaoAnoNovo,
                  anoLetivoSelecionado === ano && styles.botaoAnoAtivoNovo,
                ]}
                onPress={() => {
                  setAnoLetivoSelecionado(ano);
                  setDisciplinaSelecionada(0);
                  setTrimestreSelecionado("t1");
                  setMensagem("");
                }}
              >
                <Text
                  style={[
                    styles.botaoAnoTextoNovo,
                    anoLetivoSelecionado === ano && styles.botaoAnoTextoAtivoNovo,
                  ]}
                >
                  {ano}
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
                  trimestreSelecionado === trimestreItem && styles.trimestreBotaoAtivoNovo,
                ]}
                onPress={() => setTrimestreSelecionado(trimestreItem)}
              >
                <Text
                  style={[
                    styles.trimestreTextoNovo,
                    trimestreSelecionado === trimestreItem && styles.trimestreTextoAtivoNovo,
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
                  disciplinaSelecionada === index && styles.chipDisciplinaAtivoNovo,
                ]}
                onPress={() => setDisciplinaSelecionada(index)}
              >
                <Text
                  style={[
                    styles.chipDisciplinaTextoNovo,
                    disciplinaSelecionada === index && styles.chipDisciplinaTextoAtivoNovo,
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

            <Text style={styles.badgeSerieNovo}>{obterSiglaDisciplina(disciplina.nome)}</Text>
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
            <Text style={styles.resumoNotasValorNovo}>{mostrarNota(mediaAP)}</Text>
          </View>

          <Text style={styles.labelSelecaoNovo}>GIP - Incentivo de Participação</Text>

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
              <Text style={styles.labelSelecaoNovo}>AE - Avaliação de Estudo</Text>

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
                Esta disciplina não possui AE. A NP será calculada pela média das APs + GIP.
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

          <Text style={styles.labelSelecaoNovo}>AR - Avaliação de Recuperação</Text>

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
              <Text style={styles.resultadoPequenoValorNovo}>{mostrarNota(npr)}</Text>
            </View>

            <View style={styles.caixaResultadoPequenaNovo}>
              <Text style={styles.resultadoPequenoLabelNovo}>Nota considerada</Text>
              <Text style={styles.resultadoPequenoValorNovo}>{mostrarNota(notaConsiderada)}</Text>
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
            {classificacaoDisciplina.titulo} — {classificacaoDisciplina.mensagem}
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
                  disciplinaSelecionada === index && styles.chipDisciplinaAtivoNovo,
                ]}
                onPress={() => setDisciplinaSelecionada(index)}
              >
                <Text
                  style={[
                    styles.chipDisciplinaTextoNovo,
                    disciplinaSelecionada === index && styles.chipDisciplinaTextoAtivoNovo,
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
                  trimestreSelecionado === trimestreItem && styles.trimestreBotaoAtivoNovo,
                ]}
                onPress={() => setTrimestreSelecionado(trimestreItem)}
              >
                <Text
                  style={[
                    styles.trimestreTextoNovo,
                    trimestreSelecionado === trimestreItem && styles.trimestreTextoAtivoNovo,
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
                  <Text style={styles.resumoPlanejamentoLabelNovo}>Média das APs</Text>
                  <Text style={styles.resumoPlanejamentoValorNovo}>
                    {mostrarNota(mediaAP)}
                  </Text>
                </View>

                <View style={styles.itemResumoPlanejamentoNovo}>
                  <Text style={styles.resumoPlanejamentoLabelNovo}>GIP informado</Text>
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
                  onChangeText={setNpDesejada}
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
                  {calcularAENecessaria(disciplina, trimestre, npDesejadaNumero)}
                </Text>
              </View>

              <View style={styles.caixaAvisoPlanejamentoNovo}>
                <Text style={styles.avisoPlanejamentoTextoNovo}>
                  Dica: se ainda não lançou as APs, preencha primeiro a aba Notas
                  para o cálculo ficar correto.
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.caixaInfoNotasNovo}>
              <Text style={styles.infoNotasTextoNovo}>
                Esta disciplina não usa AE. Para melhorar a NP, foque nas APs e no GIP.
              </Text>
            </View>
          )}
        </View>
      </>
    );
  }

  function renderAlunos() {
    return (
      <>
        <View style={styles.card}>
          <Text style={styles.cardTitulo}>Alunos</Text>
          <Text style={styles.info}>Selecione, adicione ou edite os alunos cadastrados. Cada aluno possui suas próprias notas e disciplinas.</Text>
          {renderSeletorAlunoCompacto()}
          <View style={styles.linhaAcoes}>
            <Pressable style={styles.botaoSecundario} onPress={abrirNovoFilho}><Text style={styles.botaoSecundarioTexto}>Adicionar aluno</Text></Pressable>
            <Pressable style={styles.botaoSecundario} onPress={abrirEditarFilho}><Text style={styles.botaoSecundarioTexto}>Editar aluno</Text></Pressable>
            <Pressable style={styles.botaoSecundario} onPress={alterarFotoAluno}><Text style={styles.botaoSecundarioTexto}>Alterar foto</Text></Pressable>
            {filho.fotoUri ? (
              <Pressable style={styles.botaoCancelar} onPress={removerFotoAluno}><Text style={styles.botaoCancelarTexto}>Remover foto</Text></Pressable>
            ) : null}
          </View>
          <Text style={styles.info}>Alunos cadastrados: {filhos.length}/{LIMITE_FILHOS}</Text>

<View style={styles.caixaBackup}>
  <Text style={styles.cardTitulo}>Backup dos dados</Text>
  <Text style={styles.info}>
    Exporte um arquivo para guardar ou transferir as notas para outro aparelho.
    O Média CMB não envia nem armazena suas notas em servidor.
  </Text>

  <View style={styles.linhaAcoes}>
    <Pressable style={styles.botaoSalvar} onPress={exportarBackup}>
      <Text style={styles.botaoSalvarTexto}>Exportar backup</Text>
    </Pressable>

    <Pressable style={styles.botaoSecundario} onPress={importarBackup}>
      <Text style={styles.botaoSecundarioTexto}>Importar backup</Text>
    </Pressable>
  </View>
</View>

{mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}
        </View>

        {modoFormulario && (
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>{modoFormulario === "novo" ? "Adicionar aluno" : "Editar aluno"}</Text>
            <Text style={styles.label}>Nome do aluno</Text>
            <TextInput style={styles.input} value={nomeFormulario} onChangeText={setNomeFormulario} placeholder="Ex.: Pedro Henrique" placeholderTextColor="#e2e8f0" />

            <Text style={styles.label}>Série</Text>
            <View style={styles.listaBotoes}>
              {SERIES.map((serie) => (
                <Pressable key={serie.id} style={[styles.botao, serieFormulario === serie.id && styles.botaoAtivo]} onPress={() => selecionarSerie(serie.id)}>
                  <Text style={[styles.botaoTexto, serieFormulario === serie.id && styles.botaoTextoAtivo]}>{serie.rotulo}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Turma</Text>
            <View style={styles.listaBotoes}>
              {gerarTurmas(serieFormulario).map((turma) => (
                <Pressable key={turma} style={[styles.botaoTurma, turmaFormulario === turma && styles.botaoAtivo]} onPress={() => setTurmaFormulario(turma)}>
                  <Text style={[styles.botaoTexto, turmaFormulario === turma && styles.botaoTextoAtivo]}>{turma}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.avisoFormulario}>Ao mudar a série de um aluno já cadastrado, a lista de disciplinas será ajustada para a nova série.</Text>

            <View style={styles.linhaAcoes}>
              <Pressable style={styles.botaoSalvar} onPress={salvarFilho}><Text style={styles.botaoSalvarTexto}>Salvar aluno</Text></Pressable>
              <Pressable style={styles.botaoCancelar} onPress={cancelarFormulario}><Text style={styles.botaoCancelarTexto}>Cancelar</Text></Pressable>
            </View>
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
      <ScrollView contentContainerStyle={styles.containerComMenuInferiorNovo}>
        {renderCabecalho()}
        {abaAtiva === "inicio" && renderInicio()}
        {abaAtiva === "notas" && renderNotas()}
        {abaAtiva === "planejamento" && renderPlanejamento()}
        {abaAtiva === "alunos" && renderAlunos()}

        <Text style={styles.rodape}>Desenvolvido por EDS e Dupont</Text>
        <Text style={styles.rodapeSub}>
          Seus dados ficam salvos apenas neste dispositivo.
        </Text>
      </ScrollView>

      {renderMenuInferior()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 58, paddingBottom: 80, backgroundColor: "#f3f6fb", flexGrow: 1 },
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
    left: 16,
    right: 16,
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
  subtitulo: { marginTop: 22, marginBottom: 10, fontSize: 21, fontWeight: "bold", color: "#1f2937" },
  cardAluno: { marginTop: 20, borderRadius: 24, padding: 18, borderWidth: 1 },
  areaPerfil: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#ffffff", overflow: "hidden" },
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
  rotuloMediaGeral: { fontSize: 13, fontWeight: "bold", color: "#64748b", marginBottom: 2 },
  mediaGeral: { fontSize: 34, fontWeight: "bold" },
  statusTitulo: { fontSize: 20, fontWeight: "bold", textAlign: "right" },
  alertaMedia: { marginTop: 2, fontSize: 14, fontWeight: "bold", textAlign: "right" },
  menuPrincipal: { marginTop: 16, backgroundColor: "#e5e7eb", borderRadius: 18, padding: 5, flexDirection: "row", gap: 4 },
  menuBotao: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: "center" },
  menuBotaoAtivo: { backgroundColor: "#ffffff", elevation: 2 },
  menuTexto: { fontSize: 12, fontWeight: "bold", color: "#64748b" },
  menuTextoAtivo: { color: "#1d4ed8" },
  card: { marginTop: 18, backgroundColor: "#ffffff", borderRadius: 24, padding: 18, elevation: 3 },
  cardDestaque: { marginTop: 18, borderRadius: 24, padding: 18, borderWidth: 1 },
  cardTopo: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" },
  cardTitulo: { fontSize: 21, fontWeight: "bold", color: "#111827", marginBottom: 10 },
  badgeTexto: { fontSize: 12, fontWeight: "bold", color: "#1d4ed8", backgroundColor: "#eff6ff", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  gradeResumo: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  disciplinaResumo: { width: "30.8%", minHeight: 104, borderWidth: 1, borderRadius: 18, padding: 10, justifyContent: "space-between" },
  disciplinaSigla: { fontSize: 15, fontWeight: "bold" },
  disciplinaMedia: { fontSize: 25, fontWeight: "bold" },
  disciplinaStatus: { fontSize: 11, fontWeight: "bold" },
  legendaLinha: { marginTop: 8, fontSize: 15, color: "#374151" },
  listaBotoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  botao: { paddingVertical: 10, paddingHorizontal: 13, borderRadius: 999, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d1d5db" },
  botaoTurma: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d1d5db" },
  botaoAtivo: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" },
  botaoTexto: { fontSize: 14, color: "#374151", fontWeight: "600" },
  botaoTextoAtivo: { color: "#ffffff" },
  trimestres: { flexDirection: "row", gap: 8 },
  trimestreBotao: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d1d5db", alignItems: "center" },
  linhaInputs: { flexDirection: "row", gap: 10 },
  grupoInput: { flex: 1 },
  miniLabel: { marginBottom: 6, fontSize: 13, fontWeight: "700", color: "#4b5563", textAlign: "center" },
  label: { marginTop: 12, marginBottom: 6, fontSize: 15, fontWeight: "700", color: "#374151" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 14, padding: 13, fontSize: 18, backgroundColor: "#ffffff" },
  inputPequeno: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 14, padding: 13, fontSize: 18, backgroundColor: "#ffffff", textAlign: "center" },
  caixaResultado: { marginTop: 18, borderRadius: 18, padding: 14, backgroundColor: "#f8fafc" },
  resultado: { marginTop: 10, fontSize: 20, fontWeight: "bold", color: "#166534" },
  resultadoGrande: { fontSize: 27, fontWeight: "bold" },
  situacao: { marginTop: 8, fontSize: 19, fontWeight: "bold" },
  info: { marginTop: 10, fontSize: 16, color: "#374151", lineHeight: 22 },
  infoCompacta: { marginTop: 3, fontSize: 14, color: "#475569", lineHeight: 19 },
  cardMiniResumo: { marginTop: 14, borderRadius: 16, backgroundColor: "#f8fafc", padding: 14 },
  linhaAcoes: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  botaoSecundario: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#93c5fd" },
  botaoSecundarioTexto: { fontWeight: "bold", color: "#1d4ed8" },
  botaoSalvar: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#16a34a" },
  botaoSalvarTexto: { fontWeight: "bold", color: "#ffffff" },
  botaoCancelar: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d1d5db" },
  botaoCancelarTexto: { fontWeight: "bold", color: "#374151" },
  mensagem: { marginTop: 10, color: "#1d4ed8", fontWeight: "bold" },
  avisoFormulario: { marginTop: 12, fontSize: 13, color: "#64748b", lineHeight: 18 },
  rodape: { marginTop: 18, fontSize: 12, color: "#94a3b8", textAlign: "center", fontWeight: "700" },
  rodapeSub: { marginTop: 2, marginBottom: 30, fontSize: 12, color: "#94a3b8", textAlign: "center", fontWeight: "600" },
  containerLicenca: { padding: 20, paddingTop: 70, paddingBottom: 70, backgroundColor: "#f3f6fb", flexGrow: 1, justifyContent: "center" },
  cardLicenca: { backgroundColor: "#ffffff", borderRadius: 26, padding: 22, elevation: 4, borderWidth: 1, borderColor: "#dbeafe" },
  botaoAtivar: { marginTop: 18, borderRadius: 16, paddingVertical: 15, alignItems: "center", backgroundColor: "#1d4ed8" },
  botaoDesabilitado: { opacity: 0.6 },
  botaoAtivarTexto: { color: "#ffffff", fontWeight: "bold", fontSize: 17 },
  mensagemLicenca: { marginTop: 14, fontSize: 15, color: "#1d4ed8", fontWeight: "bold", lineHeight: 21 },
  caixaDevice: { marginTop: 18, borderRadius: 16, padding: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  deviceTexto: { marginTop: 4, color: "#64748b", fontSize: 11, fontWeight: "700" },
});
