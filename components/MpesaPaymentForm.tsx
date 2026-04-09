/**
 * Componente de exemplo — Formulário de pagamento M-Pesa
 * Copia e adapta para o teu projecto
 */

"use client";

import { useState } from "react";
import { useMpesaPayment } from "@/hooks/useMpesaPayment";

interface PaymentFormProps {
  orderId: string;
  amount: number;
  description?: string;
}

export function MpesaPaymentForm({ orderId, amount, description }: PaymentFormProps) {
  const [phone, setPhone] = useState("");

  const { pay, reset, status, error, result, isLoading, isWaiting } =
    useMpesaPayment({
      onSuccess: (res) => {
        console.log("Pagamento confirmado:", res);
        // Redireciona ou actualiza o estado da tua app
      },
      onError: (err) => {
        console.error("Pagamento falhou:", err);
      },
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await pay({ amount, phone, orderId });
  };

  // ── Estado: Concluído ────────────────────────────────────────────
  if (status === "completed") {
    return (
      <div className="payment-success">
        <h2>✅ Pagamento Confirmado!</h2>
        <p>O teu pagamento de <strong>{amount} MZN</strong> foi processado.</p>
        {result?.transactionId && (
          <p>ID da Transacção: <code>{result.transactionId}</code></p>
        )}
        <button onClick={reset}>Novo Pagamento</button>
      </div>
    );
  }

  // ── Estado: A aguardar confirmação no telemóvel ──────────────────
  if (isWaiting) {
    return (
      <div className="payment-waiting">
        <div className="spinner" />
        <h2>📱 Confirma no teu telemóvel</h2>
        <p>
          Enviámos um pedido de pagamento de <strong>{amount} MZN</strong> para{" "}
          <strong>{phone}</strong>.
        </p>
        <p>Abre o M-Pesa e confirma o pagamento com o teu PIN.</p>
        <button onClick={reset} disabled={isLoading}>
          Cancelar
        </button>
      </div>
    );
  }

  // ── Estado: Formulário ───────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <h2>Pagamento via M-Pesa</h2>

      {description && <p>{description}</p>}

      <div className="amount-display">
        <span>Total a pagar:</span>
        <strong>{amount} MZN</strong>
      </div>

      <div className="field">
        <label htmlFor="phone">Número M-Pesa</label>
        <input
          id="phone"
          type="tel"
          placeholder="84 000 0000 ou 258840000000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          disabled={isLoading}
        />
        <small>Introduce o número Vodacom associado ao teu M-Pesa</small>
      </div>

      {error && (
        <div className="error-message" role="alert">
          ⚠️ {error}
        </div>
      )}

      <button type="submit" disabled={isLoading || !phone}>
        {isLoading ? "A processar..." : `Pagar ${amount} MZN`}
      </button>
    </form>
  );
}
