/**
 * Swizzled Mermaid component.
 *
 * Why this exists:
 * The stock @docusaurus/theme-mermaid renders every diagram in its own
 * useEffect. On a page with multiple diagrams, all effects fire in the same
 * tick and call the Mermaid singleton's `render()` concurrently. Mermaid uses
 * a single shared, mutable DOM sandbox internally and is NOT safe to call
 * concurrently — competing renders clobber each other's temp node, so some
 * render promises never resolve. The result: every other diagram silently
 * stays empty (no SVG, no error).
 *
 * Fix: funnel all renders through a module-level promise queue so only one
 * mermaid.render() runs at a time.
 */
import React, {useEffect, useRef, useState} from 'react';
import ErrorBoundary from '@docusaurus/ErrorBoundary';
import {ErrorBoundaryErrorMessageFallback} from '@docusaurus/theme-common';
import {
  MermaidContainerClassName,
  useMermaidConfig,
} from '@docusaurus/theme-mermaid/client';

// Serializes all mermaid.render() calls across the page.
let renderQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = renderQueue.then(task, task);
  // Keep the chain alive even if a task rejects.
  renderQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run as Promise<T>;
}

function useSerializedMermaid(text: string, config: Record<string, unknown>) {
  const [result, setResult] = useState<any>(null);
  const [id] = useState(
    () => `mermaid-svg-${Math.round(Math.random() * 1e7)}`,
  );

  useEffect(() => {
    let cancelled = false;
    enqueue(async () => {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize(config as any);
      try {
        const res = await mermaid.render(id, text);
        if (!cancelled) {
          setResult(res);
        }
      } catch (e) {
        // Mermaid leaves a stray error node in the DOM on failure.
        document.querySelector(`#d${id}`)?.remove();
        if (!cancelled) {
          // Surface to the nearest React error boundary.
          setResult(() => {
            throw e;
          });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, text, config]);

  return result;
}

function MermaidRenderResult({renderResult}: {renderResult: any}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    renderResult.bindFunctions?.(ref.current);
  }, [renderResult]);
  return (
    <div
      ref={ref}
      className={MermaidContainerClassName}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{__html: renderResult.svg}}
    />
  );
}

function MermaidRenderer({value}: {value: string}) {
  const config = useMermaidConfig();
  const renderResult = useSerializedMermaid(value, config as any);
  if (renderResult === null) {
    return null;
  }
  return <MermaidRenderResult renderResult={renderResult} />;
}

export default function Mermaid(props: {value: string}): JSX.Element {
  return (
    <ErrorBoundary
      fallback={(params) => <ErrorBoundaryErrorMessageFallback {...params} />}>
      <MermaidRenderer {...props} />
    </ErrorBoundary>
  );
}
