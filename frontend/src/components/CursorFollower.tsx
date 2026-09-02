import React, { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

export const CursorFollower: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Mola suave estilo vulto ambiente sem bolinhas
  const glowX = useSpring(-100, { stiffness: 75, damping: 24 });
  const glowY = useSpring(-100, { stiffness: 75, damping: 24 });

  useEffect(() => {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
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
  }, [glowX, glowY, isVisible]);

  if (!isVisible) return null;

  return (
    <motion.div
      className="fixed pointer-events-none z-[9998] -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full mix-blend-screen opacity-50"
      style={{
        x: glowX,
        y: glowY,
        background: 'radial-gradient(circle, rgba(167, 139, 250, 0.08) 0%, rgba(51, 18, 116, 0.03) 50%, transparent 70%)',
      }}
    />
  );
};
