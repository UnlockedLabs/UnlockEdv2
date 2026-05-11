import { useNavigate } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { cn } from '@/lib/utils';

export default function Breadcrumbs({
  items,
  className
}: {
  items: BreadcrumbItemType[];
  className?: string;
}) {
  if (items.length === 0) return null;

  const navigate = useNavigate();

  return (
    <nav className={cn('flex items-center gap-2 text-sm mb-6', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronRightIcon className="size-4 text-gray-400" />
            )}
            {item.href && !isLast ? (
              <button
                onClick={() => navigate(item.href!)}
                className="text-sm text-[#556830] hover:text-[#203622] hover:underline transition-colors"
              >
                {item.label}
              </button>
            ) : (
              <span
                className={`text-sm ${isLast ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
