
import React from 'react';

const ParacheLogo = () => {
  return (
    <div className="flex flex-col items-start justify-center cursor-default select-none group relative py-2">
      {/* Main Title */}
      <h1 
        className="text-4xl md:text-5xl font-light tracking-[0.2em] text-white uppercase leading-none logo-flicker relative z-10" 
        style={{ fontFamily: "'Montserrat', sans-serif" }}
      >
        PARACHE
      </h1>
      
      {/* Subtitle & Decoration */}
      <div className="flex items-center gap-3 mt-3 pl-1 w-full max-w-full overflow-visible">
        <span className="h-[1px] w-8 md:w-12 bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.9)] transition-all group-hover:w-16"></span>
        
        <p 
          className="text-[10px] md:text-[11px] tracking-[0.25em] text-gray-500 uppercase font-medium group-hover:text-white transition-colors whitespace-nowrap" 
          style={{ fontFamily: "'Space Grotesk', monospace" }}
        >
          &lt; CODE DEVELOPING /&gt;
        </p>
        
        <span className="h-[1px] w-8 md:w-12 bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.9)] transition-all group-hover:w-16"></span>
      </div>

      {/* Subtle Glow Behind */}
      <div className="absolute -inset-4 bg-white/0 group-hover:bg-white/[0.02] blur-xl transition-all duration-700 rounded-full pointer-events-none"></div>
    </div>
  );
};

export default ParacheLogo;
