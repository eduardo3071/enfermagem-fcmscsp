export const AVATARS = ['🙂', '🦋', '🦁', '🌸', '🐯', '🚀', '🦊', '🐼', '🦉', '🐢', '🌟', '🔥']
export const GROUP_ICONS = ['🌱', '🔥', '💪', '🌊', '🏃', '🥗', '🏆', '☀️', '🧘', '❤️']

export const OBJECTIVES = [
  { id: 'food', emoji: '🥗', label: 'Melhorar alimentação' },
  { id: 'exercise', emoji: '🏃', label: 'Praticar mais exercícios' },
  { id: 'water', emoji: '💧', label: 'Beber mais água' },
  { id: 'sleep', emoji: '😴', label: 'Dormir melhor' },
  { id: 'weight', emoji: '⚖️', label: 'Acompanhar peso' },
  { id: 'wellbeing', emoji: '🧘', label: 'Melhorar bem-estar' },
  { id: 'consistency', emoji: '🔥', label: 'Criar consistência' },
]

export const ACTIVITY_LEVELS = ['Sedentário', 'Leve', 'Moderado', 'Intenso']
export const SEX_OPTIONS = ['Prefiro não informar', 'Masculino', 'Feminino']

// Tarefas diárias: id, texto da lista, rótulo do hábito, emoji, pontos máximos
export const TASKS = [
  { id: 'food', label: 'Registrar alimentação', habit: 'Alimentação', emoji: '🥗', max: 20 },
  { id: 'water', label: 'Bater meta de água', habit: 'Água', emoji: '💧', max: 20 },
  { id: 'activity', label: 'Atividade física', habit: 'Exercício', emoji: '🏃', max: 30 },
  { id: 'sleep', label: 'Registrar sono', habit: 'Sono', emoji: '😴', max: 15 },
  { id: 'weight', label: 'Registrar peso', habit: 'Peso', emoji: '⚖️', max: 5 },
  { id: 'mood', label: 'Check-in de bem-estar', habit: 'Bem-estar', emoji: '🧘', max: 10 },
]

export const MOODS = ['😞', '😕', '😐', '🙂', '😄']

export const GROUP_TITLES = [
  { key: 'water', emoji: '💧', label: 'Mestre da Hidratação' },
  { key: 'consistent', emoji: '🔥', label: 'Mais Consistente' },
  { key: 'activity', emoji: '🏃', label: 'Rei/Rainha do Treino' },
  { key: 'sleep', emoji: '😴', label: 'Dorminhoco Saudável' },
]

export const ACHIEVEMENTS = [
  { id: 'first', emoji: '🔥', label: 'Primeiro Passo', test: s => s.activeDays >= 1 },
  { id: 'd3', emoji: '🔥', label: '3 Dias', test: s => s.best >= 3 },
  { id: 'd7', emoji: '🔥', label: 'Uma Semana', test: s => s.best >= 7 },
  { id: 'water', emoji: '💧', label: 'Hidratado', test: s => s.counts.water >= 1 },
  { id: 'move', emoji: '🏃', label: 'Em Movimento', test: s => s.counts.activity >= 1 },
  { id: 'food', emoji: '🥗', label: 'Comida na Agenda', test: s => s.counts.food >= 3 },
  { id: 'sleep', emoji: '😴', label: 'Sono em Dia', test: s => s.counts.sleep >= 3 },
  { id: 'done', emoji: '🏆', label: 'Desafio Completo', test: s => s.activeDays >= 30 },
]

export const DISCLAIMER = 'App de acompanhamento e gamificação. Não substitui orientação médica, nutricional ou de educação física.'

export function bmi(weight, heightCm) {
  const h = heightCm / 100
  if (!weight || !h) return null
  const v = weight / (h * h)
  const [label, tone] =
    v < 18.5 ? ['Abaixo do peso', 'sky'] : v < 25 ? ['Peso normal', 'emerald'] : v < 30 ? ['Sobrepeso', 'amber'] : ['Obesidade', 'rose']
  return { value: v.toFixed(1), label, tone }
}
