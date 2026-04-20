/*
 * cs16 design kit — single entry point.
 * Import this to pick up the stylesheet and all components at once.
 */

import './tokens.css';

export { Icon, iconNames } from './icons.jsx';

export {
  Badge,
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  Kbd,
  KeyValueList,
  Panel,
  Select,
  Separator,
  Skeleton,
  StatusDot,
  Textarea,
  Toolbar,
} from './primitives.jsx';

export {
  AppHeader,
  AppShell,
  CommandPalette,
  StatusRail,
  closeCommandPalette,
  openCommandPalette,
} from './shell.jsx';

export {
  CodeLine,
  CommitGraph,
  FileTree,
  RepoCard,
  Terminal,
} from './developer.jsx';

export {
  AnimatedNumber,
  DataTable,
  Gauge,
  InfiniteSlider,
  PopoverCommandSelect,
  Sparkline,
  StatsGrid,
  Tabs,
} from './data.jsx';

export {
  LiveMarketplaceActivity,
  MarketingHero,
  PersonaCard,
  PersonaGrid,
  Section,
} from './landing.jsx';
