function createIcon(path, opts = {}) {
  const { size = 20, viewBox = '0 0 24 24', fill = 'none', stroke = 'currentColor', strokeWidth = 2 } = opts;
  return (
    <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  );
}

const IconCheck = (props) => createIcon(<polyline points="20 6 9 17 4 12" />, { size: props?.size || 16 });
const IconCopy = (props) => createIcon(<><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>, { size: props?.size || 16 });
const IconMenu = (props) => createIcon(<><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>, { size: props?.size || 20 });
const IconSun = (props) => createIcon(<><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></>, { size: props?.size || 18 });
const IconMoon = (props) => createIcon(<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />, { size: props?.size || 18 });
const IconSearch = (props) => createIcon(<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>, { size: props?.size || 16 });
const IconTerminal = (props) => createIcon(<><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></>, { size: props?.size || 16 });
const IconMessage = (props) => createIcon(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>, { size: props?.size || 16 });
const IconCode = (props) => createIcon(<><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>, { size: props?.size || 16 });
const IconLogo = (props) => createIcon(<><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>, { size: props?.size || 20, strokeWidth: 2.2 });

Object.assign(window, {
  IconCheck,
  IconCopy,
  IconMenu,
  IconSun,
  IconMoon,
  IconSearch,
  IconTerminal,
  IconMessage,
  IconCode,
  IconLogo,
});
