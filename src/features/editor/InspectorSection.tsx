// Collapsible inspector section. Design Ref: §5.5 Scene Inspector — the panel
// carries six groups, so only the two that are always relevant open by default.
// Open state lives on <details> rather than the store: it is view-only and must
// not enter the autosaved project.
import type {ReactNode} from 'react';

export interface InspectorSectionProps {
  /** Stable ASCII key; drives `data-testid="section-{id}"` on the summary. */
  id: string;
  title: string;
  /** Right-aligned summary shown while the section is collapsed. */
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export const InspectorSection = ({
  id,
  title,
  badge,
  defaultOpen = false,
  children,
}: InspectorSectionProps) => (
  <details className="section" open={defaultOpen}>
    <summary className="section__summary" data-testid={`section-${id}`}>
      <span aria-hidden="true" className="section__caret">
        ▶
      </span>
      {title}
      {badge ? <span className="section__badge">{badge}</span> : null}
    </summary>
    <div className="section__body">{children}</div>
  </details>
);
