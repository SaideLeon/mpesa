/**
 * Hook React para iniciar e monitorizar pagamentos M-Pesa
 * Uso: const { pay, status, isLoading, error } = useMpesaPayment()
 */

"use client";

import { useState, useCallback, useRef } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | "idle"
  | "initiating"
  | "waiting_confirmation" // Aguarda confirmação do utilizador no telemóvel
  | "checking"
  | "completed"
  | "failed";

export interface PaymentResult {
  transactionId?: string;
  conversationId?: string;
  transactionReference?: string;
}

export interface UseMpesaPaymentOptions {
  /** Intervalo em ms para verificar o status (padrão: 5000ms) */
  pollingInterval?: number;
  /** Máximo de tentativas de verificação (padrão: 12 = ~1 minuto) */
  maxPollingAttempts?: number;
  /** Callback quando o pagamento é confirmado */
  onSuccess?: (result: PaymentResult) => void;
  /** Callback quando o pagamento falha */
  onError?: (error: string) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMpesaPayment(options: UseMpesaPaymentOptions = {}) {
  const {
    pollingInterval = 5000,
    maxPollingAttempts = 12,
    onSuccess,
    onError,
  } = options;

  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    attemptsRef.current = 0;
  }, []);

  const checkStatus = useCallback(
    async (transactionId: string, orderId: string) => {
      attemptsRef.current += 1;

      if (attemptsRef.current > maxPollingAttempts) {
        stopPolling();
        setStatus("failed");
        const msg = "Tempo de espera esgotado. Verifica o teu M-Pesa e tenta novamente.";
        setError(msg);
        onError?.(msg);
        return;
      }

      setStatus("checking");

      try {
        const response = await fetch(
          `/api/payments/mpesa/status?transactionId=${transactionId}&orderId=${orderId}`
        );
        const data = await response.json();

        if (data.success) {
          stopPolling();
          setStatus("completed");
          setResult({ transactionId, ...data });
          onSuccess?.({ transactionId, ...data });
        } else if (data.code !== "INS-6" && data.code !== "INS-0") {
          // Erro definitivo (não é apenas "ainda a processar")
          stopPolling();
          setStatus("failed");
          setError(data.description || "Pagamento recusado.");
          onError?.(data.description);
        } else {
          // Ainda a processar — continua o polling
          setStatus("waiting_confirmation");
        }
      } catch {
        // Erro de rede temporário, continua a tentar
        setStatus("waiting_confirmation");
      }
    },
    [maxPollingAttempts, onSuccess, onError, stopPolling]
  );

  /**
   * Inicia o pagamento M-Pesa
   */
  const pay = useCallback(
    async (params: { amount: number; phone: string; orderId: string }) => {
      setStatus("initiating");
      setError(null);
      setResult(null);
      stopPolling();

      try {
        const response = await fetch("/api/payments/mpesa/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setStatus("failed");
          const msg = data.error || "Erro ao iniciar pagamento.";
          setError(msg);
          onError?.(msg);
          return;
        }

        const { transactionId, transactionReference } = data;
        setResult({ transactionId, transactionReference });
        setStatus("waiting_confirmation");

        // Inicia polling para verificar confirmação do utilizador
        pollingRef.current = setInterval(() => {
          checkStatus(transactionId, params.orderId);
        }, pollingInterval);

      } catch {
        setStatus("failed");
        const msg = "Erro de ligação. Verifica a tua internet.";
        setError(msg);
        onError?.(msg);
      }
    },
    [pollingInterval, checkStatus, stopPolling, onError]
  );

  const reset = useCallback(() => {
    stopPolling();
    setStatus("idle");
    setError(null);
    setResult(null);
  }, [stopPolling]);

  return {
    pay,
    reset,
    status,
    error,
    result,
    isLoading: status === "initiating" || status === "checking",
    isWaiting: status === "waiting_confirmation",
    isCompleted: status === "completed",
    isFailed: status === "failed",
  };
}
