"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  children: React.ReactNode;
}

export default function AnimateChartOnScroll({ children }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting) {
        setVisible(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setVisible(true));
        });
      }
    },
    [],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  return (
    <>
      <div ref={sentinelRef} />
      {visible && <div>{children}</div>}
    </>
  );
}
