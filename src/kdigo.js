export const KDIGO = {
  intro: 'Resumo da diretriz KDIGO 2024 sobre Doença Renal Crônica (DRC): perda lenta e progressiva da função dos rins por mais de 3 meses.',
  cga: [
    { k: 'C', t: 'Causa', d: 'Diabetes, hipertensão, glomerulonefrite, rins policísticos, causa desconhecida. Descobrir a causa muda o tratamento.' },
    { k: 'G', t: 'TFG', d: 'Taxa de Filtração Glomerular estimada (TFGe): quanto o rim filtra.' },
    { k: 'A', t: 'Albuminúria', d: 'Proteína na urina (RAC): quanto o rim está lesionado.' },
  ],
  estagiosG: [
    ['G1', '≥ 90', 'Normal, mas já tem lesão'],
    ['G2', '60–89', 'Leve redução'],
    ['G3a', '45–59', 'Moderada leve'],
    ['G3b', '30–44', 'Moderada grave'],
    ['G4', '15–29', 'Grave'],
    ['G5', '< 15', 'Falência renal / diálise'],
  ],
  estagiosA: [
    ['A1', '< 30 mg/g', 'Normal'],
    ['A2', '30–300 mg/g', 'Moderadamente aumentada'],
    ['A3', '> 300 mg/g', 'Gravemente aumentada'],
  ],
  risco: 'Quanto pior o G e o A, maior o risco de diálise, infarto, AVC e morte.',
  sections: [
    { id: 'avaliar', emoji: '🔬', title: '1. Como avaliar', items: [
      'Creatinina + Cistatina C juntas estimam a TFG com mais precisão (a creatinina sozinha falha em idosos, pouca massa muscular e obesos).',
      'RAC na urina: a primeira urina da manhã é a ideal.',
      'Não usar mais a correção por raça nas fórmulas de TFG.',
      'Rastrear quem tem alto risco: diabetes, hipertensão, doença cardiovascular, histórico familiar, obesidade, uso prolongado de anti-inflamatórios, idosos.',
      'Investigar a causa: história, exames de sangue e urina, imagem, genética e, se preciso, biópsia. Até 25% ficam como causa desconhecida.',
    ]},
    { id: 'risco', emoji: '📈', title: '2. Como prever o risco', items: [
      'Usar equações de risco validadas para estimar o risco absoluto de falência renal em 2 e 5 anos.',
      'Encaminhar ao nefrologista: risco em 5 anos de 3% a 5%, TFGe < 30, RAC > 300, queda rápida da TFG, hematúria persistente, hipertensão resistente, obstrução.',
      'Preparar terapia substitutiva: risco em 2 anos > 40%. Risco em 2 anos > 10% já pede equipe multidisciplinar.',
      'Prever também risco cardiovascular e de morte com modelos específicos para DRC.',
    ]},
    { id: 'estilo', emoji: '🥦', title: '3A. Estilo de vida (base para todos)', items: [
      'Atividade física: pelo menos 150 min/semana de intensidade moderada.',
      'Parar totalmente de fumar e buscar peso saudável.',
      'Dieta com mais plantas e menos ultraprocessados, com nutricionista renal.',
      'Sódio < 2 g/dia (cerca de 5 g de sal/dia).',
      'Proteína 0,8 g/kg/dia em adultos G3–G5 sem diálise. Não restringir em crianças, idosos frágeis, desnutridos ou sarcopênicos.',
      'Dieta com proteína muito baixa (0,3–0,4 g) só com supervisão rigorosa e suplementação.',
    ]},
    { id: 'pa', emoji: '🩺', title: '3B. Pressão arterial', items: [
      'Adultos: PAS < 120 mmHg quando tolerada, com medida padronizada no consultório.',
      'Frágeis, com risco de queda ou hipotensão postural: meta menos intensa.',
      'Crianças: PAM de 24h no percentil 50 pela MAPA.',
    ]},
  ],
  pilares: [
    { n: 1, t: 'IECA ou BRA', sub: 'Inibidor do SRAA', items: [
      'Albuminúria A2/A3 com diabetes, e A3 sem diabetes. Dose máxima tolerada.',
      'Nunca combinar IECA + BRA + inibidor direto da renina.',
      'Manter mesmo com TFGe < 30. Suspender só com hipotensão sintomática, hipercalemia não controlada ou sintomas urêmicos com TFGe < 15.',
      'Checar creatinina e potássio 2 a 4 semanas após iniciar ou aumentar a dose. Aumento de creatinina até 30% é aceitável.',
    ]},
    { n: 2, t: 'Inibidor de SGLT2', sub: 'A grande novidade', items: [
      'DM2 + DRC com TFGe ≥ 20: recomendado (1A).',
      'DRC sem diabetes: TFGe ≥ 20 com RAC ≥ 200, ou insuficiência cardíaca, qualquer RAC.',
      'Continuar até diálise ou transplante. Queda pequena e reversível da TFGe no início é normal.',
      'Suspender temporariamente em cirurgia, jejum prolongado ou doença aguda grave.',
    ]},
    { n: 3, t: 'Finerenona (ns-MRA)', sub: 'Antagonista não esteroidal do receptor mineralocorticoide', items: [
      'DM2 + DRC com TFGe ≥ 25, potássio normal e albuminúria > 30 mg/g, mesmo já usando IECA/BRA + SGLT2i.',
      'Monitorar potássio com frequência: risco de hipercalemia.',
    ]},
    { n: 4, t: 'Agonista de GLP-1', sub: 'Para DM2 + DRC', items: [
      'Quando a meta glicêmica não foi atingida com metformina + SGLT2i.',
      'Priorizar os com benefício cardiovascular comprovado. Ajuda também no peso.',
    ]},
  ],
  outros: [
    { emoji: '🍬', title: 'Diabetes', items: ['Seguir a diretriz KDIGO Diabetes 2022, com metas glicêmicas individualizadas.'] },
    { emoji: '❤️', title: 'Colesterol e coração', items: [
      'Estatina: ≥ 50 anos com TFGe < 60, e 18–49 anos com risco alto.',
      'Aspirina em baixa dose só em prevenção secundária.',
      'Fibrilação atrial: preferir NOACs à varfarina em G1–G4, ajustando pela TFG.',
      'Coronariopatia estável: tratamento clínico intensivo primeiro.',
    ]},
    { emoji: '⚗️', title: 'Complicações', items: [
      'Acidose metabólica: tratar se bicarbonato < 18 mmol/L (melhora a nutrição).',
      'Hipercalemia: individualizar a dieta, sem proibir frutas e vegetais em geral. Quelantes de potássio ajudam a manter os medicamentos protetores.',
      'Anemia e doença mineral óssea: seguir as diretrizes KDIGO específicas.',
      'Gota: tratar se sintomática, não tratar hiperuricemia assintomática. Na crise, colchicina em dose baixa ou corticoide, evitar AINEs.',
    ]},
  ],
  medicamentos: [
    'Pacientes com DRC são mais sensíveis à nefrotoxicidade: revisar adesão, dose, interações e polifarmácia periodicamente.',
    'Ajustar dose pela TFGe, de preferência por creatinina. Em obesidade extrema, usar TFGe não indexada.',
    'Evitar AINEs, fitoterápicos e remédios de venda livre sem orientação. Avaliar risco teratogênico em idade fértil.',
    'Sick day rules: em doença aguda ou antes de cirurgia, pode ser preciso suspender metformina, IECA, BRA e SGLT2i por 48h, com plano claro de retorno.',
    'Contraste: avaliar risco de lesão renal aguda. Com TFG < 30 e gadolínio, preferir agentes dos grupos II e III.',
  ],
  cuidado: [
    'Equipe multidisciplinar: nefrologista, atenção primária, nutricionista, farmacêutico, psicólogo e enfermagem.',
    'Onde há poucos recursos, apoiar a atenção primária funciona melhor que focar só no especialista.',
    'Avaliar sintomas (fadiga, coceira, dor, depressão, distúrbio do sono): tratá-los importa tanto quanto os exames.',
    'Decisão compartilhada sobre diálise, transplante e cuidados conservadores ou paliativos.',
  ],
  mudancas: [
    'SGLT2i, ns-MRA e GLP-1 viraram tratamento padrão.',
    'Cistatina C ganhou força para confirmar o diagnóstico.',
    'Meta de PA mais baixa: < 120 mmHg.',
    'Foco no risco absoluto, não só no estágio.',
    'Foco no paciente: sintomas, qualidade de vida, idade, sexo e gênero.',
  ],
  resumo: 'Detecte cedo com creatinina + cistatina C + RAC, controle pressão e estilo de vida, e use os 4 pilares (IECA/BRA + SGLT2i + ns-MRA + GLP-1 se diabético) + estatina para frear a DRC e proteger o coração.',
}
