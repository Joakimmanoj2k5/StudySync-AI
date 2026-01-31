import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { checkOllamaStatus } from '@/utils/ollamaProcessor';

export function OllamaStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const status = await checkOllamaStatus();
      setIsConnected(status);
    } catch {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/50 border border-border/50">
      <Cpu className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Ollama</span>
      
      <AnimatePresence mode="wait">
        {isChecking ? (
          <motion.div
            key="checking"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
          </motion.div>
        ) : isConnected === true ? (
          <motion.div
            key="connected"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1"
          >
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs text-green-500">Connected</span>
          </motion.div>
        ) : isConnected === false ? (
          <motion.div
            key="disconnected"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1"
          >
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-500">Offline</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
      
      <button
        onClick={checkConnection}
        disabled={isChecking}
        className="ml-1 p-1 rounded hover:bg-accent/50 transition-colors"
        title="Refresh connection status"
      >
        <RefreshCw className={`w-3 h-3 text-muted-foreground ${isChecking ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
