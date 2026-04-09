/**
 * POST /api/payments/mpesa/webhook
 *
 * Recebe notificações de pagamento do M-Pesa (callback).
 *
 * ⚠️  IMPORTANTE: Esta rota deve ser registada no M-Pesa Developer Portal
 *     como a tua "Callback URL" / "Result URL".
 *
 * Para desenvolvimento local, usa ngrok ou similar:
 *   npx ngrok http 3000
 *   → https://xxxx.ngrok.io/api/payments/mpesa/webhook
 */

import { NextRequest, NextResponse } from "next/server";

// ─── Tipos do callback M-Pesa ─────────────────────────────────────────────────

interface MpesaCallbackPayload {
  output_TransactionID?: string;
  output_ConversationID?: string;
  output_ThirdPartyReference?: string;
  output_ResponseCode?: string;
  output_ResponseDesc?: string;
  // Campos adicionais que a Vodacom pode enviar
  [key: string]: unknown;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const payload: MpesaCallbackPayload = await req.json();

    console.log("[M-Pesa Webhook] Recebido:", JSON.stringify(payload, null, 2));

    const responseCode = payload.output_ResponseCode;
    const transactionId = payload.output_TransactionID;
    const orderId = payload.output_ThirdPartyReference;
    const isSuccess = responseCode === "INS-0";

    // ── Aqui processas o resultado ────────────────────────────────
    // Exemplos do que podes fazer:
    //
    // 1. Actualizar o estado da encomenda na base de dados:
    //    await db.order.update({ where: { id: orderId }, data: { paid: isSuccess } })
    //
    // 2. Enviar email de confirmação:
    //    if (isSuccess) await sendConfirmationEmail(orderId)
    //
    // 3. Emitir evento via Pusher/Socket.io para actualizar o frontend em tempo real:
    //    await pusher.trigger(`order-${orderId}`, 'payment-update', { success: isSuccess })

    if (isSuccess) {
      console.log(`[M-Pesa Webhook] ✅ Pagamento confirmado — Order: ${orderId}, TxID: ${transactionId}`);
      // TODO: Marca a encomenda como paga no teu sistema
    } else {
      console.log(`[M-Pesa Webhook] ❌ Pagamento falhado — Code: ${responseCode}, Order: ${orderId}`);
      // TODO: Marca a encomenda como falhada ou notifica o utilizador
    }

    // O M-Pesa espera uma resposta 200 para confirmar que recebeste o callback
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("[M-Pesa Webhook] Erro ao processar callback:", error);
    // Ainda retorna 200 para evitar que o M-Pesa reenvie infinitamente
    return NextResponse.json({ success: false }, { status: 200 });
  }
}

// O M-Pesa pode enviar GET para verificar se o endpoint está activo
export async function GET() {
  return NextResponse.json({ status: "M-Pesa webhook endpoint activo" });
}
