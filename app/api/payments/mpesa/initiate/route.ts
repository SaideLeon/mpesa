/**
 * POST /api/payments/mpesa/initiate
 * Inicia um pagamento C2B (Cliente → Empresa) via M-Pesa
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getMpesaService,
  generateTransactionRef,
  formatMsisdn,
} from "@/lib/mpesa";

export interface InitiatePaymentBody {
  amount: number;
  phone: string;
  /** Referência interna do teu sistema (ex: ID da encomenda) */
  orderId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: InitiatePaymentBody = await req.json();

    // ── Validação ────────────────────────────────────────────────
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: "Montante inválido. Deve ser maior que 0." },
        { status: 400 }
      );
    }

    if (!body.phone) {
      return NextResponse.json(
        { error: "Número de telefone é obrigatório." },
        { status: 400 }
      );
    }

    if (!body.orderId) {
      return NextResponse.json(
        { error: "ID da encomenda é obrigatório." },
        { status: 400 }
      );
    }

    // ── Formatar MSISDN ──────────────────────────────────────────
    let msisdn: string;
    try {
      msisdn = formatMsisdn(body.phone);
    } catch {
      return NextResponse.json(
        {
          error:
            "Número de telefone inválido. Use o formato 258840000000 ou 840000000.",
        },
        { status: 400 }
      );
    }

    // ── Gerar referências únicas ─────────────────────────────────
    const transactionReference = generateTransactionRef("PAY");
    const thirdPartyReference = body.orderId;

    // ── Chamar API M-Pesa ────────────────────────────────────────
    const mpesa = getMpesaService();
    const result = await mpesa.initiateC2B({
      amount: body.amount,
      msisdn,
      transactionReference,
      thirdPartyReference,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.description,
          code: result.code,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Pedido de pagamento enviado. O cliente deve confirmar no telemóvel.",
      transactionId: result.transactionId,
      conversationId: result.conversationId,
      transactionReference,
    });
  } catch (error) {
    console.error("[M-Pesa] Erro ao iniciar pagamento:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
