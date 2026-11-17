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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);

  useEffect(() => {
    renderResult.bindFunctions?.(ref.current);
  }, [renderResult]);

  const getNaturalWidth = (): number => {
    const el = bodyRef.current?.querySelector('svg');
    if (!el) return 800;
    if (el.viewBox?.baseVal?.width) return el.viewBox.baseVal.width;
    try { return el.getBBox().width || 800; } catch { return 800; }
  };

  const open = () => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    dlg.showModal();
    document.documentElement.style.overflow = 'hidden';
    // Strip max-width from svg inside dialog and compute fit zoom
    requestAnimationFrame(() => {
      const svg = bodyRef.current?.querySelector('svg');
      if (svg) svg.style.maxWidth = 'none';
      const body = bodyRef.current;
      if (body) {
        const natW = getNaturalWidth();
        const fit = body.clientWidth / natW;
        setFitZoom(fit);
        setZoom(fit);
      }
    });
  };

  const close = () => {
    dialogRef.current?.close();
  };

  const onDialogClose = () => {
    document.documentElement.style.overflow = '';
    btnRef.current?.focus();
  };

  useEffect(() => {
    return () => { document.documentElement.style.overflow = ''; };
  }, []);

  // Apply zoom to svg width
  useEffect(() => {
    const svg = bodyRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (svg) {
      const natW = getNaturalWidth();
      svg.style.width = `${natW * zoom}px`;
      svg.style.height = 'auto';
    }
  }, [zoom]);

  const clamp = (z: number) => Math.min(6, Math.max(0.25, z));

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.25 : 0.8)));
    }
  };

  return (
    <div style={{position: 'relative'}}>
      <div
        ref={ref}
        className={MermaidContainerClassName}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{__html: renderResult.svg}}
      />
      <button
        ref={btnRef}
        type="button"
        aria-label="Expand diagram"
        title="Expand"
        onClick={open}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--vt-surface)', border: '1px solid var(--vt-border)',
          borderRadius: 6, cursor: 'pointer', fontSize: 16, color: 'var(--vt-text-secondary)',
          opacity: 0, transition: 'opacity 150ms',
        }}
        onFocus={(e) => { e.currentTarget.style.opacity = '1'; }}
        onBlur={(e) => { e.currentTarget.style.opacity = '0'; }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.opacity = '0'; }}
      >
        ⤢
      </button>

      <dialog
        ref={dialogRef}
        className="vt-mermaid-dialog"
        onClose={onDialogClose}
        onClick={(e) => { if (e.target === dialogRef.current) close(); }}
        style={{
          position: 'fixed', inset: '2vh 2vw',
          width: '96vw', height: '96vh', maxWidth: 'none', maxHeight: 'none',
          background: 'var(--vt-bg)', border: '1px solid var(--vt-border)',
          borderRadius: 12, padding: 0, overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderBottom: '1px solid var(--vt-border-subtle)',
          background: 'var(--vt-surface)', flexShrink: 0,
        }}>
          <button type="button" onClick={() => setZoom((z) => clamp(z * 0.8))}
            style={toolbarBtn}>−</button>
          <span style={{fontSize: 13, color: 'var(--vt-text-secondary)', minWidth: 48, textAlign: 'center'}}>
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={() => setZoom((z) => clamp(z * 1.25))}
            style={toolbarBtn}>+</button>
          <button type="button" onClick={() => setZoom(fitZoom)}
            style={toolbarBtn}>Fit</button>
          <div style={{flex: 1}} />
          <button type="button" onClick={close}
            style={toolbarBtn}>Close</button>
        </div>
        <div
          ref={bodyRef}
          onWheel={handleWheel as unknown as React.WheelEventHandler<HTMLDivElement>}
          style={{flex: 1, overflow: 'auto', padding: 16}}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{__html: renderResult.svg}}
        />
      </dialog>
    </div>
  );
}

const toolbarBtn: React.CSSProperties = {
  background: 'var(--vt-surface-hover)', border: '1px solid var(--vt-border-subtle)',
  borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, color: 'var(--vt-text)',
};

function MermaidRenderer({value}: {value: string}) {
  const config = useMermaidConfig();
  const renderResult = useSerializedMermaid(value, config as any);
  if (renderResult === null) {
    return null;
  }
  return <MermaidRenderResult renderResult={renderResult} />;
}

export default function Mermaid(props: {value: string}): React.ReactElement {
  return (
    <ErrorBoundary
      fallback={(params) => <ErrorBoundaryErrorMessageFallback {...params} />}>
      <MermaidRenderer {...props} />
    </ErrorBoundary>
  );
}
