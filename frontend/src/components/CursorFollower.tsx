import React, { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

export const CursorFollower: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Smooth springs for buttery smooth cursor physics
  const cursorX = useSpring(-100, { stiffness: 450, damping: 35 });
  const cursorY = useSpring(-100, { stiffness: 450, damping: 35 });

  const glowX = useSpring(-100, { stiffness: 150, damping: 25 });
  const glowY = useSpring(-100, { stiffness: 150, damping: 25 });

  useEffect(() => {
    // Disable on touch devices
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      glowX.set(e.clientX);
      glowY.set(e.clientY);
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
  }, [cursorX, cursorY, glowX, glowY, isVisible]);

  if (!isVisible) return null;

  return (
    <>
      {/* Glow / Spotlight radial suave seguindo o cursor no fundo */}
      <motion.div
        className="fixed pointer-events-none z-[9998] -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full mix-blend-screen"
        style={{
          x: glowX,
          y: glowY,
          background: 'radial-gradient(circle, rgba(167, 139, 250, 0.18) 0%, rgba(51, 18, 116, 0.08) 50%, transparent 70%)',
        }}
      />

      {/* Anel Externo Fluido */}
      <motion.div
        className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-purple-400/50 shadow-[0_0_12px_rgba(167,139,250,0.4)]"
        style={{
          x: glowX,
          y: glowY,
        }}
      />

      {/* Ponto Central de Alta Precisão */}
      <motion.div
        className="fixed pointer-events-none z-[10000] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#a78bfa] shadow-[0_0_8px_#a78bfa]"
        style={{
          x: cursorX,
          y: cursorY,
        }}
      />
    </>
  );
};
