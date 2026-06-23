/* global marked */

const TAG_NAMES = ['Semantier wrapper', 'upstream hermes-agent'];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractSection(lines, startMarker) {
  const start = lines.findIndex((l) => l.trim() === startMarker);
  if (start === -1) return [];
  const items = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('**') && line.endsWith('**')) break;
    if (/^\d+\.\s+/.test(line) || /^[-*]\s+/.test(line)) {
      items.push(line.replace(/^\d+\.\s+/, '').replace(/^[-*]\s+/, ''));
    }
  }
  return items;
}

function extractTags(md) {
  const tags = [];
  for (const name of TAG_NAMES) {
    if (md.includes(name)) tags.push(name);
  }
  return tags;
}

function extractFirstCodeBlock(md) {
  const labStart = md.search(/\*\*动手实验\s+L\d+[：:]/);
  const source = labStart >= 0 ? md.slice(labStart) : md;
  const re = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const lang = (match[1] || '').toLowerCase();
    if (lang === 'mermaid') continue;
    return match[2].trim();
  }
  return null;
}

function extractLabRef(md) {
  const m = md.match(/\*\*动手实验\s+(L\d+)[：:]/);
  return m ? m[1].toLowerCase() : null;
}

function extractObjectives(md) {
  return extractSection(md.split(/\r?\n/), '**学习目标**');
}

function extractDiscussion(md) {
  return extractSection(md.split(/\r?\n/), '**讨论题**');
}

function splitIntroAndPlaybooks(introMd) {
  const marker = '\n## IT Pro Hands-on Lab Playbooks\n';
  const markerAt = introMd.indexOf(marker);
  if (markerAt === -1) return { introMd, playbookMd: '' };
  return {
    introMd: introMd.slice(0, markerAt).trim(),
    playbookMd: introMd.slice(markerAt).trim(),
  };
}

function parsePlaybooks(playbookMd) {
  if (!playbookMd) return [];
  const lines = playbookMd.split(/\r?\n/);
  const playbooks = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const markdown = current.lines.join('\n').trim();
    current.markdown = markdown;
    current.objectives = [];
    current.discussion = [];
    current.tags = ['IT Pro Lab'];
    current.lab = null;
    playbooks.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const match = rawLine.match(/^###\s+(L\d+)[：:](.+)$/);
    if (match) {
      flush();
      const labCode = match[1];
      const title = `${labCode}：${match[2].trim()}`;
      current = {
        id: `lab-${labCode.toLowerCase()}`,
        title,
        labCode,
        kind: 'playbook',
        timeStart: '',
        timeEnd: '',
        dayTitle: 'IT Pro Hands-on Lab Playbooks',
        sessionTitle: 'Build Lab',
        lines: [rawLine],
      };
      continue;
    }
    if (current) current.lines.push(rawLine);
  }
  flush();
  return playbooks;
}

function parseCourseware(text) {
  const lines = text.split(/\r?\n/);
  const days = [];
  let introLines = [];
  let currentDay = null;
  let currentSession = null;
  let currentLesson = null;
  let beforeFirstDay = true;

  const flushLesson = () => {
    if (currentLesson) {
      const md = currentLesson.lines.join('\n').trim();
      currentLesson.markdown = md;
      currentLesson.objectives = extractObjectives(md);
      currentLesson.discussion = extractDiscussion(md);
      currentLesson.tags = extractTags(md);
      currentLesson.lab = extractFirstCodeBlock(md);
      const labRef = extractLabRef(md);
      currentLesson.relatedPlaybookId = labRef ? `lab-${labRef}` : null;
      currentSession.lessons.push(currentLesson);
      currentLesson = null;
    }
  };

  const flushSession = () => {
    flushLesson();
    if (currentSession && currentSession.lessons.length) {
      currentDay.sessions.push(currentSession);
    }
    currentSession = null;
  };

  const flushDay = () => {
    flushSession();
    if (currentDay && currentDay.sessions.length) {
      days.push(currentDay);
    }
    currentDay = null;
  };

  for (const rawLine of lines) {
    const line = rawLine;
    const dayMatch = line.match(/^##\s+Day\s+(\d+)[：:](.+)$/);
    const sessionMatch = line.match(/^###\s+(上午|下午)[：:](.+)$/);
    const lessonMatch = line.match(/^####\s+(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})[｜|](.+)$/);

    if (dayMatch) {
      flushDay();
      beforeFirstDay = false;
      currentDay = {
        index: parseInt(dayMatch[1], 10),
        title: dayMatch[2].trim(),
        sessions: [],
      };
      continue;
    }

    if (sessionMatch) {
      flushSession();
      currentSession = {
        period: sessionMatch[1].trim(),
        title: sessionMatch[2].trim(),
        lessons: [],
      };
      continue;
    }

    if (lessonMatch) {
      flushLesson();
      const title = lessonMatch[3].trim();
      currentLesson = {
        id: slugify(`day-${currentDay ? currentDay.index : 0}-${title}`),
        title,
        timeStart: lessonMatch[1],
        timeEnd: lessonMatch[2],
        dayTitle: currentDay ? currentDay.title : '',
        sessionTitle: currentSession ? currentSession.title : '',
        lines: [rawLine],
      };
      continue;
    }

    if (beforeFirstDay) {
      introLines.push(rawLine);
      continue;
    }

    if (currentLesson) {
      currentLesson.lines.push(rawLine);
    } else if (currentSession) {
      // session-level content ignored for now
    } else if (currentDay) {
      // day-level content ignored
    }
  }

  flushDay();

  // Build intro lesson from preamble
  const { introMd, playbookMd } = splitIntroAndPlaybooks(introLines.join('\n').trim());
  const playbooks = parsePlaybooks(playbookMd);
  const introLesson = {
    id: 'intro',
    title: '工作坊介绍',
    kind: 'intro',
    timeStart: '',
    timeEnd: '',
    dayTitle: '目录',
    sessionTitle: '前置说明',
    markdown: introMd,
    objectives: [],
    discussion: [],
    tags: [],
    lab: null,
  };

  return { days, intro: introLesson, playbooks };
}

async function loadCourseware() {
  const res = await fetch('AI_Agents_Workshop_Courseware.md');
  if (!res.ok) throw new Error(`Failed to load AI_Agents_Workshop_Courseware.md: ${res.status}`);
  const text = await res.text();
  return parseCourseware(text);
}

Object.assign(window, {
  loadCourseware,
  parseCourseware,
});
