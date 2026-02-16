type ListViewCardProps = {
  title: string;
  headerRight?: React.ReactNode;
  filters?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
};

type ListGridProps = {
  children: React.ReactNode;
  className?: string;
};

function withClass(base: string, value?: string) {
  if (!value) return base;
  return `${base} ${value}`;
}

export function ListGrid({ children, className }: ListGridProps) {
  return <div className={withClass("table", className)}>{children}</div>;
}

export default function ListViewCard({
  title,
  headerRight,
  filters,
  footer,
  children,
  className,
  testId,
}: ListViewCardProps) {
  return (
    <section className={withClass("table-card", className)} data-testid={testId}>
      <div className="card-header">
        <h2>{title}</h2>
        {headerRight || null}
      </div>
      {filters ? <div className="filter-bar">{filters}</div> : null}
      {children}
      {footer || null}
    </section>
  );
}
