/**
 * M-Pesa Mozambique - Serviço de Pagamento
 * Integração com a API oficial da Vodacom MZ
 * Portal do Developer: https://developer.mpesa.vm.co.mz
 */

import crypto from "crypto";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MpesaConfig {
  apiKey: string;
  publicKey: string;
  serviceProviderCode: string;
  origin: string;
  environment: "sandbox" | "production";
}

export interface C2BRequest {
  amount: number;
  msisdn: string; // ex: 258840000000
  transactionReference: string;
  thirdPartyReference: string;
}

export interface TransactionStatusRequest {
  queryReference: string;
  thirdPartyReference: string;
}

export interface MpesaResponse {
  success: boolean;
  code: string;
  description: string;
  transactionId?: string;
  conversationId?: string;
  data?: Record<string, unknown>;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const HOSTS = {
  sandbox: "api.sandbox.vm.co.mz",
  production: "api.vm.co.mz",
};

const PORTS = {
  sandbox: 18352,
  production: 18354,
};

const RESPONSE_CODES: Record<string, string> = {
  "INS-0": "Pedido processado com sucesso",
  "INS-1": "Erro interno do servidor M-Pesa",
  "INS-5": "Saldo insuficiente",
  "INS-6": "Transacção não processada",
  "INS-9": "Pedido de pagamento duplicado",
  "INS-10": "Erro no sistema",
  "INS-13": "Utilizador inválido",
  "INS-14": "Código de serviço inválido",
  "INS-15": "Valor inválido",
  "INS-16": "Referência de transacção inválida",
  "INS-17": "Referência de terceiros inválida",
  "INS-18": "MSISDN inválido",
  "INS-19": "Montante inválido",
  "INS-20": "Erro de encriptação",
  "INS-21": "Conta do utilizador inválida",
  "INS-22": "Pedido duplicado",
  "INS-23": "Erro de configuração",
  "INS-24": "Chave pública inválida",
  "INS-25": "Sem autorização",
  "INS-993": "Carteira directa do utilizador não disponível",
  "INS-994": "Erro de ligação directa ao utilizador",
  "INS-995": "Pedido cancelado pelo utilizador",
  "INS-996": "Utilizador não respondeu",
  "INS-997": "Pedido cancelado pelo utilizador",
  "INS-998": "Transacção não completada",
  "INS-2006": "Permissão negada",
};

// ─── Funções utilitárias ───────────────────────────────────────────────────────

/**
 * Gera o token de autenticação encriptando a API key com a chave pública
 */
function generateBearerToken(apiKey: string, publicKey: string): string {
  const formattedKey =
    `-----BEGIN PUBLIC KEY-----\n` +
    publicKey.match(/.{1,60}/g)!.join("\n") +
    `\n-----END PUBLIC KEY-----`;

  const encrypted = crypto.publicEncrypt(
    {
      key: formattedKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(apiKey)
  );

  return encrypted.toString("base64");
}

/**
 * Gera uma referência única de transacção
 */
export function generateTransactionRef(prefix = "TXN"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Formata o número de telefone para o formato MSISDN (258XXXXXXXXX)
 */
export function formatMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("258")) return digits;
  if (digits.startsWith("8") && digits.length === 9) return `258${digits}`;
  if (digits.length === 12 && digits.startsWith("258")) return digits;
  throw new Error(
    `Número de telefone inválido: ${phone}. Use o formato 258840000000 ou 840000000`
  );
}

// ─── Classe Principal ──────────────────────────────────────────────────────────

export class MpesaService {
  private config: MpesaConfig;
  private bearerToken: string;
  private baseUrl: string;

  constructor(config: MpesaConfig) {
    this.config = config;
    this.bearerToken = generateBearerToken(config.apiKey, config.publicKey);
    const host = HOSTS[config.environment];
    const port = PORTS[config.environment];
    this.baseUrl = `https://${host}:${port}`;
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.bearerToken}`,
      Origin: this.config.origin,
    };
  }

  private parseResponse(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>
  ): MpesaResponse {
    const code = data.output_ResponseCode || "UNKNOWN";
    const description =
      RESPONSE_CODES[code] ||
      data.output_ResponseDesc ||
      "Resposta desconhecida";
    const success = code === "INS-0";

    return {
      success,
      code,
      description,
      transactionId: data.output_TransactionID,
      conversationId: data.output_ConversationID,
      data,
    };
  }

  /**
   * C2B — Cliente paga para a empresa
   * O cliente recebe uma notificação no telefone para confirmar o pagamento
   */
  async initiateC2B(request: C2BRequest): Promise<MpesaResponse> {
    const msisdn = formatMsisdn(request.msisdn);

    const body = {
      input_Amount: request.amount.toString(),
      input_CustomerMSISDN: msisdn,
      input_Country: "MOZ",
      input_Currency: "MZN",
      input_ServiceProviderCode: this.config.serviceProviderCode,
      input_TransactionReference: request.transactionReference,
      input_ThirdPartyReference: request.thirdPartyReference,
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/ipg/v1x/c2bPayment/singleStage/`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      return {
        success: false,
        code: "NETWORK_ERROR",
        description:
          error instanceof Error
            ? error.message
            : "Erro de rede ao contactar M-Pesa",
      };
    }
  }

  /**
   * Verifica o status de uma transacção
   */
  async queryTransactionStatus(
    request: TransactionStatusRequest
  ): Promise<MpesaResponse> {
    const params = new URLSearchParams({
      input_QueryReference: request.queryReference,
      input_ServiceProviderCode: this.config.serviceProviderCode,
      input_ThirdPartyReference: request.thirdPartyReference,
      input_Country: "MOZ",
    });

    try {
      const response = await fetch(
        `${this.baseUrl}/ipg/v1x/queryTransactionStatus/?${params}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      return {
        success: false,
        code: "NETWORK_ERROR",
        description:
          error instanceof Error ? error.message : "Erro de rede ao consultar",
      };
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let mpesaInstance: MpesaService | null = null;

export function getMpesaService(): MpesaService {
  if (!mpesaInstance) {
    const required = [
      "MPESA_API_KEY",
      "MPESA_PUBLIC_KEY",
      "MPESA_SERVICE_PROVIDER_CODE",
      "MPESA_ORIGIN",
    ];

    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(
          `Variável de ambiente em falta: ${key}\nConfigura o ficheiro .env.local`
        );
      }
    }

    mpesaInstance = new MpesaService({
      apiKey: process.env.MPESA_API_KEY!,
      publicKey: process.env.MPESA_PUBLIC_KEY!,
      serviceProviderCode: process.env.MPESA_SERVICE_PROVIDER_CODE!,
      origin: process.env.MPESA_ORIGIN!,
      environment:
        (process.env.MPESA_ENVIRONMENT as "sandbox" | "production") ??
        "sandbox",
    });
  }

  return mpesaInstance;
}
