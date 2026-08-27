import React, { useState, useEffect, useRef } from 'react';
import { dataSaver, ImageOptimizationOptions } from '../../services/dataSaverService';
import { Eye, Image as ImageIcon, WifiOff, Sparkles, RefreshCw } from 'lucide-react';

export type ImageVariant = 'avatar' | 'card' | 'thumbnail' | 'chat' | 'full';

export interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src: string;
  alt: string;
  variant?: ImageVariant;
  aspectRatio?: 'square' | 'portrait' | 'landscape' | 'auto';
  className?: string;
  blurPlaceholder?: boolean;
  priority?: boolean; // if true, bypasses lazy loading
  showSavingsBadge?: boolean;
  onBytesLoaded?: (bytes: number) => void;
}

/**
 * PONTO 4: OptimizedImage Component
 * Implements real byte degradation, lazy loading, blur placeholders,
 * tap-to-load in Ultra mode, and bandwidth savings telemetry.
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  variant = 'card',
  aspectRatio = 'auto',
  className = '',
  blurPlaceholder = true,
  priority = false,
  showSavingsBadge = false,
  onBytesLoaded,
  ...imgProps
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(priority);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [revealedManually, setRevealedManually] = useState<boolean>(false);
  const [loadStats, setLoadStats] = useState<{ transferredBytes: number; originalEstimate: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const settings = dataSaver.getSettings();

  // Determine if manual click is required (Ultra-low mode with tap-to-load enabled)
  const isUltra = settings.enabled && settings.qualityLevel === 'ultra_low';
  const requiresManualReveal = isUltra && settings.loadThumbnailsOnly && variant !== 'avatar' && variant !== 'thumbnail' && !revealedManually;

  // IntersectionObserver for genuine lazy loading without unnecessary preloading
  useEffect(() => {
    if (priority || isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px 0px', // start loading when 100px away from viewport
        threshold: 0.01
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isVisible]);

  // Compute optimized URL based on active data saver tier and requested variant
  const optimizedUrl = dataSaver.getOptimizedImageUrl(src, {
    variant: variant as ImageOptimizationOptions['variant'],
    qualityOverride: revealedManually ? 'high' : undefined
  });

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    setHasError(false);

    // Calculate approximate byte savings for telemetry
    const stats = dataSaver.recordImageTransfer(src, optimizedUrl, variant);
    setLoadStats(stats);
    if (onBytesLoaded) {
      onBytesLoaded(stats.transferredBytes);
    }
  };

  const handleImageError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  const handleManualReveal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealedManually(true);
  };

  const aspectClasses = {
    square: 'aspect-square',
    portrait: 'aspect-4/5',
    landscape: 'aspect-16/9',
    auto: ''
  }[aspectRatio];

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-stone-100 ${aspectClasses} ${className}`}
    >
      {/* 1. Loading Blur/Skeleton Placeholder */}
      {!isLoaded && !hasError && !requiresManualReveal && (
        <div className="absolute inset-0 bg-stone-200/80 animate-pulse flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-stone-400 opacity-60" />
        </div>
      )}

      {/* 2. Ultra Mode Tap-to-Load Overlay */}
      {requiresManualReveal && isVisible && (
        <div className="absolute inset-0 bg-stone-900/85 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-center z-10">
          <WifiOff className="w-5 h-5 text-amber-400 mb-1.5" />
          <span className="text-[11px] font-bold text-white leading-tight">Modo Ultra Econômico</span>
          <span className="text-[10px] text-stone-300 mb-2">Foto pausada para poupar dados (~45 KB)</span>
          <button
            type="button"
            onClick={handleManualReveal}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver Imagem</span>
          </button>
        </div>
      )}

      {/* 3. Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 bg-stone-100 flex flex-col items-center justify-center text-stone-400 p-2 text-center">
          <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
          <span className="text-[10px] text-stone-500 font-medium">Imagem indisponível</span>
          <button
            type="button"
            onClick={() => {
              setHasError(false);
              setIsLoaded(false);
            }}
            className="mt-1 text-[9px] text-rose-600 font-semibold flex items-center gap-0.5 hover:underline"
          >
            <RefreshCw className="w-2.5 h-2.5" /> Tentar novamente
          </button>
        </div>
      )}

      {/* 4. Genuine Image Element with Lazy Loading and Async Decoding */}
      {isVisible && !requiresManualReveal && (
        <img
          src={optimizedUrl}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleImageLoad}
          onError={handleImageError}
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          {...imgProps}
        />
      )}

      {/* 5. Optional Savings Diagnostic Badge */}
      {showSavingsBadge && loadStats && (
        <div className="absolute top-2 right-2 bg-stone-900/80 backdrop-blur-md text-[9px] text-emerald-400 font-mono px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1 shadow-2xs z-10 pointer-events-none">
          <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
          <span>-{Math.round((1 - loadStats.transferredBytes / loadStats.originalEstimate) * 100)}% ({Math.round(loadStats.transferredBytes / 1024)}KB)</span>
        </div>
      )}
    </div>
  );
};
