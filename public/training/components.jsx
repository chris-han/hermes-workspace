/* global React, marked, mermaid */

const { useState, useMemo, useEffect, useRef } = React;

function normalizeMarkdownPath(href, basePath = '') {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;

  try {
    const trainingPrefix = document.baseURI || `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
    const baseDir = basePath.includes('/') ? basePath.split('/').slice(0, -1).join('/') : '';
    const baseUrl = baseDir ? `${trainingPrefix}${baseDir}/` : trainingPrefix;
    const url = new URL(href, baseUrl);
    if (url.origin !== window.location.origin) return null;

    const trainingPath = new URL(trainingPrefix).pathname;
    if (!url.pathname.startsWith(trainingPath)) return null;

    const relativePath = decodeURIComponent(url.pathname.slice(trainingPath.length)).replace(/^\/+/, '');
    if (!relativePath.endsWith('.md') || relativePath.includes('..')) return null;
    return relativePath;
  } catch (e) {
    return null;
  }
}

function getTrainingBasePath() {
  return new URL(document.baseURI || `${window.location.origin}/training/`).pathname;
}

function MarkdownRenderer({ markdown, theme = 'light', onOpenMarkdown, sourcePath = '' }) {
  const containerRef = useRef(null);
  const html = useMemo(() => {
    if (!markdown) return '';
    return marked.parse(markdown);
  }, [markdown]);
  const mermaidThemeVariables = useMemo(() => {
    if (theme !== 'dark') return {};
    return {
      background: '#1a1a16',
      mainBkg: '#22221e',
      secondBkg: '#1a1a16',
      tertiaryColor: '#2d2d28',
      primaryColor: '#22221e',
      primaryBorderColor: '#9fe870',
      primaryTextColor: '#f5f5f0',
      secondaryColor: '#22221e',
      secondaryBorderColor: '#9fe870',
      secondaryTextColor: '#f5f5f0',
      tertiaryTextColor: '#f5f5f0',
      textColor: '#f5f5f0',
      titleColor: '#f5f5f0',
      lineColor: '#e2f6d5',
      nodeBorder: '#9fe870',
      clusterBkg: '#22221e',
      clusterBorder: '#868685',
      edgeLabelBackground: '#22221e',
      actorBkg: '#22221e',
      actorBorder: '#9fe870',
      actorTextColor: '#f5f5f0',
      signalColor: '#e2f6d5',
      signalTextColor: '#f5f5f0',
      labelBoxBkgColor: '#22221e',
      labelBoxBorderColor: '#868685',
      labelTextColor: '#f5f5f0',
      noteBkgColor: '#163300',
      noteTextColor: '#f5f5f0',
      noteBorderColor: '#9fe870',
      activationBkgColor: '#2d2d28',
      activationBorderColor: '#9fe870',
    };
  }, [theme]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof mermaid === 'undefined') return;

    const blocks = Array.from(container.querySelectorAll('pre > code.language-mermaid'));
    if (!blocks.length) return;

    const diagrams = blocks.map((block, index) => {
      const source = block.textContent || '';
      const diagram = document.createElement('div');
      diagram.className = 'mermaid';
      diagram.dataset.diagramIndex = String(index);
      diagram.textContent = source.trim();
      block.parentElement.replaceWith(diagram);
      return diagram;
    });

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default',
      themeVariables: mermaidThemeVariables,
      flowchart: { htmlLabels: true, useMaxWidth: true },
      sequence: { useMaxWidth: true },
    });

    mermaid.run({ nodes: diagrams }).catch((err) => {
      diagrams.forEach((diagram) => {
        if (diagram.querySelector('svg')) return;
        const fallback = document.createElement('pre');
        fallback.className = 'mermaid-error';
        const code = document.createElement('code');
        code.textContent = diagram.textContent || '';
        fallback.appendChild(code);
        diagram.replaceWith(fallback);
      });
      console.error('Mermaid render failed', err);
    });
  }, [html, theme, mermaidThemeVariables]);

  const handleClick = (event) => {
    if (!onOpenMarkdown) return;
    const link = event.target.closest ? event.target.closest('a') : null;
    if (!link) return;

    const localMarkdownPath = normalizeMarkdownPath(link.getAttribute('href'), sourcePath);
    if (!localMarkdownPath) return;

    event.preventDefault();
    onOpenMarkdown(localMarkdownPath, link.textContent || localMarkdownPath);
  };

  return <div key={`${theme}:${sourcePath}`} ref={containerRef} className="markdown-body" onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Badge({ children, variant = 'default' }) {
  const className = `badge ${variant === 'accent' ? 'badge-accent' : ''} ${variant === 'tag' ? 'badge-tag' : ''}`;
  return <span className={className}>{children}</span>;
}

function Button({ children, variant = 'primary', className = '', onClick, icon: Icon, ...rest }) {
  const variantClass = variant === 'primary' ? 'btn-primary' : variant === 'secondary' ? 'btn-secondary' : 'btn-ghost';
  return (
    <button className={`btn ${variantClass} ${className}`} onClick={onClick} {...rest}>
      {Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

function Sidebar({ courseware, selectedId, completedIds, onSelect, onToggleComplete, search, onSearch, sidebarOpen, onToggleSidebar }) {
  const { intro, days, playbooks = [] } = courseware;
  const allLessons = useMemo(() => {
    const list = [intro];
    for (const day of days) {
      for (const session of day.sessions) {
        for (const lesson of session.lessons) list.push(lesson);
      }
    }
    for (const playbook of playbooks) list.push(playbook);
    return list;
  }, [intro, days, playbooks]);

  const filteredDays = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return days;
    const out = [];
    for (const day of days) {
      const sessions = [];
      for (const session of day.sessions) {
        const lessons = session.lessons.filter((l) =>
          l.title.toLowerCase().includes(q) ||
          (l.markdown && l.markdown.toLowerCase().includes(q))
        );
        if (lessons.length) sessions.push({ ...session, lessons });
      }
      if (sessions.length) out.push({ ...day, sessions });
    }
    return out;
  }, [days, search]);

  const filteredPlaybooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return playbooks;
    return playbooks.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      (p.markdown && p.markdown.toLowerCase().includes(q))
    );
  }, [playbooks, search]);

  const total = allLessons.length;
  const completed = allLessons.filter((l) => completedIds.includes(l.id)).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const selectedDayIndex = days.find((day) =>
    day.sessions.some((session) => session.lessons.some((lesson) => lesson.id === selectedId))
  )?.index;
  const playbooksActive = playbooks.some((p) => p.id === selectedId);

  const jumpToDay = (day) => {
    const firstLesson = day.sessions[0]?.lessons[0];
    if (!firstLesson) return;
    onSelect(firstLesson.id);
    window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-nav-day-index="${day.index}"]`)
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    if (window.innerWidth < 900) onToggleSidebar();
  };

  const jumpToLabs = () => {
    const firstPlaybook = filteredPlaybooks[0] || playbooks[0];
    if (firstPlaybook) onSelect(firstPlaybook.id);
    window.requestAnimationFrame(() => {
      document
        .querySelector('[data-nav-labs]')
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    if (window.innerWidth < 900) onToggleSidebar();
  };

  const renderLesson = (lesson) => {
    const active = lesson.id === selectedId;
    const complete = completedIds.includes(lesson.id);
    return (
      <button
        key={lesson.id}
        className="nav-lesson"
        data-active={active}
        data-complete={complete}
        onClick={() => { onSelect(lesson.id); if (window.innerWidth < 900) onToggleSidebar(); }}
        title={lesson.title}
      >
        <span
          className="nav-lesson-check"
          onClick={(e) => { e.stopPropagation(); onToggleComplete(lesson.id); }}
          role="checkbox"
          aria-checked={complete}
          tabIndex={0}
        >
          {complete ? <IconCheck /> : null}
        </span>
        <span className="nav-lesson-text">
          {lesson.timeStart ? <span className="nav-lesson-time">{lesson.timeStart} – {lesson.timeEnd}</span> : null}
          {lesson.title}
        </span>
      </button>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img className="brand-mark-img" src="logo.svg" alt="semantier logo" />
        <span className="brand-wordmark">semantier courseware</span>
      </div>
      <div className="sidebar-progress">
        <div className="progress-label">
          <span>学习进度</span>
          <span>{completed}/{total} ({percent}%)</span>
        </div>
        <div className="progress-bar"><span style={{ width: `${percent}%` }} /></div>
      </div>
      <div className="sidebar-search">
        <input
          type="search"
          placeholder="搜索课时、实验或概念…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="day-switcher" aria-label="按天跳转">
        {days.map((day) => (
          <button
            key={day.index}
            className="day-switcher-btn"
            data-active={day.index === selectedDayIndex}
            onClick={() => jumpToDay(day)}
          >
            Day {day.index}
          </button>
        ))}
        <button
          className="day-switcher-btn"
          data-active={playbooksActive}
          onClick={jumpToLabs}
        >
          Labs
        </button>
      </div>
      <nav className="nav-scroll">
        <div className="nav-day">
          <div className="nav-day-label"><IconSearch size={14} /> 目录</div>
          {renderLesson(intro)}
        </div>
        {filteredDays.map((day) => (
          <div className="nav-day" key={day.index} data-nav-day-index={day.index}>
            <div className="nav-day-label">Day {day.index} · {day.title}</div>
            {day.sessions.map((session) => (
              <div className="nav-session" key={session.title}>
                <div className="nav-session-title">{session.period} · {session.title}</div>
                {session.lessons.map(renderLesson)}
              </div>
            ))}
          </div>
        ))}
        {filteredPlaybooks.length ? (
          <div className="nav-day" data-nav-labs>
            <div className="nav-day-label"><IconTerminal size={14} /> IT Pro Labs</div>
            {filteredPlaybooks.map(renderLesson)}
          </div>
        ) : null}
      </nav>
    </aside>
  );
}

function LabPanel({ code }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="lab-panel" style={{ marginBottom: '1.25rem' }}>
      <div className="lab-header">
        <span className="lab-label"><IconTerminal size={14} /> 动手实验</span>
        <Button variant="ghost" className="btn-icon" onClick={handleCopy} icon={copied ? IconCheck : IconCopy} aria-label="复制命令" />
      </div>
      <div className="lab-body">
        <pre><code>{code}</code></pre>
      </div>
    </div>
  );
}

function DiscussionCard({ questions }) {
  if (!questions || !questions.length) return null;
  return (
    <div className="card">
      <h3 className="card-title"><IconMessage size={18} style={{ verticalAlign: '-3px', marginRight: '0.375rem' }} /> 讨论题</h3>
      <ol className="discussion-list">
        {questions.map((q, i) => (
          <li key={i}>
            <span className="discussion-number">{i + 1}</span>
            <span>{q}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ObjectivesCard({ objectives }) {
  if (!objectives || !objectives.length) return null;
  return (
    <div className="card">
      <h3 className="card-title">学习目标</h3>
      <ul>
        {objectives.map((o, i) => (
          <li key={i}>{o}</li>
        ))}
      </ul>
    </div>
  );
}

function PlaybookIndex({ playbooks, onSelect }) {
  if (!playbooks || !playbooks.length) return null;
  return (
    <div className="card">
      <h3 className="card-title"><IconTerminal size={18} style={{ verticalAlign: '-3px', marginRight: '0.375rem' }} /> Lab Instructions</h3>
      <p className="playbook-index-intro">所有动手实验的详细 Step 1 / Step 2 指令在这里。点击任意 lab 进入可跟做的 build guide。</p>
      <div className="playbook-index-grid">
        {playbooks.map((playbook) => (
          <button key={playbook.id} className="playbook-index-item" onClick={() => onSelect(playbook.id)}>
            <span>{playbook.labCode}</span>
            {playbook.title.replace(`${playbook.labCode}：`, '')}
          </button>
        ))}
      </div>
    </div>
  );
}

function DocumentViewer({ document, theme, onClose, onOpenMarkdown }) {
  if (!document) return null;

  return (
    <div className="card document-viewer">
      <div className="document-viewer-header">
        <div>
          <div className="document-viewer-label">Rendered Markdown</div>
          <h2>{document.title}</h2>
          <p>{document.path}</p>
        </div>
        <Button variant="ghost" className="btn-icon" onClick={onClose} icon={IconClose} aria-label="关闭文档" />
      </div>
      {document.loading ? (
        <div className="document-viewer-state">加载文档中…</div>
      ) : document.error ? (
        <div className="document-viewer-state document-viewer-error">{document.error}</div>
      ) : (
        <MarkdownRenderer
          markdown={document.markdown}
          theme={theme}
          sourcePath={document.path}
          onOpenMarkdown={onOpenMarkdown}
        />
      )}
    </div>
  );
}

function LessonContent({ lesson, onToggleComplete, isComplete, theme, onSelect, playbooks }) {
  const [document, setDocument] = useState(null);
  const documentRef = useRef(null);
  const loadedInitialDocumentRef = useRef(null);

  const openMarkdownDocument = async (path, title, options = {}) => {
    setDocument({
      path,
      title: title || path,
      markdown: '',
      loading: true,
      error: null,
    });
    window.requestAnimationFrame(() => {
      documentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if (options.updateUrl !== false) {
      window.history.pushState(null, '', `${getTrainingBasePath()}${path}`);
    }

    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`无法加载 ${path}: ${res.status}`);
      const markdown = await res.text();
      setDocument({
        path,
        title: title || path,
        markdown,
        loading: false,
        error: null,
      });
    } catch (error) {
      setDocument({
        path,
        title: title || path,
        markdown: '',
        loading: false,
        error: error.message || '文档加载失败',
      });
    }
  };

  useEffect(() => {
    if (!lesson?.initialDocumentPath) return;
    if (loadedInitialDocumentRef.current === lesson.initialDocumentPath) return;
    loadedInitialDocumentRef.current = lesson.initialDocumentPath;
    openMarkdownDocument(lesson.initialDocumentPath, lesson.initialDocumentPath, { updateUrl: false });
  }, [lesson?.initialDocumentPath]);

  if (!lesson) {
    return (
      <div className="empty-state">
        <IconLogo size={48} />
        <h2>选择一节课开始</h2>
        <p>在左侧目录中选择课程，查看课件内容、实验与讨论题。</p>
      </div>
    );
  }

  return (
    <div className="content-inner">
      <header className="lesson-header">
        <div className="lesson-meta">
          {lesson.dayTitle ? <Badge variant="accent">{lesson.dayTitle}</Badge> : null}
          {lesson.sessionTitle ? <Badge variant="tag">{lesson.sessionTitle}</Badge> : null}
          {lesson.tags.map((t) => <Badge key={t} variant="tag">{t}</Badge>)}
        </div>
        <h1 className="lesson-title">{lesson.title}</h1>
        {lesson.timeStart ? <div className="lesson-time">{lesson.timeStart} – {lesson.timeEnd}</div> : null}
      </header>

      <ObjectivesCard objectives={lesson.objectives} />

      {lesson.id === 'intro' ? <PlaybookIndex playbooks={playbooks} onSelect={onSelect} /> : null}

      <LabPanel code={lesson.lab} />

      {lesson.relatedPlaybookId ? (
        <div className="playbook-callout">
          <div>
            <h3>完整 IT Pro Build Lab</h3>
            <p>打开对应 playbook，按详细步骤完成代码定位、构建、验证、故障排查和 Mermaid 架构图学习。</p>
          </div>
          <Button variant="secondary" onClick={() => onSelect(lesson.relatedPlaybookId)} icon={IconTerminal}>
            打开 Lab Playbook
          </Button>
        </div>
      ) : null}

      <div ref={documentRef}>
        <DocumentViewer
          document={document}
          theme={theme}
          onClose={() => {
            setDocument(null);
            window.history.pushState(null, '', getTrainingBasePath());
          }}
          onOpenMarkdown={openMarkdownDocument}
        />
      </div>

      <div className="card">
        <MarkdownRenderer
          markdown={lesson.markdown}
          theme={theme}
          onOpenMarkdown={openMarkdownDocument}
        />
      </div>

      <DiscussionCard questions={lesson.discussion} />

      <div className="complete-bar">
        <p>{isComplete ? '本节课已标记完成。' : '学完后，标记这节课为已完成以追踪进度。'}</p>
        <Button variant={isComplete ? 'secondary' : 'primary'} onClick={() => onToggleComplete(lesson.id)}>
          {isComplete ? '标记为未完成' : '标记为已完成'}
        </Button>
      </div>
    </div>
  );
}

Object.assign(window, {
  Sidebar,
  LessonContent,
  MarkdownRenderer,
  Badge,
  Button,
  LabPanel,
  DiscussionCard,
  ObjectivesCard,
  PlaybookIndex,
  DocumentViewer,
});
