import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getSourceLabel, YearDataSource } from '@/lib/periodResolution';

const sourceClasses: Record<YearDataSource, string> = {
  actual: 'border-positive/30 bg-positive/10 text-positive',
  mixed: 'border-warning/30 bg-warning/10 text-warning',
  projected: 'border-primary/30 bg-primary/10 text-primary',
};

interface DataSourceBadgeProps {
  source: YearDataSource;
  className?: string;
}

export function DataSourceBadge({ source, className }: DataSourceBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', sourceClasses[source], className)}
    >
      {getSourceLabel(source)}
    </Badge>
  );
}
