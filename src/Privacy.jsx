import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { PRIVACY_CONTACT, PRIVACY_VERSION } from './config.js'
import { Card } from './ui.jsx'

const Section = ({ title, children }) => (
  <Card className="p-4">
    <h2 className="font-semibold text-slate-900 text-sm mb-2">{title}</h2>
    <div className="text-sm text-slate-600 space-y-2">{children}</div>
  </Card>
)
const List = ({ items }) => (
  <ul className="space-y-1.5">
    {items.map((t, i) => <li key={i} className="flex gap-2"><span aria-hidden="true" className="text-emerald-600">•</span><span>{t}</span></li>)}
  </ul>
)

// Texto descreve o que o app realmente faz hoje. Ao mudar o que é coletado, atualize aqui e aumente PRIVACY_VERSION
// (isso pede um novo aceite de quem já usa o app).
export function Privacy({ onBack }) {
  return (
    <div className="space-y-4">
      {onBack && <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 min-h-11 -my-2 pr-3"><ArrowLeft className="w-4 h-4" /> Voltar</button>}
      <Card>
        <div className="flex items-center gap-2 text-emerald-600 font-semibold"><ShieldCheck className="w-5 h-5" /> Política de Privacidade</div>
        <p className="text-sm text-slate-500 mt-1">Versão {PRIVACY_VERSION}. Em resumo: o que é só seu fica no seu aparelho, e o grupo vê apenas nome, avatar, pontos e sequência.</p>
      </Card>

      <Section title="Fica só no seu aparelho">
        <p>Estes dados nunca são enviados ao servidor:</p>
        <List items={['altura, peso (e o histórico de peso), IMC e meta de peso', 'idade, sexo e nível de atividade', 'o valor do humor registrado e seus objetivos']} />
      </Section>

      <Section title="O que vai para o servidor">
        <List items={[
          'nome ou apelido e avatar',
          'seu PIN de recuperação, guardado de forma irreversível (não dá para ler o PIN)',
          'metas diárias de água e sono',
          'registros de cada dia: refeições saudáveis, água (ml), atividade (min), sono (h) e apenas se você registrou peso e humor (sem os valores)',
          'pontos, sequência, dias salvos, o grupo e se você o administra',
          'seu endereço de rede (IP), embaralhado, por poucos minutos, só para limitar abusos',
        ]} />
      </Section>

      <Section title="Quem vê seus dados">
        <List items={[
          'Os participantes do seu grupo veem seu nome, avatar, pontos, sequência e títulos. Não veem peso, IMC nem humor.',
          'Quem administra o grupo vê a lista de membros e pode removê-los.',
          'Você pode sair do ranking dos outros em Perfil → "Compartilhar progresso no grupo".',
          'Não há publicidade, e os dados não são vendidos nem repassados a terceiros.',
        ]} />
      </Section>

      <Section title="Onde ficam e por quanto tempo">
        <p>Os dados enviados ficam em um banco de dados na nuvem, mantido por provedores de hospedagem. Permanecem enquanto você e o grupo existirem. Ao iniciar uma nova temporada, os pontos da temporada anterior são apagados.</p>
      </Section>

      <Section title="Seus direitos (LGPD)">
        <p>Você pode, a qualquer momento: acessar o que está registrado (tudo aparece no próprio app), corrigir seu nome e avatar, revogar o consentimento e <b>apagar todos os seus dados</b> em Perfil → "Apagar todos os dados". A exclusão remove você do servidor na hora. Quem administra um grupo com outras pessoas deve antes passar a administração.</p>
        <p>{PRIVACY_CONTACT ? <>Dúvidas ou pedidos: <a className="text-emerald-600 underline" href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.</> : 'Dúvidas ou pedidos: fale com quem administra o seu grupo.'}</p>
      </Section>

      <Section title="Aviso de saúde">
        <p>O app acompanha hábitos e não substitui orientação médica, nutricional ou de educação física. O resumo da diretriz KDIGO é material educativo.</p>
      </Section>
    </div>
  )
}

// Tela de aceite para quem ainda não aceitou a versão atual da política.
export function ConsentGate({ onAccept, onRead, readOpen, onClose }) {
  if (readOpen) return <div className="max-w-[552px] mx-auto px-4 py-6"><Privacy onBack={onClose} /></div>
  return (
    <div className="max-w-[592px] mx-auto px-4 py-10 min-h-screen flex flex-col justify-center">
      <Card className="p-6">
        <div className="flex items-center gap-2 text-emerald-600 font-semibold"><ShieldCheck className="w-5 h-5" /> Antes de continuar</div>
        <p className="text-sm text-slate-600 mt-3">Atualizamos a Política de Privacidade. Seu peso, altura e IMC continuam só no seu aparelho; o grupo vê apenas nome, avatar, pontos e sequência.</p>
        <button onClick={onRead} className="text-sm text-emerald-600 underline mt-3">Ler a política</button>
        <button onClick={onAccept} className="w-full h-12 mt-5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500">Li e aceito</button>
      </Card>
    </div>
  )
}
