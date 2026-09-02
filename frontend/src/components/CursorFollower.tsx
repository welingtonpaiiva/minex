import React, { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

export const CursorFollower: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Mola suave e flutuante estilo "vulto" com atraso sutil
  const glowX = useSpring(-100, { stiffness: 70, damping: 22 });
  const glowY = useSpring(-100, { stiffness: 70, damping: 22 });

  const coreX = useSpring(-100, { stiffness: 200, damping: 30 });
  const coreY = useSpring(-100, { stiffness: 200, damping: 30 });

  useEffect(() => {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      glowX.set(e.clientX);
      glowY.set(e.clientY);
      coreX.set(e.clientX);
      coreY.set(e.clientY);
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [glowX, glowY, coreX, coreY, isVisible]);

  if (!isVisible) return null;

  return (
    <>
      {/* VULTO SUAVE / SOMBRA FLUTUANTE (QUASE IMPERCEPTÍVEL) */}
      <motion.div
        className="fixed pointer-events-none z-[9998] -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full opacity-60"
        style={{
          x: glowX,
          y: glowY,
          background: 'radial-gradient(circle, rgba(147, 112, 219, 0.06) 0%, rgba(51, 18, 116, 0.03) 45%, transparent 70%)',
        }}
      />

      {/* ANEL VULTO MUITO DELICADO */}
      <motion.div
        className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-purple-400/10 bg-purple-400/[0.02]"
        style={{
          x: coreX,
          y: coreY,
        }}
      />
    </>
  );
};
