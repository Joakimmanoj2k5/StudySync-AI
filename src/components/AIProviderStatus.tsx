import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cpu, CheckCircle, XCircle, RefreshCw, 
  Zap, Cloud, Server, ChevronDown 
} from 'lucide-react';
import { 
  checkProviderStatus, 
  getConfig, 
  setProvider, 
  type AIProvider 
} from '@/utils/aiAdapter';

const PROVIDER_INFO: Record<AIProvider, { name: string; icon: typeof Cpu; color: string }> = {
  ollama: { name: 'Ollama (Local)', icon: Server, color: 'text-blue-500' },
  gemini: { name: 'Google Gemini', icon: Zap, color: 'text-purple-500' },
  groq: { name: 'Groq', icon: Cloud, color: 'text-orange-500' }
};

export function AIProviderStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<AIProvider>('ollama');
  const [isInitialized, setIsInitialized] = useState(false);
  const checkingRef = useRef(false);

  const checkConnection = async () => {
    // Prevent overlapping checks
    if (checkingRef.current) return;
    checkingRef.current = true;
    setIsChecking(true);
    try {
      const status = await checkProviderStatus();
      setIsConnected(status);
    } catch {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
      checkingRef.current = false;
    }
  };

  useEffect(() => {
    const config = getConfig();
    setCurrentProvider(config.provider);
    setIsInitialized(true);
    checkConnection();
    
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleProviderChange = async (provider: AIProvider) => {
    setCurrentProvider(provider);
    setProvider(provider);
    setShowDropdown(false);
    setIsConnected(null);
    await checkConnection();
  };

  const ProviderIcon = PROVIDER_INFO[currentProvider].icon;

  // Don't render until initialized to prevent flash
  if (!isInitialized) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/50 border border-border/50 min-w-[120px] h-[36px]">
        <div className="w-4 h-4 bg-muted/50 rounded animate-pulse" />
        <div className="w-16 h-3 bg-muted/50 rounded animate-pulse hidden sm:block" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/50 border border-border/50 cursor-pointer hover:bg-card/80 transition-colors"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <ProviderIcon className={`w-4 h-4 ${PROVIDER_INFO[currentProvider].color}`} />
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {PROVIDER_INFO[currentProvider].name}
        </span>
        
        {/* Status indicator with fixed width to prevent layout shift */}
        <div className="flex items-center gap-1 min-w-[60px] sm:min-w-[70px]">
          {isChecking ? (
            <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : isConnected === true ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-500 hidden sm:inline">Online</span>
            </>
          ) : isConnected === false ? (
            <>
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-500 hidden sm:inline">Offline</span>
            </>
          ) : (
            <div className="w-4 h-4" /> 
          )}
        </div>
        
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </div>

      {/* Model Selection Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden"
          >
            <div className="p-2">
              <p className="text-xs text-muted-foreground px-2 py-1 mb-1">Select AI Model</p>
              
              {(Object.keys(PROVIDER_INFO) as AIProvider[]).map((provider) => {
                const info = PROVIDER_INFO[provider];
                const Icon = info.icon;
                return (
                  <button
                    key={provider}
                    onClick={() => handleProviderChange(provider)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                      currentProvider === provider
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${info.color}`} />
                    <span className="text-sm flex-1 text-left">{info.name}</span>
                    {currentProvider === provider && (
                      <CheckCircle className="w-4 h-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
