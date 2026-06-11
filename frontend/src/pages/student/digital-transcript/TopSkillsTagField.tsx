import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TOP_SKILLS_CAP_MESSAGE, TOP_SKILLS_MAX } from './transcriptReflectionConfig';

interface TopSkillsTagFieldProps {
    id: string;
    label: string;
    subtitle: string;
    value: string[];
    onChange: (tags: string[]) => void;
}

function normalizeToken(raw: string): string {
    return raw.replace(/,/g, ' ').trim().replace(/\s+/g, ' ');
}

export function TopSkillsTagField({ id, label, subtitle, value, onChange }: TopSkillsTagFieldProps) {
    const [input, setInput] = useState('');
    const atCap = value.length >= TOP_SKILLS_MAX;

    const commitToken = useCallback(
        (raw: string) => {
            const t = normalizeToken(raw);
            if (!t || atCap) return;
            if (value.includes(t)) {
                setInput('');
                return;
            }
            onChange([...value, t].slice(0, TOP_SKILLS_MAX));
            setInput('');
        },
        [atCap, onChange, value]
    );

    function removeAt(index: number) {
        onChange(value.filter((_, i) => i !== index));
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commitToken(input);
            return;
        }
        if (e.key === 'Backspace' && input === '' && value.length > 0) {
            e.preventDefault();
            removeAt(value.length - 1);
        }
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
        const text = e.clipboardData.getData('text/plain');
        if (text.includes(',') && !atCap) {
            e.preventDefault();
            const parts = text
                .split(',')
                .map((p) => normalizeToken(p))
                .filter(Boolean);
            let next = [...value];
            for (const p of parts) {
                if (next.length >= TOP_SKILLS_MAX) break;
                if (!next.includes(p)) next = [...next, p];
            }
            onChange(next.slice(0, TOP_SKILLS_MAX));
            setInput('');
        }
    }

    return (
        <div className="space-y-2">
            <div>
                <Label htmlFor={id}>{label}</Label>
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-gray-200/90 bg-white px-2 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                {value.map((tag, i) => (
                    <Badge
                        key={`${tag}-${i}`}
                        variant="secondary"
                        className="max-w-full gap-1 pr-1 font-normal"
                    >
                        <span className="truncate">{tag}</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                            onClick={() => removeAt(i)}
                            aria-label={`Remove ${tag}`}
                        >
                            <X className="size-3.5" aria-hidden />
                        </Button>
                    </Badge>
                ))}
                <Input
                    id={id}
                    data-slot="transcript-top-skills"
                    disabled={atCap}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onBlur={() => commitToken(input)}
                    placeholder={atCap ? '' : 'Type a skill, then press Enter'}
                    className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 disabled:opacity-60"
                />
            </div>
            {atCap ? <p className="text-xs text-muted-foreground">{TOP_SKILLS_CAP_MESSAGE}</p> : null}
        </div>
    );
}
