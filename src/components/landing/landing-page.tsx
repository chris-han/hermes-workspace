import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Moon,
  Shield,
  Sun,
  UploadCloud,
  Users,
} from 'lucide-react'

type Language = 'en' | 'zh'

const copy = {
  en: {
    eyebrow: 'The Semantic Tier for AI-Native Enterprises',
    title: 'Certainty Infrastructure',
    highlight: 'for AI-Native Enterprises',
    subtitle: "Don't align the mind. Govern the action.",
    description:
      'Semantier turns semantic uncertainty into governed certainty. It makes mission-critical AI actions justified, authorized, replayable, and auditable before execution.',
    support:
      'Built for finance, HR, and other high-consequence enterprise workflows where plausible AI output is not enough and human authority must remain explicit.',
    enter: 'Enter workspace',
    explore: 'Explore the system',
    problemTitle: 'Plausible output is not an admissible action',
    problemBody:
      'LLM agents can produce fluent recommendations and confident decisions. In enterprise environments, a proposed action must remain connected to human-defined value, authority, responsibility, and policy before it can execute.',
    contrast:
      'Mind alignment asks: is the model aligned with human intent?\nAdmissibility asks: is this proposed action allowed to happen?\nValue anchoring asks: whose purpose and authority make it legitimate?',
    gaps: 'Three critical gaps',
    loopTitle: 'From AI proposal to governed execution',
    loopBody:
      'Generation and execution are separate. AI experts propose actions; semantic governance allows, corrects, escalates, or blocks them and preserves replayable evidence.',
    expertsTitle: 'Governed AI experts for enterprise services',
    expertsBody:
      'Each expert works inside the same organizational OS: shared facts, authority, policy, replay bindings, and audit trail.',
    expertsClaim:
      'The experts are useful because they are governed. The OS is valuable because it makes their actions admissible.',
    financeTitle: 'Finance: governance of economic facts',
    financeBody:
      'Financial operations produce evidence-rich, high-consequence actions. These workflows prove that governed AI can reduce review burden while preventing unsafe execution.',
    hrTitle: 'HR: governance of organizational order and trust',
    hrBody:
      'AI-native organizations cannot govern money without governing trust. HR turns roles, authority, responsibility, and decision trajectories into evidence for trusted execution, without reducing governance to constant surveillance.',
    trustTitle: 'The trust stack behind governed AI work',
    proofTitle: 'Validated first in high-consequence accounting workflows',
    proofBody:
      'The research prototype was evaluated on REA accounting workflows, where ambiguity, evidence gaps, policy conflicts, and auditability can be tested in a compact benchmark.',
    nowTitle: 'Why this matters now',
    nowBody:
      'AI creates more proposed actions, exceptions, and machine-speed decisions than organizations can govern manually.',
    pilotTitle: 'Pilot governed AI experts in one real workflow',
    pilotBody:
      'Start with one finance or HR workflow where your team reviews evidence, applies policy, and escalates exceptions.',
    rights: 'All rights reserved',
  },
  zh: {
    eyebrow: '为 AI 原生企业而生的语义治理层',
    title: '为 AI 原生企业而生的',
    highlight: '确定性基础设施',
    subtitle: '治理行动，而非对齐思想。',
    description:
      'Semantier 将语义不确定性转化为受治理的确定性——让每一个关键 AI 行动在执行前都有据可查、经过授权、可重放、可审计。',
    support:
      '专为财务、人力资源等高影响企业流程而设计。在这些场景中，AI 输出看似合理还不够，人类权威必须始终清晰可见。',
    enter: '进入工作区',
    explore: '了解治理系统',
    problemTitle: '看似合理，不代表可以执行',
    problemBody:
      '大语言模型可以生成流畅的建议和自信的决策。但在企业环境中，一项行动必须在执行前与人类定义的价值、权威、责任和政策保持明确关联。',
    contrast:
      '思想对齐问的是：模型是否理解了人的意图？\n可接纳性问的是：这项行动是否被允许发生？\n价值锚定问的是：谁的目标与权威赋予它合法性？',
    gaps: '三个关键缺口',
    loopTitle: '从 AI 提议到受治理的执行',
    loopBody:
      '生成与执行彻底分离。AI 专家提出行动建议；语义治理负责放行、纠正、升级或拦截，并留存可回放证据。',
    expertsTitle: '面向企业服务的受治理 AI 专家',
    expertsBody:
      '每位专家都运行在同一套组织操作系统之上：共享事实、权威、策略、回放绑定与审计追踪。',
    expertsClaim:
      '专家因为被治理而可用；操作系统的价值在于让每项行动都具备可接纳性。',
    financeTitle: '财务：对经济事实的治理',
    financeBody:
      '财务运营会产生大量证据充分、后果重大的行动。这些流程能够验证受治理 AI 如何在防止不安全执行的同时减轻审核负担。',
    hrTitle: '人力资源：对组织秩序与信任的治理',
    hrBody:
      '组织执行力来自信任，而信任需要持续治理。Semantier 不是实时监督员工每一个离散动作，而是基于连续决策轨迹提供可信决策支持，判断决策质量，并沉淀组织学习。',
    trustTitle: '支撑受治理 AI 工作的信任体系',
    proofTitle: '首先在高影响会计流程中完成验证',
    proofBody:
      '研究原型在 REA 会计工作流程上进行了评估，以紧凑的基准暴露歧义、证据缺口、策略冲突和可审计性要求。',
    nowTitle: '为什么现在至关重要',
    nowBody:
      'AI 生成行动、例外和机器速度决策的能力，已经超过组织依靠人工治理的能力。',
    pilotTitle: '在一个真实工作流程中体验可控的企业级 AI 专家',
    pilotBody: '从团队已经在审查证据、执行政策和升级例外的财务或 HR 流程入手。',
    rights: '保留所有权利',
  },
} as const

const gaps = [
  [
    'Evidence gap',
    '证据缺口',
    'Plausible answers without sufficient source facts.',
    '看似合理的答案缺少充分的来源事实。',
  ],
  [
    'Authority gap',
    '权威缺口',
    'The required role or policy owner is missing.',
    '行动所需的角色或策略负责人缺位。',
  ],
  [
    'Replay gap',
    '回放缺口',
    'The decision cannot be reconstructed later.',
    '决策无法在事后被完整还原。',
  ],
] as const

const functionLists = {
  finance: {
    workflows: [
      ['Vendor invoice approval', '供应商发票审批'],
      ['Expense exception review', '费用例外审查'],
      ['Payment priority', '付款优先级排序'],
      ['Month-end close', '月末结账'],
      ['Revenue recognition', '收入确认'],
    ],
    value: [
      ['Shorter approval cycles', '缩短审批周期'],
      ['Fewer unsupported approvals', '减少无凭据审批'],
      ['Cleaner audit trail', '提升审计追踪清晰度'],
      ['Better management consensus', '强化管理层共识'],
      ['Reusable benchmark data', '沉淀可复用的基准数据'],
    ],
  },
  hr: {
    workflows: [
      ['Role and permission change', '角色与权限变更'],
      ['Hiring approval', '招聘审批'],
      ['Compensation exceptions', '薪酬例外处理'],
      ['Performance-review evidence', '绩效考核证据留存'],
      ['Policy eligibility checks', '政策资格核查'],
      ['Decision trajectory review', '决策轨迹复核'],
    ],
    value: [
      ['Clearer authority boundaries', '明确权威边界'],
      ['Less static screening bias', '减少静态筛选偏误'],
      ['Better evidence for people decisions', '强化人事决策证据'],
      ['Decision-quality trajectory review', '基于决策轨迹判断质量'],
      ['Consistent exception handling', '提升例外处理一致性'],
      ['Stronger responsibility links', '加强工作与责任联系'],
    ],
  },
} as const

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6 },
}

function Reveal({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div {...reveal} className={className}>
      {children}
    </motion.div>
  )
}

function LandingBackdrop() {
  return (
    <div className="landing-backdrop" aria-hidden="true">
      <div className="landing-grid" />
    </div>
  )
}

const trust = [
  [
    'Semantic Tier',
    '语义层',
    'Defines facts, concepts, authority hierarchy, and policy meaning.',
    '定义事实、概念、权威层级与策略含义。',
  ],
  [
    'Justification Gate',
    '论证关',
    'Requires evidence, rule context, and execution intent.',
    '要求提议引用证据、规则背景与执行意图。',
  ],
  [
    'Authority Layer',
    '权威层',
    'Checks whether the right organizational authority exists.',
    '核查是否具备相应的组织权威。',
  ],
  [
    'Governance Outcomes',
    '治理结果',
    'Allows, corrects, escalates, or blocks actions.',
    '对行动作出放行、纠正、升级或拦截。',
  ],
  [
    'Replay Binding',
    '回放绑定',
    'Pins facts, rules, artifacts, and context.',
    '锁定事实、规则、工件与上下文。',
  ],
  [
    'Audit Evidence',
    '审计证据',
    'Preserves the trail required for external trust.',
    '保留复核与外部信任所需的追踪记录。',
  ],
] as const

const governanceSteps = [
  [UploadCloud, 'Evidence Intake', '证据接入'],
  [Shield, 'Fact Admission', '事实准入'],
  [CheckCircle2, 'AI Proposal', 'AI 提议'],
  [AlertCircle, 'Justification', '论证说明'],
] as const

const governanceOutcomes = [
  ['Allow', '放行'],
  ['Correct', '纠正'],
  ['Escalate', '升级'],
  ['Block', '拦截'],
] as const

const nowPoints = [
  [
    'Enterprise actions grow with business scale',
    '企业行动数量随业务规模持续增长',
  ],
  ['Manual approval cannot scale', '人工审批无法线性扩展'],
  ['Evidence and authority remain mandatory', '证据与权威仍然不可省略'],
] as const

export function LandingPage() {
  const [language, setLanguage] = useState<Language>('en')
  const [isDark, setIsDark] = useState(false)
  const c = copy[language]
  const pick = (entry: readonly [string, string, string, string]) =>
    language === 'en' ? [entry[0], entry[2]] : [entry[1], entry[3]]

  useEffect(() => {
    const saved = localStorage.getItem('semantier-language')
    if (saved === 'en' || saved === 'zh') setLanguage(saved)
    const root = document.documentElement
    const landingTheme = localStorage.getItem('semantier-landing-theme')
    const dark = landingTheme === 'dark'
    setIsDark(dark)
    root.classList.toggle('dark', dark)
    root.classList.toggle('light', !dark)
    root.setAttribute('data-theme', dark ? 'semantier' : 'semantier-light')
    root.setAttribute('data-public-page', 'landing')
    root.setAttribute('data-language', saved === 'zh' ? 'zh' : 'en')
    root.lang = saved === 'zh' ? 'zh-CN' : 'en'
    root.style.colorScheme = dark ? 'dark' : 'light'
    window.__dismissSplash?.()
    return () => {
      root.removeAttribute('data-public-page')
      root.removeAttribute('data-language')
    }
  }, [])

  const changeLanguage = () => {
    const next = language === 'en' ? 'zh' : 'en'
    setLanguage(next)
    localStorage.setItem('semantier-language', next)
    document.documentElement.setAttribute('data-language', next)
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
  }

  const changeTheme = () => {
    const root = document.documentElement
    const nextDark = !isDark
    setIsDark(nextDark)
    root.classList.toggle('dark', nextDark)
    root.classList.toggle('light', !nextDark)
    root.setAttribute('data-theme', nextDark ? 'semantier' : 'semantier-light')
    root.style.colorScheme = nextDark ? 'dark' : 'light'
    localStorage.setItem('semantier-landing-theme', nextDark ? 'dark' : 'light')
  }

  return (
    <main className="landing-page" data-language={language}>
      <LandingBackdrop />
      <motion.header
        className="landing-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <a className="landing-brand" href="#top" aria-label="Semantier home">
          <img src="/logo.svg" alt="semantier logo" />
          <span>semantier</span>
        </a>
        <nav aria-label="Landing page controls">
          <motion.button
            className="landing-language-toggle"
            onClick={changeLanguage}
            aria-label="Switch language"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            中 / EN
          </motion.button>
          <motion.button
            onClick={changeTheme}
            aria-label="Toggle color theme"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isDark ? <Moon size={16} /> : <Sun size={16} />}
          </motion.button>
          <Link className="landing-button primary small" to={'/app' as string}>
            {c.enter}
          </Link>
        </nav>
      </motion.header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-content">
          <motion.span
            className="landing-eyebrow"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <i /> {c.eyebrow}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {c.title} <em>{c.highlight}</em>
          </motion.h1>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            {c.subtitle}
          </motion.h2>
          <motion.p
            className="landing-lead"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {c.description}
          </motion.p>
          <motion.p
            className="landing-support"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            {c.support}
          </motion.p>
          <motion.div
            className="landing-actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Link className="landing-button primary" to={'/app' as string}>
              {c.enter}
            </Link>
            <a className="landing-button secondary" href="#governance">
              {c.explore}
            </a>
          </motion.div>
        </div>
      </section>

      <section className="landing-section narrow">
        <Reveal>
          <h2>{c.problemTitle}</h2>
          <p className="section-lead">{c.problemBody}</p>
          <pre>{c.contrast}</pre>
          <h3 className="center-title">{c.gaps}</h3>
          <div className="landing-cards three">
            {gaps.map((gap, index) => {
              const [title, body] = pick(gap)
              return (
                <motion.article
                  {...reveal}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  key={title}
                >
                  <h3>{title}</h3>
                  <p>{body}</p>
                </motion.article>
              )
            })}
          </div>
        </Reveal>
      </section>

      <section className="landing-section tinted" id="governance">
        <Reveal className="section-heading">
          <h2>{c.loopTitle}</h2>
          <p>{c.loopBody}</p>
        </Reveal>
        <div className="governance-loop">
          {governanceSteps.map(([Icon, en, zh], index) => (
            <motion.div
              {...reveal}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="governance-step"
              key={en}
            >
              <b>
                <Icon size={23} />
              </b>
              <span>{language === 'en' ? en : zh}</span>
            </motion.div>
          ))}
        </div>
        <Reveal className="outcomes">
          {governanceOutcomes.map(([en, zh]) => (
            <span key={en}>{language === 'en' ? en : zh}</span>
          ))}
        </Reveal>
        <Reveal className="replay">
          <b>
            {language === 'en'
              ? 'Replay Binding & Audit Trail'
              : '回放绑定与审计追踪'}
          </b>
          <p>
            {language === 'en'
              ? 'Every decision is pinned to facts, rules, and context for complete reconstruction.'
              : '每项决策都绑定事实、规则与上下文，确保事后可以完整还原。'}
          </p>
        </Reveal>
      </section>

      <section className="landing-section">
        <Reveal className="section-heading">
          <h2>{c.expertsTitle}</h2>
          <p>{c.expertsBody}</p>
          <p className="section-claim">{c.expertsClaim}</p>
        </Reveal>
        <div className="landing-cards domains">
          <motion.article {...reveal}>
            <span className="domain-mark">
              <DollarSign size={25} />
            </span>
            <div className="domain-content">
              <small>{language === 'en' ? 'AVAILABLE NOW' : '已开放'}</small>
              <h3>{language === 'en' ? 'Finance Expert' : '财务专家'}</h3>
              <p>
                {language === 'en'
                  ? 'Invoices · Expenses · Payments · Close · Revenue recognition'
                  : '发票 · 费用 · 付款 · 结账 · 收入确认'}
              </p>
            </div>
          </motion.article>
          <motion.article
            {...reveal}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <span className="domain-mark">
              <Users size={25} />
            </span>
            <div className="domain-content">
              <small>{language === 'en' ? 'COMING SOON' : '即将开放'}</small>
              <h3>{language === 'en' ? 'HR Expert' : 'HR 专家'}</h3>
              <p>
                {language === 'en'
                  ? 'Roles · Hiring · Compensation · Performance · Policy eligibility'
                  : '角色 · 招聘 · 薪酬 · 绩效 · 政策资格'}
              </p>
            </div>
          </motion.article>
        </div>
      </section>

      <FunctionSection
        alternate
        title={c.financeTitle}
        body={c.financeBody}
        language={language}
        lists={functionLists.finance}
      />
      <FunctionSection
        title={c.hrTitle}
        body={c.hrBody}
        language={language}
        lists={functionLists.hr}
      />

      <section className="landing-section tinted narrow">
        <Reveal>
          <h2>{c.trustTitle}</h2>
        </Reveal>
        <div className="trust-stack">
          {trust.map((item, index) => {
            const [title, body] = pick(item)
            return (
              <motion.article
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                key={title}
              >
                <b>{String(index + 1).padStart(2, '0')}</b>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </motion.article>
            )
          })}
        </div>
      </section>

      <section className="landing-section narrow">
        <Reveal>
          <h2>{c.proofTitle}</h2>
          <p className="section-lead">{c.proofBody}</p>
          <aside>
            {language === 'en'
              ? 'Framework evidence, not a claim of universal deployment performance.'
              : '这是框架层面的证据，不等同于对所有部署场景的性能承诺。'}
          </aside>
        </Reveal>
      </section>
      <section className="landing-section tinted narrow">
        <Reveal>
          <h2>{c.nowTitle}</h2>
          <p className="section-lead">{c.nowBody}</p>
          <div className="now-list">
            {nowPoints.map(([en, zh]) => (
              <span key={en}>{language === 'en' ? en : zh}</span>
            ))}
          </div>
        </Reveal>
      </section>
      <section className="landing-section pilot" id="pilot">
        <Reveal>
          <h2>{c.pilotTitle}</h2>
          <p>{c.pilotBody}</p>
          <motion.div
            className="landing-inline-action"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link className="landing-button primary" to={'/app' as string}>
              {c.enter}
            </Link>
          </motion.div>
        </Reveal>
      </section>
      <footer className="landing-footer">
        <span className="landing-footer-brand">
          <span>semantier</span>
          <span aria-hidden="true">|</span>
          <span className="landing-footer-brand-zh">司序科技</span>
        </span>
        <small>
          © {new Date().getFullYear()} Semantier. {c.rights}.
        </small>
      </footer>
    </main>
  )
}

type BilingualList = ReadonlyArray<readonly [string, string]>

function FunctionSection({
  alternate = false,
  title,
  body,
  language,
  lists,
}: {
  alternate?: boolean
  title: string
  body: string
  language: Language
  lists: { workflows: BilingualList; value: BilingualList }
}) {
  const label = (item: readonly [string, string]) =>
    language === 'en' ? item[0] : item[1]

  return (
    <section className={`landing-section narrow ${alternate ? 'tinted' : ''}`}>
      <Reveal>
        <h2>{title}</h2>
        <p className="section-lead">{body}</p>
        <div className="function-grid">
          <article>
            <h3>{language === 'en' ? 'Example Workflows' : '示例工作流'}</h3>
            <ul>
              {lists.workflows.map((item) => (
                <li key={item[0]}>
                  <i />
                  {label(item)}
                </li>
              ))}
            </ul>
          </article>
          <article>
            <h3>{language === 'en' ? 'Customer Value' : '客户价值'}</h3>
            <ul>
              {lists.value.map((item) => (
                <li key={item[0]}>
                  <i />
                  {label(item)}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </Reveal>
    </section>
  )
}

declare global {
  interface Window {
    __dismissSplash?: () => void
  }
}
