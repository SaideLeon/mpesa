/**
 * GET /api/payments/mpesa/status?transactionId=...&orderId=...
 * Verifica o status de uma transacção M-Pesa
 */

import { NextRequest, NextResponse } from "next/server";
import { getMpesaService } from "@/lib/mpesa";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const transactionId = searchParams.get("transactionId");
  const orderId = searchParams.get("orderId");

  if (!transactionId || !orderId) {
    return NextResponse.json(
      { error: "Parâmetros em falta: transactionId e orderId são obrigatórios." },
      { status: 400 }
    );
  }

  try {
    const mpesa = getMpesaService();
    const result = await mpesa.queryTransactionStatus({
      queryReference: transactionId,
      thirdPartyReference: orderId,
    });

    return NextResponse.json({
      success: result.success,
      status: result.success ? "COMPLETED" : "PENDING_OR_FAILED",
      code: result.code,
      description: result.description,
      transactionId: result.transactionId,
      data: result.data,
    });
  } catch (error) {
    console.error("[M-Pesa] Erro ao consultar transacção:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
