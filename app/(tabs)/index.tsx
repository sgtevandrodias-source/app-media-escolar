import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
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

type Filho = {
  id: string;
  nome: string;
  serie: SerieEscolar;
  turma: string;
  disciplinas: Disciplina[];
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

const CHAVE_STORAGE = "media-escolar-dados";
const LIMITE_FILHOS = 5;

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
  return { id: String(Date.now()), nome, serie, turma, disciplinas: criarDisciplinasPorSerie(serie) };
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

function normalizarFilho(valor: any, indice: number): Filho {
  const serie = migrarSerieAntiga(valor?.serie);
  const turmas = gerarTurmas(serie);
  const turma = turmas.includes(String(valor?.turma)) ? String(valor?.turma) : turmaPadrao(serie);

  return {
    id: String(valor?.id ?? `${Date.now()}-${indice}`),
    nome: String(valor?.nome ?? `Aluno ${indice + 1}`),
    serie,
    turma,
    disciplinas: normalizarDisciplinas(serie, valor?.disciplinas),
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
    "Arte I": "ARTI",
    "Arte II": "ARTII",
    Biologia: "BIO",
    "Ciências Naturais": "CIE",
    "Educação Física": "EF",
    Filosofia: "FIL",
    Física: "FIS",
    Geografia: "GEO",
    História: "HIS",
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

  const filho = filhos[filhoSelecionado] ?? filhos[0];
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

  function atualizarCampo(campo: keyof NotasTrimestre, valor: string) {
    const novosFilhos = filhos.map((filhoAtual, indexFilho) => {
      if (indexFilho !== filhoSelecionado) return filhoAtual;
      return {
        ...filhoAtual,
        disciplinas: filhoAtual.disciplinas.map((disc, indexDisciplina) => {
          if (indexDisciplina !== disciplinaSelecionada) return disc;
          return {
            ...disc,
            trimestres: {
              ...disc.trimestres,
              [trimestreSelecionado]: { ...disc.trimestres[trimestreSelecionado], [campo]: valor },
            },
          };
        }),
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
        const mudouSerie = item.serie !== serieFormulario;
        return {
          ...item,
          nome: nomeLimpo,
          serie: serieFormulario,
          turma: turmaFormulario,
          disciplinas: mudouSerie ? criarDisciplinasPorSerie(serieFormulario) : item.disciplinas,
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

  function renderCabecalho() {
    return (
      <>
        <Text style={styles.titulo}>Média CMB</Text>
        <Text style={styles.descricao}>Acompanhe notas, trimestres e recuperação com clareza.</Text>

        <View style={[styles.cardAluno, { backgroundColor: classificacaoGeral.corFundo, borderColor: classificacaoGeral.corBorda }]}>
          <View style={styles.areaPerfil}>
            <View style={[styles.avatar, { backgroundColor: classificacaoGeral.corAvatar }]}>
              <Text style={styles.avatarTexto}>{obterIniciais(filho.nome)}</Text>
            </View>
            <View style={styles.areaDadosAluno}>
              <Text style={styles.alunoNome}>{filho.nome}</Text>
              <Text style={styles.infoCompacta}>{obterRotuloSerie(filho.serie)} • Turma {filho.turma}</Text>
              <View style={styles.linhaMediaGeral}>
                <Text style={[styles.mediaGeral, { color: classificacaoGeral.corTexto }]}>{mostrarNota(mediaGeralAluno)}</Text>
                <View>
                  <Text style={[styles.statusTitulo, { color: classificacaoGeral.corTexto }]}>{classificacaoGeral.titulo}</Text>
                  <Text style={[styles.alertaMedia, { color: classificacaoGeral.corTexto }]}>{classificacaoGeral.mensagem}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.menuPrincipal}>
          {([ ["inicio", "Início"], ["notas", "Notas"], ["planejamento", "Planejamento"], ["alunos", "Alunos"] ] as [AbaApp, string][]).map(([aba, rotulo]) => (
            <Pressable key={aba} style={[styles.menuBotao, abaAtiva === aba && styles.menuBotaoAtivo]} onPress={() => setAbaAtiva(aba)}>
              <Text style={[styles.menuTexto, abaAtiva === aba && styles.menuTextoAtivo]}>{rotulo}</Text>
            </Pressable>
          ))}
        </View>
      </>
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
        <View style={styles.card}>
          <View style={styles.cardTopo}>
            <Text style={styles.cardTitulo}>Visão geral</Text>
            <Text style={styles.badgeTexto}>{obterRotuloSerie(filho.serie)}</Text>
          </View>
          <Text style={styles.info}>A média geral considera todas as notas periódicas já lançadas nas disciplinas do aluno.</Text>
          <View style={styles.gradeResumo}>
            {resumoDisciplinas.map((item, index) => (
              <Pressable key={item.nome} style={[styles.disciplinaResumo, { backgroundColor: item.classificacao.corFundo, borderColor: item.classificacao.corBorda }]} onPress={() => { setDisciplinaSelecionada(index); setAbaAtiva("notas"); }}>
                <Text style={[styles.disciplinaSigla, { color: item.classificacao.corTexto }]}>{item.sigla}</Text>
                <Text style={[styles.disciplinaMedia, { color: item.classificacao.corTexto }]}>{mostrarNota(item.media)}</Text>
                <Text style={[styles.disciplinaStatus, { color: item.classificacao.corTexto }]}>{item.classificacao.titulo}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitulo}>Legenda de desempenho</Text>
          <Text style={styles.legendaLinha}>9,0 ou mais: Excelente — Parabéns</Text>
          <Text style={styles.legendaLinha}>8,0 a 8,9: Muito bom — Continue assim</Text>
          <Text style={styles.legendaLinha}>6,0 a 7,9: Bom — Você pode melhorar</Text>
          <Text style={styles.legendaLinha}>Abaixo de 6,0: Atenção — Você precisa estudar</Text>
        </View>
      </>
    );
  }

  function renderNotas() {
    return (
      <>
        <Text style={styles.subtitulo}>Disciplina</Text>
        {renderSeletorDisciplina()}
        <Text style={styles.subtitulo}>Trimestre</Text>
        {renderSeletorTrimestre()}

        <View style={styles.card}>
          <Text style={styles.cardTitulo}>{disciplina.nome} — {tituloTrimestre(trimestreSelecionado)}</Text>
          <Text style={styles.label}>{disciplina.nome} - {nomeAP}</Text>

          <View style={styles.linhaInputs}>
            <View style={styles.grupoInput}>
              <Text style={styles.miniLabel}>{nomeAP}.1</Text>
              <TextInput style={styles.inputPequeno} value={trimestre.ap1} onChangeText={(valor) => atualizarCampo("ap1", valor)} keyboardType="decimal-pad" placeholder="Ex.: 8.5" placeholderTextColor="#e2e8f0" />
            </View>
            <View style={styles.grupoInput}>
              <Text style={styles.miniLabel}>{nomeAP}.2</Text>
              <TextInput style={styles.inputPequeno} value={trimestre.ap2} onChangeText={(valor) => atualizarCampo("ap2", valor)} keyboardType="decimal-pad" placeholder="Ex.: 8.5" placeholderTextColor="#e2e8f0" />
            </View>
          </View>

          <Text style={styles.info}>Média das APs: {mostrarNota(mediaAP)}</Text>

          <Text style={styles.label}>GIP - Incentivo de Participação</Text>
          <TextInput style={styles.input} value={trimestre.gip} onChangeText={(valor) => atualizarCampo("gip", valor)} keyboardType="decimal-pad" placeholder="Ex.: 1.0 ou deixe vazio" placeholderTextColor="#e2e8f0" />

          {disciplina.usaAE ? (
            <>
              <Text style={styles.label}>AE - Avaliação de Estudo</Text>
              <TextInput style={styles.input} value={trimestre.ae} onChangeText={(valor) => atualizarCampo("ae", valor)} keyboardType="decimal-pad" placeholder="Ex.: 7.5" placeholderTextColor="#e2e8f0" />
            </>
          ) : (
            <Text style={styles.info}>Esta disciplina não possui AE. A NP será calculada pela média das APs + GIP.</Text>
          )}

          <View style={styles.caixaResultado}>
            <Text style={styles.resultado}>NP: {mostrarNota(np)}</Text>
            <Text style={styles.info}>Nota periódica do trimestre.</Text>
          </View>

          <Text style={styles.label}>AR - Avaliação de Recuperação</Text>
          <TextInput style={styles.input} value={trimestre.ar} onChangeText={(valor) => atualizarCampo("ar", valor)} keyboardType="decimal-pad" placeholder="Opcional" placeholderTextColor="#e2e8f0" />

          <Text style={styles.info}>NPR: {mostrarNota(npr)}</Text>
          <Text style={styles.info}>Nota considerada no boletim: {mostrarNota(notaConsiderada)}</Text>
        </View>

        <View style={[styles.cardDestaque, { backgroundColor: classificacaoDisciplina.corFundo, borderColor: classificacaoDisciplina.corBorda }]}> 
          <Text style={styles.cardTitulo}>Resumo da Disc {obterSiglaDisciplina(disciplina.nome)}</Text>
          <Text style={[styles.resultadoGrande, { color: classificacaoDisciplina.corTexto }]}>Média parcial: {mostrarNota(mediaFinalParcial)}</Text>
          <Text style={[styles.situacao, { color: classificacaoDisciplina.corTexto }]}>{situacao(mediaFinalParcial)}</Text>
          <Text style={styles.info}>{calcularNecessidadeFinal(disciplina, 6.0)}</Text>
        </View>
      </>
    );
  }

  function renderPlanejamento() {
    return (
      <>
        <Text style={styles.subtitulo}>Disciplina</Text>
        {renderSeletorDisciplina()}
        <Text style={styles.subtitulo}>Trimestre</Text>
        {renderSeletorTrimestre()}

        <View style={styles.card}>
          <Text style={styles.cardTitulo}>Quanto precisa tirar na AE?</Text>
          {disciplina.usaAE ? (
            <>
              <Text style={styles.info}>Informe abaixo a média desejada no trimestre. O app calcula a nota mínima que deve ser alcançada na AE do trimestre, considerando as APs e o GIP já lançados.</Text>
              <View style={styles.cardMiniResumo}>
                <Text style={styles.infoCompacta}>Disciplina: {disciplina.nome}</Text>
                <Text style={styles.infoCompacta}>Trimestre: {tituloTrimestre(trimestreSelecionado)}</Text>
                <Text style={styles.infoCompacta}>Média das APs: {mostrarNota(mediaAP)}</Text>
                <Text style={styles.infoCompacta}>GIP informado: {trimestre.gip || "0"}</Text>
              </View>
              <Text style={styles.label}>NP desejada neste trimestre</Text>
              <TextInput style={styles.input} value={npDesejada} onChangeText={setNpDesejada} keyboardType="decimal-pad" placeholder="Ex.: 8.0" placeholderTextColor="#e2e8f0" />
              <Text style={styles.resultado}>{calcularAENecessaria(disciplina, trimestre, npDesejadaNumero)}</Text>
            </>
          ) : (
            <Text style={styles.info}>Esta disciplina não usa AE. Para melhorar a NP, foque nas APs e no GIP.</Text>
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
          </View>
          <Text style={styles.info}>Alunos cadastrados: {filhos.length}/{LIMITE_FILHOS}</Text>
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {renderCabecalho()}
      {abaAtiva === "inicio" && renderInicio()}
      {abaAtiva === "notas" && renderNotas()}
      {abaAtiva === "planejamento" && renderPlanejamento()}
      {abaAtiva === "alunos" && renderAlunos()}
      <Text style={styles.rodape}>Desenvolvido por 1º Sgt Evandro</Text>
      <Text style={styles.rodapeSub}>Para uso pessoal</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 58, paddingBottom: 80, backgroundColor: "#f3f6fb", flexGrow: 1 },
  titulo: { fontSize: 38, fontWeight: "bold", color: "#111827" },
  descricao: { marginTop: 8, fontSize: 16, color: "#4b5563", lineHeight: 22 },
  subtitulo: { marginTop: 22, marginBottom: 10, fontSize: 21, fontWeight: "bold", color: "#1f2937" },
  cardAluno: { marginTop: 20, borderRadius: 24, padding: 18, borderWidth: 1 },
  areaPerfil: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#ffffff" },
  avatarTexto: { color: "#ffffff", fontSize: 24, fontWeight: "bold" },
  areaDadosAluno: { flex: 1 },
  alunoNome: { fontSize: 25, fontWeight: "bold", color: "#111827" },
  linhaMediaGeral: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 14 },
  mediaGeral: { fontSize: 36, fontWeight: "bold" },
  statusTitulo: { fontSize: 18, fontWeight: "bold" },
  alertaMedia: { marginTop: 2, fontSize: 14, fontWeight: "bold" },
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
});
