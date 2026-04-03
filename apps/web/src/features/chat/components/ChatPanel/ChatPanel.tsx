import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/shared/types/socket';
import { useChatStore } from '@/stores/chatStore';
import { useUserStore } from '@/stores/userStore';

const SYSTEM_MESSAGE_TIMESTAMP = "1970-01-01T00:00:00.000Z";

interface ChatPanelProps {
  messages?: ChatMessage[];
  onSendMessage?: (content: string) => void;
}

export function ChatPanel({ messages: messagesProp, onSendMessage }: ChatPanelProps) {
  const { t } = useTranslation(['game', 'common']);
  const { messages: storeMessages } = useChatStore();
  const user = useUserStore((state) => state.user);
  const hasUserHydrated = useUserStore((state) => state.hasHydrated);
  const messages = messagesProp ?? storeMessages;
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = hasUserHydrated ? user?.id ?? null : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && onSendMessage) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const demoMessages: ChatMessage[] = messages.length > 0 ? messages : [
    {
      id: '1',
      playerId: 'system',
      nickname: 'System',
      content: t('game.chat.welcome'),
      type: 'system',
      timestamp: SYSTEM_MESSAGE_TIMESTAMP,
    },
  ];

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{t('game.chat.title')}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-full text-xs"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? t('game.chat.hide') : t('game.chat.show')}
        </Button>
      </div>

      {isExpanded && (
        <>
          <ScrollArea className="flex-1 p-3 pt-0">
            <div className="space-y-3">
              {demoMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'text-sm',
                    msg.type === 'system' && 'text-muted-foreground italic text-center text-xs',
                    msg.type === 'text' && msg.playerId === currentUserId && 'text-right',
                  )}
                >
                  {msg.type === 'text' && msg.playerId !== currentUserId && (
                    <span className="font-semibold text-xs mr-1">{msg.nickname}:</span>
                  )}
                  <span
                    className={cn(
                      'inline-block rounded-2xl px-3 py-1.5',
                      msg.type === 'system'
                        ? 'bg-muted/60'
                        : msg.playerId === currentUserId
                          ? 'bg-gradient-kawaii-cta text-primary-foreground shadow-sm'
                          : 'bg-card/90 shadow-sm'
                    )}
                  >
                    {msg.content}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-border/20 p-2">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('game.chat.placeholder')}
                className="h-10 rounded-full border-border/30 bg-muted/50 focus-visible:ring-primary/40"
                disabled={!onSendMessage}
              />
              <Button
                size="icon"
                variant="kawaii"
                className="h-10 w-10 shrink-0 rounded-full"
                onClick={handleSend}
                disabled={!input.trim() || !onSendMessage}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
