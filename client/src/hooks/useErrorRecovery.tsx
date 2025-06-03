import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface ErrorRecoveryState {
  isRecovering: boolean;
  recoveryAttempts: number;
  lastErrorTime: Date | null;
  consecutiveErrors: number;
}

export function useErrorRecovery() {
  const [state, setState] = useState<ErrorRecoveryState>({
    isRecovering: false,
    recoveryAttempts: 0,
    lastErrorTime: null,
    consecutiveErrors: 0,
  });

  const queryClient = useQueryClient();

  const handleError = (error: Error) => {
    console.error('=== ERROR RECOVERY TRIGGERED ===');
    console.error('Error:', error.message);
    console.error('Current state:', state);
    
    const now = new Date();
    const isRecentError = state.lastErrorTime && (now.getTime() - state.lastErrorTime.getTime()) < 5000;
    
    setState(prev => ({
      ...prev,
      lastErrorTime: now,
      consecutiveErrors: isRecentError ? prev.consecutiveErrors + 1 : 1,
    }));

    // Automatic recovery for 502 errors
    if (error.message.includes('502') || error.message.includes('Server Error')) {
      initiateRecovery();
    }
  };

  const initiateRecovery = async () => {
    if (state.isRecovering || state.recoveryAttempts >= 3) {
      return;
    }

    console.log('=== STARTING AUTOMATIC RECOVERY ===');
    
    setState(prev => ({
      ...prev,
      isRecovering: true,
      recoveryAttempts: prev.recoveryAttempts + 1,
    }));

    try {
      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test server connectivity
      const healthCheck = await fetch('/api/health', {
        credentials: 'include',
        signal: AbortSignal.timeout(5000),
      });

      if (healthCheck.ok) {
        console.log('Server is responsive, invalidating queries');
        // Invalidate all queries to refetch data
        queryClient.invalidateQueries();
        
        setState(prev => ({
          ...prev,
          isRecovering: false,
          consecutiveErrors: 0,
        }));
        
        console.log('=== RECOVERY SUCCESSFUL ===');
      } else {
        throw new Error(`Health check failed: ${healthCheck.status}`);
      }
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
      
      setState(prev => ({
        ...prev,
        isRecovering: false,
      }));
      
      // If recovery fails, suggest manual intervention
      if (state.recoveryAttempts >= 2) {
        console.warn('Multiple recovery attempts failed, manual intervention needed');
      }
    }
  };

  const resetRecovery = () => {
    setState({
      isRecovering: false,
      recoveryAttempts: 0,
      lastErrorTime: null,
      consecutiveErrors: 0,
    });
  };

  return {
    ...state,
    handleError,
    initiateRecovery,
    resetRecovery,
    shouldShowRecoveryUI: state.consecutiveErrors >= 2 || state.recoveryAttempts >= 1,
  };
}