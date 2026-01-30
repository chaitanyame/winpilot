import { MessageSquare, ScrollText } from 'lucide-react';

interface TabNavigationProps {
  activeTab: 'chat' | 'canvas';
  onTabChange: (tab: 'chat' | 'canvas') => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex items-center gap-1 px-4 pt-4 border-b border-stone-800 dark:border-stone-800">
      <button
        onClick={() => onTabChange('chat')}
        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg
          font-medium text-sm transition-all
          ${activeTab === 'chat'
            ? 'bg-purple-500/10 text-purple-300 border-b-2 border-purple-500'
            : 'text-stone-400 hover:text-stone-300 hover:bg-stone-800/50 dark:hover:bg-stone-800/50'
          }`}
      >
        <MessageSquare className="w-4 h-4" />
        Chat
      </button>
      <button
        onClick={() => onTabChange('canvas')}
        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg
          font-medium text-sm transition-all
          ${activeTab === 'canvas'
            ? 'bg-purple-500/10 text-purple-300 border-b-2 border-purple-500'
            : 'text-stone-400 hover:text-stone-300 hover:bg-stone-800/50 dark:hover:bg-stone-800/50'
          }`}
      >
        <ScrollText className="w-4 h-4" />
        Logs & Actions
      </button>
    </div>
  );
}
