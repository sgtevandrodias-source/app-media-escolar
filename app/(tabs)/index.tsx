import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Trimestre = "t1" | "t2" | "t3";

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

const DISCIPLINAS_BASE = [
  {
    nome: "Arte I",
    usaAE: false,
    usaAP3: false,
  },
  {
    nome: "Ciências Naturais",
    usaAE: true,
    usaAP3: true,
  },
  {
    nome: "Educação Física",
    usaAE: false,
    usaAP3: false,
  },
  {
    nome: "Geografia",
    usaAE: true,
    usaAP3: true,
  },
  {
    nome: "História",
    usaAE: true,
    usaAP3: true,
  },
  {
    nome: "LEM - Inglês",
    usaAE: true,
    usaAP3: true,
  },
  {
    nome: "Língua Portuguesa",
    usaAE: true,
    usaAP3: true,
  },
  {
    nome: "Matemática",
    usaAE: true,
    usaAP3: true,
  },
];

function criarTrimestre(): NotasTrimestre {
  return {
    ap1: "",
    ap2: "",
    ap3: "",
    gip: "",
    ae: "",
    ar: "",
  };
}

function criarDisciplinas(): Disciplina[] {
  return DISCIPLINAS_BASE.map((disciplina) => ({
    nome: disciplina.nome,
    usaAE: disciplina.usaAE,
    usaAP3: disciplina.usaAP3,
    trimestres: {
      t1: criarTrimestre(),
      t2: criarTrimestre(),
      t3: criarTrimestre(),
    },
  }));
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

function calcularMediaAP(
  disciplina: Disciplina,
  trimestre: NotasTrimestre
): number | null {
  const notasAP = [
    textoParaNumero(trimestre.ap1),
    textoParaNumero(trimestre.ap2),
  ];

  if (disciplina.usaAP3) {
    notasAP.push(textoParaNumero(trimestre.ap3));
  }

  const notasValidas = notasAP.filter((nota): nota is number => nota !== null);

  if (notasValidas.length === 0) return null;

  const soma = notasValidas.reduce((total, nota) => total + nota, 0);

  return arredondar(soma / notasValidas.length);
}

function calcularNP(
  disciplina: Disciplina,
  trimestre: NotasTrimestre
): number | null {
  const mediaAP = calcularMediaAP(disciplina, trimestre);
  const gip = textoParaNumero(trimestre.gip);

  if (mediaAP === null || gip === null) {
    return null;
  }

  const apMaisGip = limitarNota(mediaAP + gip);

  if (!disciplina.usaAE) {
    return arredondar(apMaisGip);
  }

  const ae = textoParaNumero(trimestre.ae);

  if (ae === null) {
    return null;
  }

  const np = 0.4 * apMaisGip + 0.6 * ae;

  return arredondar(np);
}

function calcularNPR(
  disciplina: Disciplina,
  trimestre: NotasTrimestre
): number | null {
  const np = calcularNP(disciplina, trimestre);
  const ar = textoParaNumero(trimestre.ar);

  if (np === null || ar === null) {
    return null;
  }

  return arredondar((ar + np) / 2);
}

function calcularNotaConsiderada(
  disciplina: Disciplina,
  trimestre: NotasTrimestre
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

  if (notas.length === 0) {
    return "Lance pelo menos uma nota periódica para calcular.";
  }

  const totalNecessario = mediaMinima * 3;
  const somaAtual = notas.reduce((total, nota) => total + nota, 0);
  const faltamTrimestres = 3 - notas.length;
  const falta = totalNecessario - somaAtual;

  if (falta <= 0) {
    return "Já atingiu a média mínima, mantendo os dados atuais.";
  }

  if (faltamTrimestres === 0) {
    return "Não atingiu a média mínima.";
  }

  const precisaPorTrimestre = falta / faltamTrimestres;

  if (precisaPorTrimestre > 10) {
    return "Precisaria de mais de 10 nos trimestres restantes.";
  }

  return `Precisa de ${precisaPorTrimestre.toFixed(
    1
  )} em cada trimestre restante para média 6,0.`;
}

function calcularAENecessaria(
  disciplina: Disciplina,
  trimestre: NotasTrimestre,
  npDesejada: number
) {
  if (!disciplina.usaAE) {
    return "Esta disciplina não usa AE. A NP é calculada pela média das APs + GIP.";
  }

  const mediaAP = calcularMediaAP(disciplina, trimestre);
  const gip = textoParaNumero(trimestre.gip);

  if (mediaAP === null || gip === null) {
    return "Informe as APs e o GIP.";
  }

  const apMaisGip = limitarNota(mediaAP + gip);
  const aeNecessaria = (npDesejada - 0.4 * apMaisGip) / 0.6;

  if (aeNecessaria <= 0) {
    return "As APs + GIP já garantem essa NP.";
  }

  if (aeNecessaria > 10) {
    return "Impossível atingir essa NP apenas com a AE.";
  }

  return `Precisa tirar ${aeNecessaria.toFixed(1)} na AE.`;
}

function situacao(media: number | null) {
  if (media === null) return "Sem dados suficientes";
  if (media >= 9) return "Excelente";
  if (media >= 7) return "Boa";
  if (media >= 6) return "Atenção";
  return "Risco";
}

function mostrarNota(nota: number | null) {
  if (nota === null) return "Pendente";
  return nota.toFixed(1);
}

export default function HomeScreen() {
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>(
    criarDisciplinas()
  );

  const [disciplinaSelecionada, setDisciplinaSelecionada] = useState(0);
  const [trimestreSelecionado, setTrimestreSelecionado] =
    useState<Trimestre>("t1");
  const [npDesejada, setNpDesejada] = useState("8.0");

  const disciplina = disciplinas[disciplinaSelecionada];
  const trimestre = disciplina.trimestres[trimestreSelecionado];

  const mediaAP = calcularMediaAP(disciplina, trimestre);
  const np = calcularNP(disciplina, trimestre);
  const npr = calcularNPR(disciplina, trimestre);
  const notaConsiderada = calcularNotaConsiderada(disciplina, trimestre);
  const mediaFinalParcial = calcularMediaFinalParcial(disciplina);

  const npDesejadaNumero = textoParaNumero(npDesejada) ?? 8.0;
  const nomeAP = prefixoAP(trimestreSelecionado);

  function atualizarCampo(campo: keyof NotasTrimestre, valor: string) {
    const novasDisciplinas = disciplinas.map((disc, index) => {
      if (index !== disciplinaSelecionada) return disc;

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

    setDisciplinas(novasDisciplinas);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>Média Escolar</Text>

      <Text style={styles.descricao}>
        Escolha a disciplina, lance as notas e acompanhe a situação do aluno.
      </Text>

      <Text style={styles.subtitulo}>1. Disciplina</Text>

      <View style={styles.listaBotoes}>
        {disciplinas.map((item, index) => (
          <Pressable
            key={item.nome}
            style={[
              styles.botao,
              disciplinaSelecionada === index && styles.botaoAtivo,
            ]}
            onPress={() => setDisciplinaSelecionada(index)}
          >
            <Text
              style={[
                styles.botaoTexto,
                disciplinaSelecionada === index && styles.botaoTextoAtivo,
              ]}
            >
              {item.nome}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.subtitulo}>2. Trimestre</Text>

      <View style={styles.trimestres}>
        <Pressable
          style={[
            styles.trimestreBotao,
            trimestreSelecionado === "t1" && styles.botaoAtivo,
          ]}
          onPress={() => setTrimestreSelecionado("t1")}
        >
          <Text
            style={[
              styles.botaoTexto,
              trimestreSelecionado === "t1" && styles.botaoTextoAtivo,
            ]}
          >
            1º Trimestre
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.trimestreBotao,
            trimestreSelecionado === "t2" && styles.botaoAtivo,
          ]}
          onPress={() => setTrimestreSelecionado("t2")}
        >
          <Text
            style={[
              styles.botaoTexto,
              trimestreSelecionado === "t2" && styles.botaoTextoAtivo,
            ]}
          >
            2º Trimestre
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.trimestreBotao,
            trimestreSelecionado === "t3" && styles.botaoAtivo,
          ]}
          onPress={() => setTrimestreSelecionado("t3")}
        >
          <Text
            style={[
              styles.botaoTexto,
              trimestreSelecionado === "t3" && styles.botaoTextoAtivo,
            ]}
          >
            3º Trimestre
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>
          {disciplina.nome} — {tituloTrimestre(trimestreSelecionado)}
        </Text>

        <Text style={styles.label}>
          {disciplina.nome} - {nomeAP}
        </Text>

        <View style={styles.linhaInputs}>
          <View style={styles.grupoInput}>
            <Text style={styles.miniLabel}>{nomeAP}.1</Text>
            <TextInput
              style={styles.inputPequeno}
              value={trimestre.ap1}
              onChangeText={(valor) => atualizarCampo("ap1", valor)}
              keyboardType="decimal-pad"
              placeholder="Ex.: 8.5"
              placeholderTextColor="#cbd5e1"
            />
          </View>

          <View style={styles.grupoInput}>
            <Text style={styles.miniLabel}>{nomeAP}.2</Text>
            <TextInput
              style={styles.inputPequeno}
              value={trimestre.ap2}
              onChangeText={(valor) => atualizarCampo("ap2", valor)}
              keyboardType="decimal-pad"
              placeholder="Ex.: 8.5"
              placeholderTextColor="#cbd5e1"
            />
          </View>

          {disciplina.usaAP3 && (
            <View style={styles.grupoInput}>
              <Text style={styles.miniLabel}>{nomeAP}.3</Text>
              <TextInput
                style={styles.inputPequeno}
                value={trimestre.ap3}
                onChangeText={(valor) => atualizarCampo("ap3", valor)}
                keyboardType="decimal-pad"
                placeholder="Ex.: 8.5"
                placeholderTextColor="#cbd5e1"
              />
            </View>
          )}
        </View>

        <Text style={styles.info}>Média das APs: {mostrarNota(mediaAP)}</Text>

        <Text style={styles.label}>GIP - Incentivo de Participação</Text>
        <TextInput
          style={styles.input}
          value={trimestre.gip}
          onChangeText={(valor) => atualizarCampo("gip", valor)}
          keyboardType="decimal-pad"
          placeholder="Ex.: 1.0"
          placeholderTextColor="#cbd5e1"
        />

        {disciplina.usaAE && (
          <>
            <Text style={styles.label}>AE - Avaliação de Estudo</Text>
            <TextInput
              style={styles.input}
              value={trimestre.ae}
              onChangeText={(valor) => atualizarCampo("ae", valor)}
              keyboardType="decimal-pad"
              placeholder="Ex.: 7.5"
              placeholderTextColor="#cbd5e1"
            />
          </>
        )}

        {!disciplina.usaAE && (
          <Text style={styles.info}>
            Esta disciplina não possui AE. A NP será calculada pela média das
            APs + GIP.
          </Text>
        )}

        <Text style={styles.resultado}>NP: {mostrarNota(np)}</Text>

        <Text style={styles.label}>AR - Avaliação de Recuperação</Text>
        <TextInput
          style={styles.input}
          value={trimestre.ar}
          onChangeText={(valor) => atualizarCampo("ar", valor)}
          keyboardType="decimal-pad"
          placeholder="Opcional"
          placeholderTextColor="#cbd5e1"
        />

        <Text style={styles.info}>NPR: {mostrarNota(npr)}</Text>

        <Text style={styles.info}>
          Nota considerada no boletim: {mostrarNota(notaConsiderada)}
        </Text>
      </View>

      <View style={styles.cardDestaque}>
        <Text style={styles.cardTitulo}>Situação da disciplina</Text>

        <Text style={styles.resultadoGrande}>
          Média parcial: {mostrarNota(mediaFinalParcial)}
        </Text>

        <Text style={styles.situacao}>
          Situação: {situacao(mediaFinalParcial)}
        </Text>

        <Text style={styles.info}>
          {calcularNecessidadeFinal(disciplina, 6.0)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Planejamento da AE</Text>

        {disciplina.usaAE ? (
          <>
            <Text style={styles.label}>NP desejada neste trimestre</Text>

            <TextInput
              style={styles.input}
              value={npDesejada}
              onChangeText={setNpDesejada}
              keyboardType="decimal-pad"
              placeholder="Ex.: 8.0"
              placeholderTextColor="#cbd5e1"
            />

            <Text style={styles.resultado}>
              {calcularAENecessaria(disciplina, trimestre, npDesejadaNumero)}
            </Text>
          </>
        ) : (
          <Text style={styles.info}>
            Esta disciplina não usa AE. Para melhorar a NP, foque nas APs e no
            GIP.
          </Text>
        )}
      </View>

      <Text style={styles.formula}>
        Fórmulas: NP = 0,4 × (AP + GIP) + 0,6 × AE | Sem AE: NP = AP + GIP,
        limitada a 10 | NPR = (AR + NP) ÷ 2 | NF = média das notas
        consideradas.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#f3f6fb",
    flexGrow: 1,
  },
  titulo: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111827",
  },
  descricao: {
    marginTop: 8,
    fontSize: 15,
    color: "#4b5563",
  },
  subtitulo: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  listaBotoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  botao: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  botaoAtivo: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  botaoTexto: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
  },
  botaoTextoAtivo: {
    color: "#ffffff",
  },
  trimestres: {
    flexDirection: "row",
    gap: 8,
  },
  trimestreBotao: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  card: {
    marginTop: 18,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    elevation: 3,
  },
  cardDestaque: {
    marginTop: 18,
    backgroundColor: "#ecfdf5",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  cardTitulo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  linhaInputs: {
    flexDirection: "row",
    gap: 8,
  },
  grupoInput: {
    flex: 1,
  },
  miniLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    backgroundColor: "#ffffff",
  },
  inputPequeno: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    backgroundColor: "#ffffff",
    textAlign: "center",
  },
  info: {
    marginTop: 10,
    fontSize: 16,
    color: "#374151",
  },
  resultado: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "bold",
    color: "#166534",
  },
  resultadoGrande: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#166534",
  },
  situacao: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "bold",
    color: "#1d4ed8",
  },
  formula: {
    marginTop: 22,
    marginBottom: 30,
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
  },
});