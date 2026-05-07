'use client';

import { useEffect, useRef } from 'react';

export default function SakanaWidget() {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.innerWidth < 768) return;
    let sakana: any;
    // @ts-ignore
    import('sakana').then((mod) => {
      const Sakana = mod.default ?? mod;
      if (boxRef.current) {
        sakana = Sakana.init({
          el: boxRef.current,
          character: 'chisato',
          scale: 0.5,
          canSwitchCharacter: true,
        });
      }
    });
    return () => {
      sakana?.pause();
    };
  }, []);

  return (
    <div
      ref={boxRef}
      style={{
        position: 'fixed',
        left: 0,
        bottom: 0,
        transformOrigin: '0% 100%',
        zIndex: 9999,
      }}
    />
  );
}
