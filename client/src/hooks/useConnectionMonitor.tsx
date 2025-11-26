import { useState, useEffect, useCallback } from 'react';

interface ConnectionStatus {
  isOnline: boolean;
  isServerReachable: boolean;
  lastChecked: Date;
  consecutiveFailures: number;
}

export function useConnectionMonitor() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    isServerReachable: true,
    lastChecked: new Date(),
    consecutiveFailures: 0,
  });

  const checkServerHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      const isReachable = response.status < 500; // Allow 401/403 as "reachable"
      
      setStatus(prev => ({
        ...prev,
        isServerReachable: isReachable,
        lastChecked: new Date(),
        consecutiveFailures: isReachable ? 0 : prev.consecutiveFailures + 1,
      }));
      
      console.log('Server health check:', {
        status: response.status,
        isReachable,
        timestamp: new Date().toISOString()
      });
      
      return isReachable;
    } catch (error) {
      console.error('Server health check failed:', error);
      setStatus(prev => ({
        ...prev,
        isServerReachable: false,
        lastChecked: new Date(),
        consecutiveFailures: prev.consecutiveFailures + 1,
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      console.log('Connection: Back online');
      setStatus(prev => ({ ...prev, isOnline: true }));
      checkServerHealth();
    };

    const handleOffline = () => {
      console.log('Connection: Gone offline');
      setStatus(prev => ({ ...prev, isOnline: false, isServerReachable: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial server health check
    checkServerHealth();

    // Periodic health checks
    const interval = setInterval(checkServerHealth, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkServerHealth]);

  return {
    ...status,
    checkServerHealth,
    isHealthy: status.isOnline && status.isServerReachable,
  };
}