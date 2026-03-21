import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/socket-events';

interface ChatPanelProps {
  messages?: ChatMessage[];
  onSendMessage?: (content: string) => void;
}

export function ChatPanel({ messages = [], onSendMessage }: ChatPanelProps) {
  const { t } = useTranslation(['game', 'common']);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = 'local'; // In real app, get from user store

  // Auto-scroll to bottom on new messages
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

  // Demo messages for offline mode
  const demoMessages: ChatMessage[] = messages.length > 0 ? messages : [
    {
      id: '1',
      playerId: 'system',
      nickname: 'System',
      content: t('game.chat.welcome'),
      type: 'system',
      timestamp: new Date().toISOString(),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-medium">{t('game.chat.title')}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? t('game.chat.hide') : t('game.chat.show')}
        </Button>
      </div>

      {/* Messages */}
      {isExpanded && (
        <>
          <ScrollArea className="flex-1 p-3">
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
                  <span className={cn(
                    'inline-block px-2 py-1 rounded-lg',
                    msg.type === 'system'
                      ? 'bg-muted/50'
                      : msg.playerId === currentUserId
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                  )}>
                    {msg.content}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-2 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('game.chat.placeholder')}
                className="h-8"
                disabled={!onSendMessage}
              />
              <Button
                size="icon"
                className="h-8 w-8"
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
