import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function SearchInput({
    id,
    value,
    onChange,
    placeholder = 'Search...',
    className
}: SearchInputProps) {
    return (
        <div id={id} className={cn('relative', className)}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pl-9 pr-8"
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                    <X className="size-4" />
                </button>
            )}
        </div>
    );
}
