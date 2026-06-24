/* global React, loadCourseware */

const { useState, useEffect, useMemo } = React;

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initial;
    } catch (e) {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // ignore
    }
  }, [key, value]);
  return [value, setValue];
}

function getInitialDocumentPath() {
  const basePath = new URL(document.baseURI || `${window.location.origin}/training/`).pathname;
  if (!window.location.pathname.startsWith(basePath)) return null;
  const relativePath = decodeURIComponent(window.location.pathname.slice(basePath.length));
  if (!relativePath.endsWith('.md') || relativePath.includes('..')) return null;
  return relativePath;
}

function App() {
  const [courseware, setCourseware] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState('intro');
  const [completedIds, setCompletedIds] = useLocalStorage('courseware-completed', []);
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useLocalStorage('courseware-theme-dark', false);
  const initialDocumentPath = useMemo(() => getInitialDocumentPath(), []);

  useEffect(() => {
    loadCourseware()
      .then((data) => {
        setCourseware(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || '加载失败');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!dark);
  }, [dark]);

  const allLessons = useMemo(() => {
    if (!courseware) return [];
    const list = [courseware.intro];
    for (const day of courseware.days) {
      for (const session of day.sessions) {
        for (const lesson of session.lessons) list.push(lesson);
      }
    }
    for (const playbook of courseware.playbooks || []) list.push(playbook);
    return list;
  }, [courseware]);

  const selectedLesson = useMemo(() => allLessons.find((l) => l.id === selectedId) || null, [allLessons, selectedId]);
  const lessonForDisplay = useMemo(() => {
    if (!selectedLesson) return null;
    return initialDocumentPath ? { ...selectedLesson, initialDocumentPath } : selectedLesson;
  }, [selectedLesson, initialDocumentPath]);

  const handleToggleComplete = (id) => {
    setCompletedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  if (loading) {
    return (
      <div className="empty-state">
        <IconLogo size={48} />
        <h2>加载课件中…</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <h2>加载失败</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="app-shell" data-sidebar-open={sidebarOpen}>
      <Sidebar
        courseware={courseware}
        selectedId={selectedId}
        completedIds={completedIds}
        onSelect={setSelectedId}
        onToggleComplete={handleToggleComplete}
        search={search}
        onSearch={setSearch}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <Button variant="ghost" className="menu-btn btn-icon" onClick={() => setSidebarOpen((v) => !v)} icon={IconMenu} aria-label="切换目录" />
            <span className="topbar-title">Semantier Runtime 企业级 AI Agent 工作坊</span>
          </div>
          <div className="topbar-actions">
            <Button variant="ghost" className="btn-icon" onClick={() => setDark((v) => !v)} icon={dark ? IconSun : IconMoon} aria-label="切换主题" />
          </div>
        </header>
        <div className="content-scroll">
          <LessonContent
            lesson={lessonForDisplay}
            isComplete={completedIds.includes(selectedId)}
            onToggleComplete={handleToggleComplete}
            onSelect={setSelectedId}
            playbooks={courseware.playbooks || []}
            theme={dark ? 'dark' : 'light'}
          />
        </div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
