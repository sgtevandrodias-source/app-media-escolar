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
type Serie = "6" | "7" | "8" | "9";
type ModoFormulario = "novo" | "editar" | null;

type NotasTrimestre = {
  ap1: string;
  ap2: string;
  ap3: string;
  gip: string;
  ae: string;
  ar: string;
};

type Disciplina = {
  nome: string;
  usaAE: boolean;
  usaAP3: boolean;
  trimestres: Record<Trimestre, NotasTrimestre>;
};

type Filho = {
  id: string;
  nome: string;
  serie: Serie;
  turma: string;
  disciplinas: Disciplina[];
};

type DadosSalvos = {
  filhos: Filho[];
};

const DISCIPLINAS_BASE = [
  { nome: "Arte I", usaAE: false, usaAP3: false },
  { nome: "Ciências Naturais", usaAE: true, usaAP3: true },
  { nome: "Educação Física", usaAE: false, usaAP3: false },
  { nome: "Geografia", usaAE: true, usaAP3: true },
  { nome: "História", usaAE: true, usaAP3: true },
  { nome: "LEM - Inglês", usaAE: true, usaAP3: true },
  { nome: "Língua Portuguesa", usaAE: true, usaAP3: true },
  { nome: "Matemática", usaAE: true, usaAP3: true },
];

const CHAVE_STORAGE = "media-escolar-dados";
const LIMITE_FILHOS = 5;

function criarTrimestre(): NotasTrimestre {
  return { ap1: "", ap2: "", ap3: "", gip: "", ae: "", ar: "" };
}

function criarDisciplinas(): Disciplina[] {
  return DISCIPLINAS_BASE.map((disciplina) => ({
    nome: disciplina.nome,
    usaAE: disciplina.usaAE,
    usaAP3: disciplina.usaAP3,
    trimestres: { t1: criarTrimestre(), t2: criarTrimestre(), t3: criarTrimestre() },
  }));
}

function criarFilho(nome = "Aluno 1", serie: Serie = "7", turma = "701"): Filho {
  return { id: String(Date.now()), nome, serie, turma, disciplinas: criarDisciplinas() };
}

function gerarTurmas(serie: Serie) {
  const turmas: string[] = [];
  for (let numero = 1; numero <= 20; numero++) {
    turmas.push(`${serie}${String(numero).padStart(2, "0")}`);
  }
  return turmas;
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
  return Number(nota.toFixed(1));
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

function calcularMediaAP(disciplina: Disciplina, trimestre: NotasTrimestre): number | null {
  const notasAP = [textoParaNumero(trimestre.ap1), textoParaNumero(trimestre.ap2)];
  if (disciplina.usaAP3) notasAP.push(textoParaNumero(trimestre.ap3));
  const notasValidas = notasAP.filter((nota): nota is number => nota !== null);
  if (notasValidas.length === 0) return null;
  const soma = notasValidas.reduce((total, nota) => total + nota, 0);
  return arredondar(soma / notasValidas.length);
}

function calcularNP(disciplina: Disciplina, trimestre: NotasTrimestre): number | null {
  const mediaAP = calcularMediaAP(disciplina, trimestre);
  const gip = textoParaNumero(trimestre.gip);
  if (mediaAP === null || gip === null) return null;
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
  return `Para fechar o ano com média 6,0, precisa de ${precisaPorTrimestre.toFixed(1)} em cada trimestre restante.`;
}

function calcularAENecessaria(disciplina: Disciplina, trimestre: NotasTrimestre, npDesejada: number) {
  if (!disciplina.usaAE) return "Esta disciplina não usa AE. Para melhorar a NP, foque nas APs e no GIP.";
  const mediaAP = calcularMediaAP(disciplina, trimestre);
  const gip = textoParaNumero(trimestre.gip);
  if (mediaAP === null || gip === null) return "Informe as APs e o GIP para calcular.";
  const apMaisGip = limitarNota(mediaAP + gip);
  const aeNecessaria = (npDesejada - 0.4 * apMaisGip) / 0.6;
  if (aeNecessaria <= 0) return "As APs + GIP já garantem essa NP.";
  if (aeNecessaria > 10) return "Impossível atingir essa NP apenas com a AE.";
  return `Precisa tirar ${aeNecessaria.toFixed(1)} na AE.`;
}

function situacao(media: number | null) {
  if (media === null) return "Sem dados";
  if (media < 6) return "Risco";
  if (media < 8) return "Atenção";
  return "Bom desempenho";
}

function obterAlertaMedia(media: number | null) {
  if (media === null) {
    return { texto: "Sem dados", descricao: "Ainda não há notas lançadas.", corFundo: "#f8fafc", corBorda: "#cbd5e1", corTexto: "#475569", corAvatar: "#64748b" };
  }
  if (media < 6) {
    return { texto: "Risco", descricao: "Média geral abaixo de 6,0.", corFundo: "#fef2f2", corBorda: "#fecaca", corTexto: "#b91c1c", corAvatar: "#dc2626" };
  }
  if (media < 8) {
    return { texto: "Atenção", descricao: "Média geral entre 6,0 e 7,9.", corFundo: "#fffbeb", corBorda: "#fde68a", corTexto: "#92400e", corAvatar: "#d97706" };
  }
  return { texto: "Bom desempenho", descricao: "Média geral igual ou acima de 8,0.", corFundo: "#ecfdf5", corBorda: "#bbf7d0", corTexto: "#166534", corAvatar: "#16a34a" };
}

function obterIniciais(nome: string) {
  const partes = nome.trim().split(" ").filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function mostrarNota(nota: number | null) {
  if (nota === null) return "Pendente";
  return nota.toFixed(1);
}

export default function HomeScreen() {
  const [filhos, setFilhos] = useState<Filho[]>([criarFilho("Aluno 1", "7", "701")]);
  const [filhoSelecionado, setFilhoSelecionado] = useState(0);
  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState(0);
  const [trimestreSelecionado, setTrimestreSelecionado] = useState<Trimestre>("t1");
  const [npDesejada, setNpDesejada] = useState("8.0");
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [modoFormulario, setModoFormulario] = useState<ModoFormulario>(null);
  const [nomeFormulario, setNomeFormulario] = useState("");
  const [serieFormulario, setSerieFormulario] = useState<Serie>("7");
  const [turmaFormulario, setTurmaFormulario] = useState("701");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    async function carregarDados() {
      try {
        const dadosSalvos = await AsyncStorage.getItem(CHAVE_STORAGE);
        if (dadosSalvos) {
          const dados = JSON.parse(dadosSalvos);
          if (Array.isArray(dados)) {
            const filhoMigrado: Filho = { id: String(Date.now()), nome: "Aluno 1", serie: "7", turma: "701", disciplinas: dados };
            setFilhos([filhoMigrado]);
          } else if (dados && Array.isArray(dados.filhos)) {
            setFilhos(dados.filhos);
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
        if (dadosCarregados) await AsyncStorage.setItem(CHAVE_STORAGE, JSON.stringify({ filhos }));
      } catch (erro) {
        console.log("Erro ao salvar dados:", erro);
      }
    }
    salvarDados();
  }, [filhos, dadosCarregados]);

  const filho = filhos[filhoSelecionado] ?? filhos[0];
  const disciplina = filho.disciplinas[disciplinaSelecionada];
  const trimestre = disciplina.trimestres[trimestreSelecionado];
  const mediaAP = calcularMediaAP(disciplina, trimestre);
  const np = calcularNP(disciplina, trimestre);
  const npr = calcularNPR(disciplina, trimestre);
  const notaConsiderada = calcularNotaConsiderada(disciplina, trimestre);
  const mediaFinalParcial = calcularMediaFinalParcial(disciplina);
  const mediaGeralAluno = calcularMediaGeralAluno(filho);
  const alertaMediaGeral = obterAlertaMedia(mediaGeralAluno);
  const npDesejadaNumero = textoParaNumero(npDesejada) ?? 8.0;
  const nomeAP = prefixoAP(trimestreSelecionado);

  function atualizarCampo(campo: keyof NotasTrimestre, valor: string) {
    const novosFilhos = filhos.map((filhoAtual, indexFilho) => {
      if (indexFilho !== filhoSelecionado) return filhoAtual;
      return {
        ...filhoAtual,
        disciplinas: filhoAtual.disciplinas.map((disc, indexDisciplina) => {
          if (indexDisciplina !== disciplinaSelecionada) return disc;
          return { ...disc, trimestres: { ...disc.trimestres, [trimestreSelecionado]: { ...disc.trimestres[trimestreSelecionado], [campo]: valor } } };
        }),
      };
    });
    setFilhos(novosFilhos);
  }

  function abrirNovoFilho() {
    if (filhos.length >= LIMITE_FILHOS) {
      setMensagem("Limite de 5 filhos atingido.");
      return;
    }
    setMensagem("");
    setModoFormulario("novo");
    setNomeFormulario("");
    setSerieFormulario("7");
    setTurmaFormulario("701");
  }

  function abrirEditarFilho() {
    setMensagem("");
    setModoFormulario("editar");
    setNomeFormulario(filho.nome);
    setSerieFormulario(filho.serie);
    setTurmaFormulario(filho.turma);
  }

  function cancelarFormulario() {
    setModoFormulario(null);
    setMensagem("");
  }

  function selecionarSerie(serie: Serie) {
    setSerieFormulario(serie);
    setTurmaFormulario(`${serie}01`);
  }

  function salvarFilho() {
    const nomeLimpo = nomeFormulario.trim();
    if (!nomeLimpo) {
      setMensagem("Informe o nome do aluno.");
      return;
    }
    if (modoFormulario === "novo") {
      if (filhos.length >= LIMITE_FILHOS) {
        setMensagem("Limite de 5 filhos atingido.");
        return;
      }
      const novoFilho = criarFilho(nomeLimpo, serieFormulario, turmaFormulario);
      setFilhos([...filhos, novoFilho]);
      setFilhoSelecionado(filhos.length);
      setDisciplinaSelecionada(0);
      setTrimestreSelecionado("t1");
      setModoFormulario(null);
      setMensagem("Aluno adicionado com sucesso.");
      return;
    }
    if (modoFormulario === "editar") {
      setFilhos(filhos.map((item, index) => index === filhoSelecionado ? { ...item, nome: nomeLimpo, serie: serieFormulario, turma: turmaFormulario } : item));
      setModoFormulario(null);
      setMensagem("Dados do aluno atualizados.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appNome}>Média CMB</Text>
        <Text style={styles.appSubtitulo}>Acompanhe notas, trimestres e recuperação com clareza.</Text>
      </View>

      <View style={[styles.cardAluno, { backgroundColor: alertaMediaGeral.corFundo, borderColor: alertaMediaGeral.corBorda }]}>
        <Text style={styles.cardEtiqueta}>PAINEL DO ALUNO</Text>
        <View style={styles.areaPerfil}>
          <View style={[styles.avatar, { backgroundColor: alertaMediaGeral.corAvatar }]}>
            <Text style={styles.avatarTexto}>{obterIniciais(filho.nome)}</Text>
          </View>
          <View style={styles.areaDadosAluno}>
            <Text style={styles.alunoNome}>{filho.nome}</Text>
            <Text style={styles.info}>{filho.serie}º Ano • Turma {filho.turma}</Text>
            <Text style={[styles.mediaGeral, { color: alertaMediaGeral.corTexto }]}>Média geral: {mostrarNota(mediaGeralAluno)}</Text>
            <Text style={[styles.alertaMedia, { color: alertaMediaGeral.corTexto }]}>{alertaMediaGeral.texto}</Text>
            <Text style={[styles.alertaDescricao, { color: alertaMediaGeral.corTexto }]}>{alertaMediaGeral.descricao}</Text>
          </View>
        </View>
        <View style={styles.listaBotoes}>
          {filhos.map((item, index) => (
            <Pressable key={item.id} style={[styles.botao, filhoSelecionado === index && styles.botaoAtivo]} onPress={() => { setFilhoSelecionado(index); setDisciplinaSelecionada(0); setTrimestreSelecionado("t1"); setMensagem(""); }}>
              <Text style={[styles.botaoTexto, filhoSelecionado === index && styles.botaoTextoAtivo]}>{item.nome}</Text>
            </Pressable>
          ))}
        </View>
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
          <Text style={styles.label}>Ano/Série</Text>
          <View style={styles.listaBotoes}>
            {(["6", "7", "8", "9"] as Serie[]).map((serie) => (
              <Pressable key={serie} style={[styles.botao, serieFormulario === serie && styles.botaoAtivo]} onPress={() => selecionarSerie(serie)}>
                <Text style={[styles.botaoTexto, serieFormulario === serie && styles.botaoTextoAtivo]}>{serie}º Ano</Text>
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
          <View style={styles.linhaAcoes}>
            <Pressable style={styles.botaoSalvar} onPress={salvarFilho}><Text style={styles.botaoSalvarTexto}>Salvar aluno</Text></Pressable>
            <Pressable style={styles.botaoCancelar} onPress={cancelarFormulario}><Text style={styles.botaoCancelarTexto}>Cancelar</Text></Pressable>
          </View>
        </View>
      )}

      <Text style={styles.subtitulo}>1. Disciplina</Text>
      <View style={styles.listaBotoes}>
        {filho.disciplinas.map((item, index) => (
          <Pressable key={item.nome} style={[styles.botao, disciplinaSelecionada === index && styles.botaoAtivo]} onPress={() => setDisciplinaSelecionada(index)}>
            <Text style={[styles.botaoTexto, disciplinaSelecionada === index && styles.botaoTextoAtivo]}>{item.nome}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.subtitulo}>2. Trimestre</Text>
      <View style={styles.trimestres}>
        {(["t1", "t2", "t3"] as Trimestre[]).map((tri) => (
          <Pressable key={tri} style={[styles.trimestreBotao, trimestreSelecionado === tri && styles.botaoAtivo]} onPress={() => setTrimestreSelecionado(tri)}>
            <Text style={[styles.botaoTexto, trimestreSelecionado === tri && styles.botaoTextoAtivo]}>{tituloTrimestre(tri)}</Text>
          </Pressable>
        ))}
      </View>

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
          {disciplina.usaAP3 && (
            <View style={styles.grupoInput}>
              <Text style={styles.miniLabel}>{nomeAP}.3</Text>
              <TextInput style={styles.inputPequeno} value={trimestre.ap3} onChangeText={(valor) => atualizarCampo("ap3", valor)} keyboardType="decimal-pad" placeholder="Ex.: 8.5" placeholderTextColor="#e2e8f0" />
            </View>
          )}
        </View>
        <Text style={styles.info}>Média das APs: {mostrarNota(mediaAP)}</Text>
        <Text style={styles.label}>GIP - Incentivo de Participação</Text>
        <TextInput style={styles.input} value={trimestre.gip} onChangeText={(valor) => atualizarCampo("gip", valor)} keyboardType="decimal-pad" placeholder="Ex.: 1.0" placeholderTextColor="#e2e8f0" />
        {disciplina.usaAE && (
          <>
            <Text style={styles.label}>AE - Avaliação de Estudo</Text>
            <TextInput style={styles.input} value={trimestre.ae} onChangeText={(valor) => atualizarCampo("ae", valor)} keyboardType="decimal-pad" placeholder="Ex.: 7.5" placeholderTextColor="#e2e8f0" />
          </>
        )}
        {!disciplina.usaAE && <Text style={styles.info}>Esta disciplina não possui AE. A NP será calculada pela média das APs + GIP.</Text>}
        <Text style={styles.resultado}>NP: {mostrarNota(np)}</Text>
        <Text style={styles.label}>AR - Avaliação de Recuperação</Text>
        <TextInput style={styles.input} value={trimestre.ar} onChangeText={(valor) => atualizarCampo("ar", valor)} keyboardType="decimal-pad" placeholder="Opcional" placeholderTextColor="#e2e8f0" />
        <Text style={styles.info}>NPR: {mostrarNota(npr)}</Text>
        <Text style={styles.info}>Nota considerada no boletim: {mostrarNota(notaConsiderada)}</Text>
      </View>

      <View style={styles.cardDestaque}>
        <Text style={styles.cardEtiqueta}>RESUMO DA DISCIPLINA</Text>
        <Text style={styles.resultadoGrande}>Média parcial: {mostrarNota(mediaFinalParcial)}</Text>
        <Text style={styles.situacao}>Status: {situacao(mediaFinalParcial)}</Text>
        <Text style={styles.info}>{calcularNecessidadeFinal(disciplina, 6.0)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Quanto precisa tirar na AE?</Text>
        <Text style={styles.explicacao}>Informe a NP desejada neste trimestre. O app calcula a nota mínima necessária na AE, considerando as APs e o GIP já lançados.</Text>
        {disciplina.usaAE ? (
          <>
            <Text style={styles.label}>NP desejada neste trimestre</Text>
            <TextInput style={styles.input} value={npDesejada} onChangeText={setNpDesejada} keyboardType="decimal-pad" placeholder="Ex.: 8.0" placeholderTextColor="#e2e8f0" />
            <Text style={styles.resultado}>{calcularAENecessaria(disciplina, trimestre, npDesejadaNumero)}</Text>
          </>
        ) : (
          <Text style={styles.info}>Esta disciplina não usa AE. Para melhorar a NP, foque nas APs e no GIP.</Text>
        )}
      </View>

      <Text style={styles.formula}>Fórmulas: NP = 0,4 × (AP + GIP) + 0,6 × AE | Sem AE: NP = AP + GIP, limitada a 10 | NPR = (AR + NP) ÷ 2 | NF = média das notas consideradas.</Text>
      <Text style={styles.rodape}>Desenvolvido por EDS Ideas Factory</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 54, backgroundColor: "#f3f6fb", flexGrow: 1 },
  header: { marginBottom: 20 },
  appNome: { fontSize: 38, fontWeight: "bold", color: "#0f172a" },
  appSubtitulo: { marginTop: 8, fontSize: 16, lineHeight: 22, color: "#475569" },
  subtitulo: { marginTop: 24, marginBottom: 10, fontSize: 22, fontWeight: "bold", color: "#1f2937" },
  cardAluno: { marginTop: 4, borderRadius: 22, padding: 18, borderWidth: 1 },
  cardEtiqueta: { fontSize: 12, fontWeight: "bold", color: "#64748b", letterSpacing: 1, marginBottom: 10 },
  areaPerfil: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#ffffff" },
  avatarTexto: { color: "#ffffff", fontSize: 26, fontWeight: "bold" },
  areaDadosAluno: { flex: 1 },
  alunoNome: { fontSize: 25, fontWeight: "bold", color: "#1d4ed8" },
  mediaGeral: { marginTop: 8, fontSize: 21, fontWeight: "bold" },
  alertaMedia: { marginTop: 4, fontSize: 16, fontWeight: "bold" },
  alertaDescricao: { marginTop: 2, fontSize: 13 },
  listaBotoes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  botao: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d1d5db" },
  botaoTurma: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d1d5db" },
  botaoAtivo: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" },
  botaoTexto: { fontSize: 14, color: "#374151", fontWeight: "600" },
  botaoTextoAtivo: { color: "#ffffff" },
  linhaAcoes: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  botaoSecundario: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#93c5fd" },
  botaoSecundarioTexto: { fontWeight: "bold", color: "#1d4ed8" },
  botaoSalvar: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#16a34a" },
  botaoSalvarTexto: { fontWeight: "bold", color: "#ffffff" },
  botaoCancelar: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d1d5db" },
  botaoCancelarTexto: { fontWeight: "bold", color: "#374151" },
  mensagem: { marginTop: 10, color: "#1d4ed8", fontWeight: "bold" },
  trimestres: { flexDirection: "row", gap: 8 },
  trimestreBotao: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#d1d5db", alignItems: "center" },
  card: { marginTop: 18, backgroundColor: "#ffffff", borderRadius: 20, padding: 18, elevation: 3 },
  cardDestaque: { marginTop: 18, backgroundColor: "#ecfdf5", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#bbf7d0" },
  cardTitulo: { fontSize: 21, fontWeight: "bold", color: "#111827", marginBottom: 12 },
  label: { marginTop: 12, marginBottom: 6, fontSize: 15, fontWeight: "600", color: "#374151" },
  explicacao: { fontSize: 15, lineHeight: 21, color: "#475569", marginBottom: 6 },
  linhaInputs: { flexDirection: "row", gap: 8 },
  grupoInput: { flex: 1 },
  miniLabel: { marginBottom: 6, fontSize: 13, fontWeight: "600", color: "#4b5563", textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 14, padding: 12, fontSize: 18, backgroundColor: "#ffffff" },
  inputPequeno: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 14, padding: 12, fontSize: 18, backgroundColor: "#ffffff", textAlign: "center" },
  info: { marginTop: 10, fontSize: 16, lineHeight: 22, color: "#374151" },
  resultado: { marginTop: 14, fontSize: 20, fontWeight: "bold", color: "#166534" },
  resultadoGrande: { fontSize: 25, fontWeight: "bold", color: "#166534" },
  situacao: { marginTop: 8, fontSize: 20, fontWeight: "bold", color: "#1d4ed8" },
  formula: { marginTop: 22, fontSize: 13, lineHeight: 18, color: "#6b7280", textAlign: "center" },
  rodape: { marginTop: 16, marginBottom: 36, fontSize: 12, color: "#94a3b8", textAlign: "center", fontWeight: "600" },
});
