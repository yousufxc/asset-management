"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  children: React.ReactNode;
}

export default function AnimateChartOnScroll({ children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState(0);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting) {
        setKey((k) => k + 1);
      }
    },
    [],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  return (
    <div ref={ref} key={key}>
      {children}
    </div>
  );
}
