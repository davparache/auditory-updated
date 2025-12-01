
import React from 'react';

/**
 * Parache Logo - Adapted for App Header
 */
const ParacheLogo = () => {
  return (
    <div className="flex flex-col items-start justify-center">
      
      {/* Título Principal - Montserrat Light */}
      <h1 
        className="text-3xl font-light tracking-[0.2em] text-white uppercase leading-none logo-flicker"
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        PARACHE
      </h1>

      {/* Slogan Técnico - Space Grotesk */}
      <div className="flex items-center gap-3 mt-1.5 opacity-90 pl-1">
        {/* Línea decorativa izquierda */}
        <span className="h-[1px] w-6 bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]"></span>
        
        <p 
          className="text-[9px] tracking-[0.2em] text-gray-400 uppercase font-medium"
          style={{ fontFamily: "'Space Grotesk', monospace" }}
        >
          &lt; CODE DEVELOPING /&gt;
        </p>
        
        {/* Línea decorativa derecha */}
        <span className="h-[1px] w-6 bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]"></span>
      </div>
      
    </div>
  );
};

export default ParacheLogo;
